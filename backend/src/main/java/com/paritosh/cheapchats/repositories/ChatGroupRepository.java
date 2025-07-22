package com.paritosh.cheapchats.repositories;

import org.springframework.data.jpa.repository.JpaRepository;

import com.paritosh.cheapchats.models.ChatGroup;

public interface ChatGroupRepository extends JpaRepository<ChatGroup, String> {

    boolean existsByGroupName(String groupName);

    // Find all groups where a user is a member
    java.util.List<ChatGroup> findByMembersContaining(String username);
}
