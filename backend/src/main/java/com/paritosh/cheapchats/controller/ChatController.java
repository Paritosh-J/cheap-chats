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
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.paritosh.cheapchats.dto.ChatMessageDto;
import com.paritosh.cheapchats.models.ChatMessage;
import com.paritosh.cheapchats.repositories.ChatMessageRepository;

@Controller
@RestController
@RequestMapping("/api/messages")
public class ChatController {

    @Autowired
    private final SimpMessagingTemplate messagingTemplate;
    @Autowired
    private final ChatMessageRepository chatMessageRepository;

    public ChatController(SimpMessagingTemplate messagingTemplate, ChatMessageRepository chatMessageRepository) {
        this.messagingTemplate = messagingTemplate;
        this.chatMessageRepository = chatMessageRepository;
    }

    // Broadcast the message to all subscribers of the group and persist it
    @MessageMapping("/chat/{groupName}/send")
    public void sendMessage(@DestinationVariable("groupName") String groupName, @Payload ChatMessageDto messageDto) {
        try {
            // Set timestamp
            messageDto.setTimestamp(LocalDateTime.now().toString());

            // Persist message
            ChatMessage entity = new ChatMessage();
            entity.setGroupName(groupName);
            entity.setSender(messageDto.getSender());
            entity.setContent(messageDto.getContent());
            entity.setTimestamp(LocalDateTime.parse(messageDto.getTimestamp()));
            entity.setType(messageDto.getType());

            // Save message to database
            ChatMessage savedEntity = chatMessageRepository.save(entity);
            messageDto.setId(savedEntity.getId()); // Set the ID from saved entity
            System.out.println("Message saved: " + entity.getContent() + "; Group: " + groupName + "; ID: " + savedEntity.getId());

            // Send to WebSocket subscribers
            messagingTemplate.convertAndSend("/topic/group/" + groupName, messageDto);

            System.out.println("Message sent: " + messageDto.getContent() + "; Group: " + groupName);
        } catch (MessagingException e) {
            System.err.println("Invalid groupId: " + groupName);
        }
    }

    // Delete message endpoint
    @DeleteMapping("/{messageId}")
    public void deleteMessage(@PathVariable Long messageId, @RequestParam String groupName, @RequestParam String username) {
        try {
            // Find the message
            ChatMessage message = chatMessageRepository.findById(messageId)
                    .orElseThrow(() -> new RuntimeException("Message not found"));

            // Check if the user is the sender of the message
            if (!message.getSender().equals(username)) {
                System.out.println("DELETE DENIED: User " + username + " tried to delete message " + messageId + " sent by " + message.getSender());
                return;
            }

            // Delete from database
            chatMessageRepository.deleteById(messageId);
            System.out.println("DELETE: User " + username + " deleted message " + messageId + " from group " + groupName);

            // Create delete notification DTO
            ChatMessageDto deleteDto = new ChatMessageDto();
            deleteDto.setId(messageId);
            deleteDto.setSender(username);
            deleteDto.setContent("Message deleted");
            deleteDto.setType("DELETE");
            deleteDto.setTimestamp(LocalDateTime.now().toString());

            // Broadcast delete notification to all subscribers
            messagingTemplate.convertAndSend("/topic/group/" + groupName, deleteDto);
            System.out.println("DELETE NOTIFICATION SENT: Message " + messageId + " delete notification broadcasted to group " + groupName);
            System.out.println("DELETE DTO: " + deleteDto.toString());

        } catch (Exception e) {
            System.err.println("Error deleting message " + messageId + ": " + e.getMessage());
        }
    }

    // REST endpoint to fetch all messages for a group
    @GetMapping("/{groupName}")
    public List<com.paritosh.cheapchats.dto.ChatMessageDto> getMessagesForGroup(@PathVariable String groupName) {
        return chatMessageRepository.findByGroupNameOrderByTimestampAsc(groupName)
                .stream()
                .map(entity -> {
                    com.paritosh.cheapchats.dto.ChatMessageDto dto = new com.paritosh.cheapchats.dto.ChatMessageDto();
                    dto.setId(entity.getId());
                    dto.setSender(entity.getSender());
                    dto.setContent(entity.getContent());
                    dto.setTimestamp(entity.getTimestamp().toString());
                    dto.setType(entity.getType());
                    return dto;
                })
                .collect(Collectors.toList());
    }
}
