package com.paritosh.cheapchats.models;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import lombok.Data;

@Entity
@Data
public class ChatGroup {

    @Id
    @Column(name = "group_name")
    private String groupName;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;

    @ElementCollection
    @CollectionTable(
            name = "chat_group_members",
            joinColumns = @JoinColumn(name = "group_name")
    )
    @Column(name = "members")
    private List<String> members = new ArrayList<>();
}
