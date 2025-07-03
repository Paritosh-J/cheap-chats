package com.paritosh.cheapchats.repositories;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.paritosh.cheapchats.models.ChatMessage;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findByGroupNameOrderByTimestampAsc(String groupName);
} 