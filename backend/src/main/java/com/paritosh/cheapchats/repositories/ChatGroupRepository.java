package com.paritosh.cheapchats.repositories;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.paritosh.cheapchats.models.ChatGroup;

public interface ChatGroupRepository extends JpaRepository<ChatGroup, String> {

    // Find all groups with name: groupName
    boolean existsByGroupName(String groupName);

    // Find all groups which are expired and have member: userName
    List<ChatGroup> findByIsExpiredFalseAndMembersContaining(String username);
}
