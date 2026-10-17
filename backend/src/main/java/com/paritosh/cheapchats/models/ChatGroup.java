package com.paritosh.cheapchats.models;

import java.util.ArrayList;
import java.util.List;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapKeyColumn;
import lombok.Data;

@Entity
@Data
public class ChatGroup {

    @Id
    @Column(name = "group_name")
    private String groupName;
    private String createdBy;
    private String expiresIn;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;
    private boolean isExpired;

    @ElementCollection
    @CollectionTable(
            name = "chat_group_members",
            joinColumns = @JoinColumn(name = "group_name")
    )
    @Column(name = "members")
    private List<String> members = new ArrayList<>();

    @ElementCollection
    @CollectionTable(
            name = "chat_group_kicked_members",
            joinColumns = @JoinColumn(name = "group_name")
    )
    @MapKeyColumn(name = "username")
    @Column(name = "removed_at")
    private Map<String, LocalDateTime> kickedMembers = new HashMap<>();
}
