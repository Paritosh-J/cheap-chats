package com.paritosh.cheapchats.services;

import java.util.Optional;

import com.paritosh.cheapchats.models.ChatGroup;

public interface GroupService {

    ChatGroup createChatGroup(String groupName, String userName, int validMinutes);

    Optional<ChatGroup> joinChatGroup(String groupName, String userName);

    boolean leaveChatGroup(String groupName, String userName);

    boolean removeMember(String groupName, String requester, String targetUser);
}
