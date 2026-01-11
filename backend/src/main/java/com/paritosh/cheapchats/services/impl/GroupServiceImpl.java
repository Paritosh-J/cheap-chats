package com.paritosh.cheapchats.services.impl;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import com.paritosh.cheapchats.utils.ChatGroupUtility;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.paritosh.cheapchats.models.ChatGroup;
import com.paritosh.cheapchats.models.ChatMessage;
import com.paritosh.cheapchats.repositories.ChatGroupRepository;
import com.paritosh.cheapchats.repositories.ChatMessageRepository;
import com.paritosh.cheapchats.services.GroupService;
import org.springframework.transaction.annotation.Transactional;

import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
@Transactional
public class GroupServiceImpl implements GroupService {

    @Autowired
    private ChatGroupRepository chatGroupRepository;

    @Autowired
    private ChatMessageRepository chatMessageRepository;

    @Override
    public ChatGroup createChatGroup(String groupName, String createdBy, int validMinutes) {
        // validate group name
        ChatGroupUtility.validateGroupCreation(groupName, validMinutes, createdBy, chatGroupRepository);

        // create a new chat group
        ChatGroup chatGroup = new ChatGroup();

        // set properties
        chatGroup.setGroupName(groupName);
        chatGroup.setCreatedBy(createdBy);
        chatGroup.setExpiresIn(String.valueOf(validMinutes));
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

        // if the group exists and is not expired
        groupOptional.ifPresent(group -> {

            // if user is not present & group not expired
            if (!group.getMembers().contains(userName) && !group.isExpired()) {

                // add user if they are not already a member
                group.getMembers().add(userName);

                // log user joining
                log.info("JOIN: User {} joined group: {}", userName, groupName);

                // save changes
                chatGroupRepository.save(group);

            }
        });

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

        // Check if the group exists
        if (!newGroupName.equals(groupName)) {

            ChatGroupUtility.validateGroupName(newGroupName, chatGroupRepository);

            // Create new group with updated name
            ChatGroup newGroup = new ChatGroup();
            newGroup.setGroupName(newGroupName);
            newGroup.setCreatedBy(oldGroup.getCreatedBy());
            newGroup.setMembers(new ArrayList<>(oldGroup.getMembers()));
            newGroup.setExpired(false);
            newGroup.setExpiresIn(newExpiryInMins != null ? String.valueOf(newExpiryInMins) : oldGroup.getExpiresIn());

            // Save new group
            chatGroupRepository.save(newGroup);

            // Update messages to point to new group
            List<ChatMessage> messages = chatMessageRepository.findByGroupNameOrderByTimestampAsc(groupName);
            for (ChatMessage message : messages) {
                message.setGroupName(newGroupName);
            }
            chatMessageRepository.saveAll(messages);

            // Delete old group
            chatGroupRepository.delete(oldGroup);

            log.info("Group successfully renamed from {} to {}", groupName, newGroupName);

            // name updation successfully
            return true;

        } else if (newExpiryInMins != null) {

            if (newExpiryInMins <= 0) {
                throw new IllegalArgumentException("Expiry time must be positive.");
            }

            // Only update expiry time
            oldGroup.setExpiresIn(String.valueOf(newExpiryInMins));

            // save changes
            chatGroupRepository.save(oldGroup);

            log.info("Updated expiry time for group {}", groupName);

            // expiry time updation successfully
            return true;
        }

        log.warn("group {} already exists", groupName);

        // group already exists
        return false;
    }

    @Override
    public void removeMember(String groupName, String targetMember) {

        log.info("inside removeMember");

        // get group and remove user
        chatGroupRepository.findById(groupName).ifPresent(group -> {
            if (group.getMembers().remove(targetMember)) {
                chatGroupRepository.save(group);
                log.info("REMOVED: {} removed from {}", targetMember, groupName);
            }
        });
    }

    @Override
    public List<ChatGroup> getGroupsForUser(String userName) {
        return chatGroupRepository.findByIsExpiredFalseAndMembersContaining(userName);
    }

    @Override
    public ChatGroup getGroupByName(String groupName) {
        return chatGroupRepository.findById(groupName).orElse(null);
    }

    @Override
    public void deleteGroup(String groupName) {
        chatGroupRepository.deleteById(groupName);
        log.info("Group deleted: {}", groupName);
    }

    @Override
    public void deleteExpiredGroups() {

        log.info("checking for expired groups");

        List<ChatGroup> expiredGroups = chatGroupRepository.findAll().stream()
                .filter(ChatGroup::isExpired)
                .toList();

        for (ChatGroup group : expiredGroups) {
            log.info("Deleting expired groups: {}", group.getGroupName());
            deleteGroup(group.getGroupName());
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
