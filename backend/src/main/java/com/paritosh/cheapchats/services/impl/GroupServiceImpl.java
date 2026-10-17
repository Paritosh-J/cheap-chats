package com.paritosh.cheapchats.services.impl;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Objects;
import java.util.HashMap;

import com.paritosh.cheapchats.utils.ChatGroupUtility;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import com.paritosh.cheapchats.models.ChatGroup;
import com.paritosh.cheapchats.models.ChatMessage;
import com.paritosh.cheapchats.dto.ChatMessageDto;
import com.paritosh.cheapchats.repositories.ChatGroupRepository;
import com.paritosh.cheapchats.repositories.ChatMessageRepository;
import com.paritosh.cheapchats.services.GroupService;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.scheduling.annotation.Scheduled;

import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
@Transactional
public class GroupServiceImpl implements GroupService {

    @Autowired
    private ChatGroupRepository chatGroupRepository;

    @Autowired
    private ChatMessageRepository chatMessageRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Override
    public ChatGroup createChatGroup(String groupName, String createdBy, int validMinutes) {
        deleteExpiredGroups();

        // validate group name
        ChatGroupUtility.validateGroupCreation(groupName, validMinutes, createdBy, chatGroupRepository);

        // create a new chat group
        ChatGroup chatGroup = new ChatGroup();

        // set properties
        chatGroup.setGroupName(groupName);
        chatGroup.setCreatedBy(createdBy);
        chatGroup.setExpiresIn(String.valueOf(validMinutes));
        LocalDateTime createdAt = LocalDateTime.now();
        chatGroup.setCreatedAt(createdAt);
        chatGroup.setExpiresAt(createdAt.plusMinutes(validMinutes));
        chatGroup.setExpired(false);
        chatGroup.getMembers().add(createdBy);

        // log group creation
        log.info("Group created: {} by {}, expires at: {}", groupName, createdBy, validMinutes);

        // save changes
        return chatGroupRepository.save(chatGroup);

    }

    @Override
    public Optional<ChatGroup> joinChatGroup(String groupName, String userName) {

        Optional<ChatGroup> groupOptional = chatGroupRepository.findById(groupName);
        if (groupOptional.isEmpty()) {
            return Optional.empty();
        }

        ChatGroup group = groupOptional.get();
        if (group.isExpired() || !getExpiryDate(group).isAfter(LocalDateTime.now())) {
            return Optional.empty();
        }

        boolean wasMember = group.getMembers().contains(userName);
        boolean wasKicked = group.getKickedMembers().remove(userName) != null;
        if (!wasMember) {
            group.getMembers().add(userName);
        }
        if (wasKicked || !wasMember) {
            log.info("JOIN: User {} joined group: {}", userName, groupName);
            chatGroupRepository.save(group);
        }
        return groupOptional;

    }

    @Override
    public boolean leaveChatGroup(String groupName, String userName) {

        Optional<ChatGroup> groupOptional = chatGroupRepository.findById(groupName);

        // Check if the group exists
        if (groupOptional.isPresent()) {

            ChatGroup group = groupOptional.get();

            // Check if user is a member of the group
            if (group.getMembers().contains(userName)) {

                // Remove the user from the group
                group.getMembers().remove(userName);

                // log user leaving
                log.info("LEFT: User {} left group {}", userName, groupName);

                // save changes
                chatGroupRepository.save(group);

                // Successfully left the group
                return true;
            }
        }

        // User was not a member or group does not exist
        return false;

    }

    @Override
    public boolean updateGroupInfo(String groupName, String newGroupName, Integer newExpiryInMins) {

        log.info("Updating group info for: {}", groupName);

        ChatGroup oldGroup = chatGroupRepository.findById(groupName)
                .orElseThrow(() -> new IllegalArgumentException("Group not found: " + groupName));

        String requestedGroupName = newGroupName == null ? "" : newGroupName.trim();
        boolean renameGroup = !requestedGroupName.isEmpty()
                && !requestedGroupName.equals(groupName);

        if (newExpiryInMins != null && newExpiryInMins <= 0) {
            throw new IllegalArgumentException("Expiry time must be positive.");
        }

        if (renameGroup) {

            ChatGroupUtility.validateGroupName(requestedGroupName, chatGroupRepository);

            LocalDateTime currentExpiry = getExpiryDate(oldGroup);

            // Create new group with updated name
            ChatGroup newGroup = new ChatGroup();
            newGroup.setGroupName(requestedGroupName);
            newGroup.setCreatedBy(oldGroup.getCreatedBy());
            newGroup.setMembers(new ArrayList<>(oldGroup.getMembers()));
            newGroup.setExpired(oldGroup.isExpired());
            LocalDateTime createdAt = getCreationDate(oldGroup);
            newGroup.setCreatedAt(createdAt);
            newGroup.setKickedMembers(new HashMap<>(oldGroup.getKickedMembers()));
            newGroup.setExpiresIn(newExpiryInMins != null ? String.valueOf(newExpiryInMins) : oldGroup.getExpiresIn());
            newGroup.setExpiresAt(newExpiryInMins != null
                    ? createdAt.plusMinutes(newExpiryInMins)
                    : currentExpiry);

            // Save new group
            chatGroupRepository.save(newGroup);

            // Update messages to point to new group
            List<ChatMessage> messages = chatMessageRepository.findByGroupNameOrderByTimestampAsc(groupName);
            for (ChatMessage message : messages) {
                message.setGroupName(requestedGroupName);
            }
            chatMessageRepository.saveAll(messages);

            // Delete old group
            chatGroupRepository.delete(oldGroup);

            log.info("Group successfully renamed from {} to {}", groupName, requestedGroupName);

            // name updation successfully
            return true;

        } else if (newExpiryInMins != null) {
            LocalDateTime createdAt = getCreationDate(oldGroup);
            oldGroup.setExpiresIn(String.valueOf(newExpiryInMins));
            oldGroup.setCreatedAt(createdAt);
            oldGroup.setExpiresAt(createdAt.plusMinutes(newExpiryInMins));

            chatGroupRepository.save(oldGroup);

            log.info("Updated expiry time for group {}", groupName);
            return true;
        }

        return false;
    }

    @Override
    public LocalDateTime removeMember(String groupName, String targetMember) {

        log.info("inside removeMember");

        return chatGroupRepository.findById(groupName).map(group -> {
            if (group.getMembers().remove(targetMember)) {
                LocalDateTime removedAt = LocalDateTime.now();
                group.getKickedMembers().put(targetMember, removedAt);
                chatGroupRepository.save(group);
                log.info("REMOVED: {} removed from {}", targetMember, groupName);
                return removedAt;
            }
            return null;
        }).orElse(null);
    }

    @Override
    public List<ChatGroup> getGroupsForUser(String userName) {
        deleteExpiredGroups();
        return chatGroupRepository.findAll().stream()
                .filter(group -> !group.isExpired())
                .filter(group -> group.getMembers().contains(userName)
                        || group.getKickedMembers().containsKey(userName))
                .toList();
    }

    @Override
    public ChatGroup getGroupByName(String groupName) {
        return chatGroupRepository.findById(groupName).orElse(null);
    }

    @Override
    public double getMinutesUntilExpiry(String groupName) {
        ChatGroup group = chatGroupRepository.findById(groupName)
                .orElseThrow(() -> new IllegalArgumentException("Group not found: " + groupName));

        LocalDateTime expiryDate = getExpiryDate(group);
        double minutesLeft = Duration.between(LocalDateTime.now(), expiryDate).toMillis() / 60_000.0;
        return Math.max(0, minutesLeft);
    }

    @Override
    public long getExpiryAtEpochMillis(String groupName) {
        ChatGroup group = chatGroupRepository.findById(groupName)
                .orElseThrow(() -> new IllegalArgumentException("Group not found: " + groupName));
        return getExpiryDate(group)
                .atZone(ZoneId.systemDefault())
                .toInstant()
                .toEpochMilli();
    }

    @Override
    public long getCreatedAtEpochMillis(String groupName) {
        ChatGroup group = chatGroupRepository.findById(groupName)
                .orElseThrow(() -> new IllegalArgumentException("Group not found: " + groupName));
        getExpiryDate(group);
        return group.getCreatedAt()
                .atZone(ZoneId.systemDefault())
                .toInstant()
                .toEpochMilli();
    }

    @Override
    public int getExpiryDurationMinutes(String groupName) {
        ChatGroup group = chatGroupRepository.findById(groupName)
                .orElseThrow(() -> new IllegalArgumentException("Group not found: " + groupName));
        return getExpiryMinutes(group);
    }

    private LocalDateTime getExpiryDate(ChatGroup group) {
        int expiryMinutes = getExpiryMinutes(group);
        boolean creationDateMissing = group.getCreatedAt() == null;
        LocalDateTime createdAt = resolveCreationDate(group, expiryMinutes);
        LocalDateTime expiryDate = createdAt.plusMinutes(expiryMinutes);

        if (creationDateMissing || !Objects.equals(expiryDate, group.getExpiresAt())) {
            group.setCreatedAt(createdAt);
            group.setExpiresAt(expiryDate);
            chatGroupRepository.save(group);
        }
        return expiryDate;
    }

    private LocalDateTime getCreationDate(ChatGroup group) {
        return resolveCreationDate(group, getExpiryMinutes(group));
    }

    private LocalDateTime resolveCreationDate(ChatGroup group, int expiryMinutes) {
        if (group.getCreatedAt() != null) {
            return group.getCreatedAt();
        }

        LocalDateTime firstMessageTime = chatMessageRepository
                .findByGroupNameOrderByTimestampAsc(group.getGroupName())
                .stream()
                .map(ChatMessage::getTimestamp)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);

        if (firstMessageTime != null) {
            return firstMessageTime;
        }

        if (group.getExpiresAt() != null) {
            return group.getExpiresAt().minusMinutes(expiryMinutes);
        }

        return LocalDateTime.now();
    }

    private int getExpiryMinutes(ChatGroup group) {
        try {
            int expiryMinutes = Integer.parseInt(group.getExpiresIn());
            if (expiryMinutes <= 0) {
                throw new NumberFormatException("Expiry duration must be positive");
            }
            return expiryMinutes;
        } catch (NumberFormatException e) {
            throw new IllegalStateException(
                    "Invalid expiry duration for group " + group.getGroupName(), e);
        }
    }

    @Override
    public void deleteGroup(String groupName) {
        chatMessageRepository.deleteByGroupName(groupName);
        chatGroupRepository.deleteById(groupName);
        log.info("Group deleted: {}", groupName);
    }

    @Override
    @Scheduled(fixedDelay = 10000)
    public void deleteExpiredGroups() {

        LocalDateTime now = LocalDateTime.now();
        List<ChatGroup> expiredGroups = chatGroupRepository.findAll().stream()
                .filter(group -> group.isExpired() || !getExpiryDate(group).isAfter(now))
                .toList();

        for (ChatGroup group : expiredGroups) {
            log.info("Deleting expired groups: {}", group.getGroupName());
            deleteGroup(group.getGroupName());
            ChatMessageDto event = new ChatMessageDto();
            event.setType("GROUP_EXPIRED");
            event.setGroupName(group.getGroupName());
            event.setContent("This group has expired");
            event.setTimestamp(now.toString());
            messagingTemplate.convertAndSend("/topic/group/" + group.getGroupName(), event);
        }
    }

    @Override
    public void updateExpiryTimes() {
        chatGroupRepository.findAll().forEach(group -> {
            if (!group.isExpired()) {

                try {
                    int currentMins = Integer.parseInt(group.getExpiresIn());

                    if (currentMins > 0) {
                        group.setExpiresIn(String.valueOf(currentMins - 1));
                        chatGroupRepository.save(group);
                    } else {
                        deleteGroup(group.getGroupName());
                    }
                } catch (NumberFormatException e) {
                    log.error("Invalid expiry format for group {}: {}", group.getGroupName(), group.getExpiresIn());
                }
            }
        });
    }

}
