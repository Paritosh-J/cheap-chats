package com.paritosh.cheapchats.services;

import java.util.Optional;

import com.paritosh.cheapchats.models.ChatGroup;

public interface GroupService {

    ChatGroup createChatGroup(String groupName, String userName, int validMinutes) throws Exception;

    Optional<ChatGroup> joinChatGroup(String groupName, String userName);

    boolean leaveChatGroup(String groupName, String userName);

    boolean updateGroupInfo(String groupName, String newName, Integer newExpiryInMins) throws Exception;

    void removeMember(String groupName, String targetMember);

    java.util.List<ChatGroup> getGroupsForUser(String username);
    
    ChatGroup getGroupByName(String groupName);
    
    void deleteGroup(String groupName);

    void deleteExpiredGroups();

    void updateExpiryTimes();
}
