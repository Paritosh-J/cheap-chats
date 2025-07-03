package com.paritosh.cheapchats.repositories;

import org.springframework.data.jpa.repository.JpaRepository;

import com.paritosh.cheapchats.models.User;

public interface UserRepository extends JpaRepository<User, String> {
    
}
