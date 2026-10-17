package com.paritosh.cheapchats.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import com.paritosh.cheapchats.dto.ChatMessageDto;
import com.paritosh.cheapchats.models.ChatGroup;
import com.paritosh.cheapchats.models.ChatMessage;
import com.paritosh.cheapchats.repositories.ChatGroupRepository;
import com.paritosh.cheapchats.repositories.ChatMessageRepository;

@ExtendWith(MockitoExtension.class)
class ChatControllerTest {

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private ChatMessageRepository chatMessageRepository;

    @Mock
    private ChatGroupRepository chatGroupRepository;

    @InjectMocks
    private ChatController chatController;

    @Test
    void sendMessagePersistsAndBroadcastsReplyPreview() {
        ChatGroup group = new ChatGroup();
        group.setGroupName("room");
        group.getMembers().add("alice");
        when(chatGroupRepository.findById("room")).thenReturn(Optional.of(group));

        ChatMessageDto message = new ChatMessageDto();
        message.setSender("alice");
        message.setContent("answer");
        message.setType("CHAT");
        message.setClientMessageId("client-1");
        message.setTimestamp(LocalDateTime.now().toString());
        ChatMessageDto.ReplyPreviewDto replyTo = new ChatMessageDto.ReplyPreviewDto();
        replyTo.setSender("bob");
        replyTo.setContent("question");
        replyTo.setTimestamp(LocalDateTime.now().minusMinutes(1).toString());
        message.setReplyTo(replyTo);
        when(chatMessageRepository.save(any(ChatMessage.class))).thenAnswer(invocation -> {
            ChatMessage saved = invocation.getArgument(0);
            saved.setId(12L);
            return saved;
        });

        chatController.sendMessage("room", message);

        ArgumentCaptor<ChatMessage> entityCaptor = ArgumentCaptor.forClass(ChatMessage.class);
        verify(chatMessageRepository).save(entityCaptor.capture());
        assertThat(entityCaptor.getValue().getReplyToSender()).isEqualTo("bob");
        assertThat(entityCaptor.getValue().getReplyToContent()).isEqualTo("question");
        ArgumentCaptor<ChatMessageDto> dtoCaptor = ArgumentCaptor.forClass(ChatMessageDto.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/group/room"), dtoCaptor.capture());
        assertThat(dtoCaptor.getValue().getReplyTo().getContent()).isEqualTo("question");
        assertThat(dtoCaptor.getValue().getClientMessageId()).isEqualTo("client-1");
    }

    @Test
    void membershipEventsCannotBeSubmittedAsChatMessages() {
        ChatGroup group = new ChatGroup();
        group.setGroupName("room");
        group.getMembers().add("alice");
        when(chatGroupRepository.findById("room")).thenReturn(Optional.of(group));

        ChatMessageDto join = new ChatMessageDto();
        join.setSender("alice");
        join.setContent("alice joined the group");
        join.setType("JOIN");

        chatController.sendMessage("room", join);

        assertThat(group.getMembers()).containsExactly("alice");
        verify(chatGroupRepository, never()).save(group);
        verify(chatMessageRepository, never()).save(any(ChatMessage.class));
        verify(messagingTemplate, never()).convertAndSend(any(String.class), any(Object.class));
    }

    @Test
    void removedMemberCannotSendMessages() {
        ChatGroup group = new ChatGroup();
        group.setGroupName("room");
        group.getKickedMembers().put("alice", LocalDateTime.now().minusMinutes(1));
        when(chatGroupRepository.findById("room")).thenReturn(Optional.of(group));

        ChatMessageDto message = new ChatMessageDto();
        message.setSender("alice");
        message.setContent("still here");
        message.setType("CHAT");
        message.setClientMessageId("client-2");

        chatController.sendMessage("room", message);

        verify(chatMessageRepository, never()).save(any(ChatMessage.class));
        ArgumentCaptor<ChatMessageDto> rejectionCaptor = ArgumentCaptor.forClass(ChatMessageDto.class);
        verify(messagingTemplate).convertAndSend(
                eq("/topic/user/alice"), rejectionCaptor.capture());
        assertThat(rejectionCaptor.getValue().getType()).isEqualTo("MESSAGE_REJECTED");
        assertThat(rejectionCaptor.getValue().getClientMessageId()).isEqualTo("client-2");
    }

    @Test
    void removedMemberCanOnlyLoadMessagesSentBeforeRemoval() {
        LocalDateTime removedAt = LocalDateTime.now().minusMinutes(5);
        ChatGroup group = new ChatGroup();
        group.setGroupName("room");
        group.getKickedMembers().put("alice", removedAt);
        when(chatGroupRepository.findById("room")).thenReturn(Optional.of(group));
        when(chatMessageRepository.findByGroupNameAndTimestampBeforeOrderByTimestampAsc("room", removedAt))
                .thenReturn(new ArrayList<>(List.of()));

        List<ChatMessageDto> messages = chatController.getMessagesForGroup("room", "alice");

        assertThat(messages).isEmpty();
        verify(chatMessageRepository)
                .findByGroupNameAndTimestampBeforeOrderByTimestampAsc("room", removedAt);
        verify(chatMessageRepository, never()).findByGroupNameOrderByTimestampAsc("room");
    }
}
