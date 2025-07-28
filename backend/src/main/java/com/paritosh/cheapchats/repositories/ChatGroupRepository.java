package com.paritosh.cheapchats.repositories;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.paritosh.cheapchats.models.ChatGroup;

public interface ChatGroupRepository extends JpaRepository<ChatGroup, String> {

    boolean existsByGroupName(String groupName);

    // Find all groups where a user is a member
    List<ChatGroup> findByMembersContaining(String userName);
}
