package com.paritosh.cheapchats.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Map;
import java.time.LocalDateTime;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;

import com.paritosh.cheapchats.dto.ChatMessageDto;
import com.paritosh.cheapchats.models.ChatGroup;
import com.paritosh.cheapchats.repositories.ChatGroupRepository;
import com.paritosh.cheapchats.repositories.UserRepository;
import com.paritosh.cheapchats.services.GroupService;

@ExtendWith(MockitoExtension.class)
class GroupControllerTest {

    @Mock
    private GroupService groupService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ChatGroupRepository chatGroupRepository;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private GroupController groupController;

    @Test
    void settingsUpdateBroadcastsNewGroupNameAndDeadline() throws Exception {
        when(groupService.updateGroupInfo("old-room", "new-room", 45)).thenReturn(true);
        when(groupService.getExpiryAtEpochMillis("new-room")).thenReturn(1_800_000_000_000L);

        Map<String, Object> response = groupController.updateGroupInfo(
                "old-room",
                "{\"newGroupName\":\"new-room\",\"newExpiryMinutes\":45}",
                "admin");

        assertThat(response).containsEntry("updated", true).containsEntry("groupName", "new-room");
        ArgumentCaptor<ChatMessageDto> eventCaptor = ArgumentCaptor.forClass(ChatMessageDto.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/group/old-room"), eventCaptor.capture());
        verify(messagingTemplate).convertAndSend(eq("/topic/group/new-room"), any(ChatMessageDto.class));
        assertThat(eventCaptor.getValue().getType()).isEqualTo("GROUP_UPDATED");
        assertThat(eventCaptor.getValue().getSender()).isEqualTo("admin");
        assertThat(eventCaptor.getValue().getGroupName()).isEqualTo("new-room");
        assertThat(eventCaptor.getValue().getExpiresAtEpochMillis()).isEqualTo(1_800_000_000_000L);
    }

    @Test
    void expiryDeletionBroadcastsToCurrentGroupSubscribers() {
        ChatGroup group = new ChatGroup();
        group.setGroupName("room");
        group.setCreatedBy("admin");
        when(groupService.getGroupByName("room")).thenReturn(group);
        when(groupService.getMinutesUntilExpiry("room")).thenReturn(0.0);

        ResponseEntity<?> response = groupController.deleteGroup("room", "member");

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        ArgumentCaptor<ChatMessageDto> eventCaptor = ArgumentCaptor.forClass(ChatMessageDto.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/group/room"), eventCaptor.capture());
        assertThat(eventCaptor.getValue().getType()).isEqualTo("GROUP_EXPIRED");
        verify(groupService).deleteGroup("room");
    }

    @Test
    void removingMemberBroadcastsKickedOutEvent() {
        LocalDateTime removedAt = LocalDateTime.now();
        when(groupService.removeMember("room", "alice")).thenReturn(removedAt);

        ResponseEntity<?> response = groupController.removeMember("room", "alice");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        ArgumentCaptor<ChatMessageDto> eventCaptor = ArgumentCaptor.forClass(ChatMessageDto.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/group/room"), eventCaptor.capture());
        assertThat(eventCaptor.getValue().getType()).isEqualTo("KICKED_OUT");
        assertThat(eventCaptor.getValue().getSender()).isEqualTo("alice");
        assertThat(eventCaptor.getValue().getTimestamp()).isEqualTo(removedAt.toString());
    }
}
