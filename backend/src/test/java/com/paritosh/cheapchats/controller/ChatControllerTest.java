package com.paritosh.cheapchats.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
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
        ChatMessageDto message = new ChatMessageDto();
        message.setSender("alice");
        message.setContent("answer");
        message.setType("CHAT");
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
    }

    @Test
    void joinMessageAddsMemberBeforeBroadcasting() {
        ChatGroup group = new ChatGroup();
        group.setGroupName("room");
        when(chatGroupRepository.findById("room")).thenReturn(Optional.of(group));
        when(chatMessageRepository.save(any(ChatMessage.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ChatMessageDto join = new ChatMessageDto();
        join.setSender("alice");
        join.setContent("alice joined the group");
        join.setType("JOIN");

        chatController.sendMessage("room", join);

        assertThat(group.getMembers()).containsExactly("alice");
        verify(chatGroupRepository).save(group);
    }
}
