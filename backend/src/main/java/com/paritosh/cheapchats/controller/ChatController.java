package com.paritosh.cheapchats.controller;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.paritosh.cheapchats.dto.ChatMessageDto;
import com.paritosh.cheapchats.models.ChatMessage;
import com.paritosh.cheapchats.models.ChatGroup;
import com.paritosh.cheapchats.repositories.ChatGroupRepository;
import com.paritosh.cheapchats.repositories.ChatMessageRepository;

import lombok.extern.slf4j.Slf4j;

@Controller
@RestController
@RequestMapping("/api/messages")
@Slf4j
public class ChatController {

    @Autowired
    private final SimpMessagingTemplate messagingTemplate;
    @Autowired
    private final ChatMessageRepository chatMessageRepository;
    private final ChatGroupRepository chatGroupRepository;

    public ChatController(
            SimpMessagingTemplate messagingTemplate,
            ChatMessageRepository chatMessageRepository,
            ChatGroupRepository chatGroupRepository) {
        this.messagingTemplate = messagingTemplate;
        this.chatMessageRepository = chatMessageRepository;
        this.chatGroupRepository = chatGroupRepository;
    }

    // Broadcast the message to all subscribers of the group and persist it
    @MessageMapping("/chat/{groupName}/send")
    @Transactional
    public void sendMessage(@DestinationVariable("groupName") String groupName, @Payload ChatMessageDto messageDto) {
        try {
            ChatGroup group = chatGroupRepository.findById(groupName).orElse(null);
            if (group == null) {
                log.warn("Ignoring message for missing group: group={}, sender={}",
                        groupName, messageDto.getSender());
                rejectMessage(messageDto, "Group no longer exists");
                return;
            }
            if (!isActiveMember(group, messageDto.getSender())) {
                log.warn("Ignoring message from non-member: group={}, sender={}",
                        groupName, messageDto.getSender());
                rejectMessage(messageDto, "You are not an active member of this group");
                return;
            }
            if (isExpired(group)) {
                log.warn("Ignoring message for expired group: group={}, sender={}",
                        groupName, messageDto.getSender());
                rejectMessage(messageDto, "This group has expired");
                return;
            }
            if (!"CHAT".equals(messageDto.getType())) {
                log.warn("Ignoring non-chat WebSocket payload: group={}, type={}",
                        groupName, messageDto.getType());
                rejectMessage(messageDto, "Message could not be sent");
                return;
            }

            // Set timestamp
            messageDto.setTimestamp(LocalDateTime.now().toString());

            // Persist message
            ChatMessage entity = new ChatMessage();
            entity.setGroupName(groupName);
            entity.setSender(messageDto.getSender());
            entity.setContent(messageDto.getContent());
            entity.setTimestamp(LocalDateTime.parse(messageDto.getTimestamp()));
            entity.setType(messageDto.getType());
            if (messageDto.getReplyTo() != null) {
                entity.setReplyToSender(messageDto.getReplyTo().getSender());
                entity.setReplyToContent(messageDto.getReplyTo().getContent());
                entity.setReplyToTimestamp(messageDto.getReplyTo().getTimestamp());
            }

            // Save message to database
            ChatMessage savedEntity = chatMessageRepository.save(entity);
            messageDto.setId(savedEntity.getId()); // Set the ID from saved entity
            log.info("Message saved: " + entity.getContent() + "; Group: " + groupName + "; ID: " + savedEntity.getId());

            // Send to WebSocket subscribers
            messagingTemplate.convertAndSend("/topic/group/" + groupName, messageDto);

            log.info("Message sent: " + messageDto.getContent() + "; Group: " + groupName);
        } catch (MessagingException e) {
            System.err.println("Invalid groupId: " + groupName);
        }
    }

    // Delete message endpoint
    @DeleteMapping("/{messageId}")
    public void deleteMessage(@PathVariable Long messageId, @RequestParam String groupName, @RequestParam String username) {
        try {
            ChatGroup group = chatGroupRepository.findById(groupName)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Group not found"));
            if (!group.getMembers().contains(username) || isExpired(group)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only active group members can delete messages");
            }

            // Find the message
            ChatMessage message = chatMessageRepository.findById(messageId)
                    .orElseThrow(() -> new RuntimeException("Message not found"));

            // Check if the user is the sender of the message
            if (!message.getSender().equals(username) || !groupName.equals(message.getGroupName())) {
                log.info("DELETE DENIED: User " + username + " tried to delete message " + messageId + " sent by " + message.getSender());
                return;
            }

            // Delete from database
            chatMessageRepository.deleteById(messageId);
            log.info("DELETE: User " + username + " deleted message " + messageId + " from group " + groupName);

            // Create delete notification DTO
            ChatMessageDto deleteDto = new ChatMessageDto();
            deleteDto.setId(messageId);
            deleteDto.setSender(username);
            deleteDto.setContent("Message deleted");
            deleteDto.setType("DELETE");
            deleteDto.setTimestamp(LocalDateTime.now().toString());

            // Broadcast delete notification to all subscribers
            messagingTemplate.convertAndSend("/topic/group/" + groupName, deleteDto);
            log.info("DELETE NOTIFICATION SENT: Message " + messageId + " delete notification broadcasted to group " + groupName);
            log.info("DELETE DTO: " + deleteDto.toString());

        } catch (MessagingException e) {
            System.err.println("Error deleting message " + messageId + ": " + e.getMessage());
        }
    }

    // REST endpoint to fetch all messages for a group
    @GetMapping("/{groupName}")
    public List<com.paritosh.cheapchats.dto.ChatMessageDto> getMessagesForGroup(
            @PathVariable String groupName,
            @org.springframework.web.bind.annotation.RequestParam String username) {
        ChatGroup group = chatGroupRepository.findById(groupName)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Group not found"));
        LocalDateTime removedAt = group.getKickedMembers().get(username);
        if (!group.getMembers().contains(username) && removedAt == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User is not allowed to view this group");
        }

        List<ChatMessage> groupMessages = removedAt == null
                ? chatMessageRepository.findByGroupNameOrderByTimestampAsc(groupName)
                : chatMessageRepository.findByGroupNameAndTimestampBeforeOrderByTimestampAsc(groupName, removedAt);
        return groupMessages
                .stream()
                .map(entity -> {
                    com.paritosh.cheapchats.dto.ChatMessageDto dto = new com.paritosh.cheapchats.dto.ChatMessageDto();
                    dto.setId(entity.getId());
                    dto.setSender(entity.getSender());
                    dto.setContent(entity.getContent());
                    dto.setTimestamp(entity.getTimestamp().toString());
                    dto.setType(entity.getType());
                    if (entity.getReplyToSender() != null) {
                        ChatMessageDto.ReplyPreviewDto replyTo =
                                new ChatMessageDto.ReplyPreviewDto();
                        replyTo.setSender(entity.getReplyToSender());
                        replyTo.setContent(entity.getReplyToContent());
                        replyTo.setTimestamp(entity.getReplyToTimestamp());
                        dto.setReplyTo(replyTo);
                    }
                    return dto;
                })
                .collect(Collectors.toList());
    }

    private boolean isExpired(ChatGroup group) {
        if (group.isExpired()) {
            return true;
        }
        LocalDateTime expiresAt = group.getExpiresAt();
        if (expiresAt == null && group.getCreatedAt() != null) {
            try {
                expiresAt = group.getCreatedAt().plusMinutes(Long.parseLong(group.getExpiresIn()));
            } catch (NumberFormatException ignored) {
                return false;
            }
        }
        return expiresAt != null && !expiresAt.isAfter(LocalDateTime.now());
    }

    private boolean isActiveMember(ChatGroup group, String username) {
        return username != null
                && !group.getKickedMembers().containsKey(username)
                && (group.getMembers().contains(username) || username.equals(group.getCreatedBy()));
    }

    private void rejectMessage(ChatMessageDto messageDto, String reason) {
        if (messageDto.getSender() == null || messageDto.getClientMessageId() == null) {
            return;
        }
        ChatMessageDto rejection = new ChatMessageDto();
        rejection.setType("MESSAGE_REJECTED");
        rejection.setSender(messageDto.getSender());
        rejection.setContent(reason);
        rejection.setClientMessageId(messageDto.getClientMessageId());
        rejection.setTimestamp(LocalDateTime.now().toString());
        messagingTemplate.convertAndSend("/topic/user/" + messageDto.getSender(), rejection);
    }

}
