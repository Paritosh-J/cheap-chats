package com.paritosh.cheapchats.utils;

import com.paritosh.cheapchats.repositories.ChatGroupRepository;

import lombok.extern.slf4j.Slf4j;

@Slf4j
public class ChatGroupUtility {

    /**
     * Validate parameters for creating a chat group
     * @param groupName Chat group name
     * @param validMinutes Validity period in minutes
     * @param createdBy Creator's username
     * @param chatGroupRepository Chat group repository for database operations
     */
    public static void validateGroupCreation(String groupName, int validMinutes, String createdBy, ChatGroupRepository chatGroupRepository) {
        // Validate input parameters - check for null / negative / empty values
        if (validMinutes <= 0 || createdBy == null || createdBy.trim().isEmpty()) {
            log.warn("Invalid group creation parameters: {}, {}, {}", groupName, validMinutes, createdBy);
            throw new IllegalArgumentException("Invalid group name, creator or validity period.");
        }

        validateGroupName(groupName, chatGroupRepository);
    }

    /**
     * Validate chat group name
     * @param groupName Chat group name
     * @param chatGroupRepository Chat group repository for database operations
     */
    public static void validateGroupName(String groupName, ChatGroupRepository chatGroupRepository) {
        if (groupName == null || groupName.trim().isEmpty())
            throw new IllegalArgumentException("Group name cannot be empty.");

        // validate group name length (<= 30 characters)
        if (groupName.length() > 30) {
            log.warn("Group name length invalid: {}", groupName);
            throw new IllegalArgumentException("Group name must be less than or equal to 30 characters.");
        }

        // check if group with same name already exists
        if (chatGroupRepository.existsByGroupName(groupName)) {
            log.warn("Group already exists: {}", groupName);
            throw new IllegalArgumentException("Group with this name already exists.");
        }
    }
}
