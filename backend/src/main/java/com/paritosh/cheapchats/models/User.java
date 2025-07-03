package com.paritosh.cheapchats.models;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

@Entity
@Data
@Table(name = "users")
public class User {

    @Id
    @Column(name = "username", nullable = false, unique = true)
    private String userName;
    @Column(name = "session_id", nullable = false, unique = true)
    private String sessionId;
}
