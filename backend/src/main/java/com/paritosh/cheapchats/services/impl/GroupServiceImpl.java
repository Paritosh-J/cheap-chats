package com.paritosh.cheapchats.services.impl;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.paritosh.cheapchats.models.ChatGroup;
import com.paritosh.cheapchats.repositories.ChatGroupRepository;
import com.paritosh.cheapchats.services.GroupService;

import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class GroupServiceImpl implements GroupService {

    @Autowired
    private ChatGroupRepository chatGroupRepository;

    @Override
    public ChatGroup createChatGroup(String groupName, String createdBy, int validMinutes) {

        // Validate input parameters
        if (groupName == null || groupName.isEmpty() || createdBy == null || createdBy.isEmpty() || validMinutes <= 0) {

            log.info("Invalid group creation parameters: {}, {}, {}", groupName, createdBy, validMinutes);
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
        chatGroup.setExpiresAt(LocalDateTime.now().plusMinutes(validMinutes));
        chatGroup.getMembers().add(createdBy);

        // format date-time for logging
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd MMMM yyyy HH:mm a");
        String formattedDate = chatGroup.getExpiresAt().format(formatter);

        // log group creation
        log.info("Group created: {} by {}, expires at: {}", groupName, createdBy, formattedDate);

        // save changes
        return chatGroupRepository.save(chatGroup);

    }

    @Override
    public Optional<ChatGroup> joinChatGroup(String groupName, String userName) {

        Optional<ChatGroup> groupOptional = chatGroupRepository.findById(groupName);

        // if the group exists and is not expired
        groupOptional.ifPresent(group -> {

            // if user is not present & group not expired
            if (!group.getMembers().contains(userName) && group.getExpiresAt().isAfter(LocalDateTime.now())) {

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
    public boolean removeMember(String groupName, String targetUser) {

        log.info("inside groupServiceImpl removeMember");
        Optional<ChatGroup> groupOptional = chatGroupRepository.findById(groupName);

        // Check if the group exists
        if (groupOptional.isPresent()) {
            ChatGroup group = groupOptional.get();

            // Check if user is a member of the group
            if (group.getMembers().contains(targetUser)) {

                log.info("removing {} from {}", targetUser, groupName);

                // remove from member list
                group.getMembers().remove(targetUser);

                // log member removal
                log.info("REMOVED: User {} removed from {}", targetUser, groupName);

                // save changes
                chatGroupRepository.save(group);

                // Successfully removed the member
                return true;
            }
        }

        // User was not a member or group does not exist
        return false;

    }

    @Override
    public java.util.List<ChatGroup> getGroupsForUser(String username) {
        return chatGroupRepository.findByMembersContaining(username);
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

}
