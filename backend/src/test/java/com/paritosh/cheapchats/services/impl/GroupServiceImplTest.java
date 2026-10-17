package com.paritosh.cheapchats.services.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;

import java.util.List;
import java.time.LocalDateTime;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.InOrder;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import com.paritosh.cheapchats.models.ChatGroup;
import com.paritosh.cheapchats.repositories.ChatGroupRepository;
import com.paritosh.cheapchats.repositories.ChatMessageRepository;

@ExtendWith(MockitoExtension.class)
class GroupServiceImplTest {

    @Mock
    private ChatGroupRepository chatGroupRepository;

    @Mock
    private ChatMessageRepository chatMessageRepository;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private GroupServiceImpl groupService;

    @Test
    void expiryQueryUsesCreationTimeAndConfiguredLifetime() {
        ChatGroup group = new ChatGroup();
        group.setGroupName("room");
        group.setExpiresIn("60");
        group.setCreatedAt(LocalDateTime.now().minusMinutes(37));
        group.setExpiresAt(LocalDateTime.now().plusMinutes(60));
        when(chatGroupRepository.findById("room")).thenReturn(Optional.of(group));

        double minutesLeft = groupService.getMinutesUntilExpiry("room");

        assertThat(minutesLeft).isBetween(22.9, 23.0);
        assertThat(group.getExpiresAt()).isBefore(LocalDateTime.now().plusMinutes(24));
    }

    @Test
    void groupCreationPersistsCreationTimeAndLifetimeBasedDeadline() {
        when(chatGroupRepository.existsByGroupName("room")).thenReturn(false);
        when(chatGroupRepository.save(any(ChatGroup.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ChatGroup created = groupService.createChatGroup("room", "user", 60);

        assertThat(created.getCreatedAt()).isNotNull();
        assertThat(created.getExpiresAt()).isEqualTo(created.getCreatedAt().plusMinutes(60));
        assertThat(created.getExpiresIn()).isEqualTo("60");
    }

    @Test
    void expiryDeadlineUsesCreationTimeWhenGeneratingEpochMillis() {
        LocalDateTime createdAt = LocalDateTime.now().minusMinutes(37);
        ChatGroup group = new ChatGroup();
        group.setGroupName("room");
        group.setExpiresIn("60");
        group.setCreatedAt(createdAt);
        group.setExpiresAt(createdAt.plusMinutes(60));
        when(chatGroupRepository.findById("room")).thenReturn(Optional.of(group));

        long expiryAt = groupService.getExpiryAtEpochMillis("room");

        assertThat(expiryAt).isEqualTo(
                createdAt.plusMinutes(60)
                        .atZone(java.time.ZoneId.systemDefault())
                        .toInstant()
                        .toEpochMilli());
    }

    @Test
    void expiryQueryInitializesDeadlineForLegacyGroups() {
        ChatGroup group = new ChatGroup();
        group.setGroupName("legacy-room");
        group.setExpiresIn("12");
        when(chatGroupRepository.findById("legacy-room")).thenReturn(Optional.of(group));
        when(chatGroupRepository.save(any(ChatGroup.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        double minutesLeft = groupService.getMinutesUntilExpiry("legacy-room");

        assertThat(minutesLeft).isBetween(11.9, 12.0);
        assertThat(group.getExpiresAt()).isNotNull();
        verify(chatGroupRepository).save(group);
    }

    @Test
    void expiryCanBeUpdatedWithoutRenamingGroup() {
        LocalDateTime createdAt = LocalDateTime.now().minusMinutes(20);
        ChatGroup group = new ChatGroup();
        group.setGroupName("room");
        group.setExpiresIn("60");
        group.setCreatedAt(createdAt);
        group.setExpiresAt(createdAt.plusMinutes(60));
        when(chatGroupRepository.findById("room")).thenReturn(Optional.of(group));
        when(chatGroupRepository.save(any(ChatGroup.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        boolean updated = groupService.updateGroupInfo("room", "", 45);

        assertThat(updated).isTrue();
        assertThat(group.getGroupName()).isEqualTo("room");
        assertThat(group.getExpiresIn()).isEqualTo("45");
        assertThat(group.getCreatedAt()).isEqualTo(createdAt);
        assertThat(group.getExpiresAt()).isEqualTo(createdAt.plusMinutes(45));
        verify(chatGroupRepository).save(group);
    }

    @Test
    void removingMemberRecordsTheReadOnlyHistoryCutoff() {
        ChatGroup group = new ChatGroup();
        group.setGroupName("room");
        group.getMembers().add("alice");
        when(chatGroupRepository.findById("room")).thenReturn(Optional.of(group));
        when(chatGroupRepository.save(any(ChatGroup.class))).thenAnswer(invocation -> invocation.getArgument(0));

        groupService.removeMember("room", "alice");

        assertThat(group.getMembers()).doesNotContain("alice");
        assertThat(group.getKickedMembers()).containsKey("alice");
        assertThat(group.getKickedMembers().get("alice")).isNotNull();
        verify(chatGroupRepository).save(group);
    }

    @Test
    void removedMemberCanRejoinAndRemovalMarkerIsCleared() {
        ChatGroup group = new ChatGroup();
        group.setGroupName("room");
        group.setExpiresIn("60");
        group.setCreatedAt(LocalDateTime.now());
        group.setExpiresAt(LocalDateTime.now().plusMinutes(60));
        group.getKickedMembers().put("alice", LocalDateTime.now().minusMinutes(1));
        when(chatGroupRepository.findById("room")).thenReturn(Optional.of(group));

        Optional<ChatGroup> result = groupService.joinChatGroup("room", "alice");

        assertThat(result).contains(group);
        assertThat(group.getMembers()).contains("alice");
        assertThat(group.getKickedMembers()).doesNotContainKey("alice");
        verify(chatGroupRepository).save(group);
    }

    @Test
    void kickedMemberStillSeesLiveGroupInTheirGroupList() {
        ChatGroup group = new ChatGroup();
        group.setGroupName("room");
        group.setExpiresIn("60");
        group.setCreatedAt(LocalDateTime.now());
        group.setExpiresAt(LocalDateTime.now().plusMinutes(60));
        group.getKickedMembers().put("alice", LocalDateTime.now().minusMinutes(1));
        when(chatGroupRepository.findAll()).thenReturn(List.of(group));

        List<ChatGroup> groups = groupService.getGroupsForUser("alice");

        assertThat(groups).containsExactly(group);
    }

    @Test
    void deletingGroupRemovesMessagesBeforeGroupRecord() {
        groupService.deleteGroup("room");

        InOrder order = inOrder(chatMessageRepository, chatGroupRepository);
        order.verify(chatMessageRepository).deleteByGroupName("room");
        order.verify(chatGroupRepository).deleteById("room");
    }

    @Test
    void expiredGroupCleanupDeletesMessagesAndNotifiesSubscribers() {
        ChatGroup group = new ChatGroup();
        group.setGroupName("room");
        group.setExpired(true);
        when(chatGroupRepository.findAll()).thenReturn(List.of(group));

        groupService.deleteExpiredGroups();

        verify(chatMessageRepository).deleteByGroupName("room");
        verify(chatGroupRepository).deleteById("room");
        verify(messagingTemplate).convertAndSend(
                org.mockito.ArgumentMatchers.eq("/topic/group/room"),
                any(com.paritosh.cheapchats.dto.ChatMessageDto.class));
    }

    @Test
    void creatingReusedNamePurgesExpiredGroupAndOldMessagesFirst() {
        ChatGroup expiredGroup = new ChatGroup();
        expiredGroup.setGroupName("room");
        expiredGroup.setExpired(true);
        when(chatGroupRepository.findAll()).thenReturn(List.of(expiredGroup));
        when(chatGroupRepository.existsByGroupName("room")).thenReturn(false);
        when(chatGroupRepository.save(any(ChatGroup.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ChatGroup created = groupService.createChatGroup("room", "alice", 60);

        assertThat(created.getGroupName()).isEqualTo("room");
        InOrder order = inOrder(chatMessageRepository, chatGroupRepository);
        order.verify(chatMessageRepository).deleteByGroupName("room");
        order.verify(chatGroupRepository).deleteById("room");
        order.verify(chatGroupRepository).save(created);
    }
}
