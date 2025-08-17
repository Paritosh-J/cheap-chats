package com.paritosh.cheapchats.services.impl;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.paritosh.cheapchats.models.ChatGroup;
import com.paritosh.cheapchats.models.ChatMessage;
import com.paritosh.cheapchats.repositories.ChatGroupRepository;
import com.paritosh.cheapchats.repositories.ChatMessageRepository;
import com.paritosh.cheapchats.services.GroupService;

import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class GroupServiceImpl implements GroupService {

    @Autowired
    private ChatGroupRepository chatGroupRepository;

    @Autowired
    private ChatMessageRepository chatMessageRepository;

    @Override
    public ChatGroup createChatGroup(String groupName, String createdBy, int validMinutes) {

        // Validate input parameters
        if (groupName == null || groupName.isEmpty() || validMinutes <= 0 || createdBy == null || createdBy.isEmpty()) {

            log.info("Invalid group creation parameters: {}, {}, {}", groupName, validMinutes, createdBy);
            throw new IllegalArgumentException("Invalid group name, creator or validity period.");

        }

        if (chatGroupRepository.existsByGroupName(groupName)) {
            log.info("Group already exists: {}", groupName);
            throw new IllegalArgumentException("Group with this groupName already exists.");
        }

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

        log.info("inside updateGroupName");

        if (newGroupName == null && newExpiryInMins == null) {
            log.error("invalid newGroupName: {} & expiryMins: {} passed", newGroupName, newExpiryInMins);
            return false;
        }

        ChatGroup oldGroup = chatGroupRepository.findById(groupName).get();
        ChatGroup newGroup = new ChatGroup();

        // Check if the group exists
        if (newGroupName != null && !newGroupName.equals("") && !newGroupName.equals(groupName)) {

            // Check if a group with new name already exists
            if (chatGroupRepository.existsByGroupName(newGroupName)) {

                log.error("Group with name {} already exists", newGroupName);
                throw new IllegalArgumentException("Group with this name already exists");

            }

            // Create new group with updated name
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

            // name updation successfull
            return true;

        } 
        else if (newExpiryInMins != null) {

            // Only update expiry time
            oldGroup.setExpiresIn(String.valueOf(newExpiryInMins));

            // save changes
            chatGroupRepository.save(oldGroup);

            log.info("Updated expiry time for group {}", groupName);

            // expiry time updation successfull
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
        ChatGroup group = chatGroupRepository.findById(groupName).get();
        group.getMembers().remove(targetMember);
        chatGroupRepository.save(group);

        log.info("REMOVED: {} removed from {}", targetMember, groupName);

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

                int currentMins = Integer.parseInt(group.getExpiresIn());

                if (currentMins > 0) {
                    group.setExpiresIn(String.valueOf(currentMins - 1));
                    chatGroupRepository.save(group);
                } else {
                    deleteGroup(group.getGroupName());
                }
            }
        });
    }

}
