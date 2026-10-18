package com.paritosh.cheapchats.repositories;

import java.util.Optional;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.paritosh.cheapchats.models.User;

public interface UserRepository extends JpaRepository<User, String> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.userName = :username")
    Optional<User> findByUserNameForUpdate(@Param("username") String username);

    Optional<User> findBySessionId(String sessionId);
}
