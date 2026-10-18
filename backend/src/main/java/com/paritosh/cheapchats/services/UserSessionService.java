package com.paritosh.cheapchats.services;

import java.time.LocalDateTime;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.paritosh.cheapchats.models.User;
import com.paritosh.cheapchats.repositories.UserRepository;

@Service
public class UserSessionService {

    public static final long SESSION_TIMEOUT_SECONDS = 120;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public UserSessionService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional
    public User login(String requestedUsername, String password, String existingSessionId) {
        String username = requestedUsername == null ? "" : requestedUsername.trim();
        if (username.isEmpty() || username.length() > 10) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username must be between 1 and 10 characters");
        }
        if (password == null || password.isBlank()
                || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Password must contain between 1 and 72 UTF-8 bytes");
        }

        LocalDateTime now = LocalDateTime.now();
        User user = userRepository.findByUserNameForUpdate(username).orElse(null);
        if (user == null) {
            user = new User();
            user.setUserName(username);
            user.setPasswordHash(passwordEncoder.encode(password));
        } else {
            if (user.getPasswordHash() == null) {
                if (existingSessionId == null || !existingSessionId.equals(user.getSessionId())) {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "This username is already registered. Sign in from its original device to set a password.");
                }
                user.setPasswordHash(passwordEncoder.encode(password));
            } else if (!passwordEncoder.matches(password, user.getPasswordHash())) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Incorrect password");
            }
            if (isSessionActive(user, now)) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "This username is already active on another device");
            }
        }

        user.setSessionId(UUID.randomUUID().toString());
        user.setLastActiveAt(now);
        return userRepository.saveAndFlush(user);
    }

    @Transactional
    public String authenticateAndTouch(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            throw unauthorized();
        }

        User user = userRepository.findBySessionId(sessionId).orElseThrow(this::unauthorized);
        LocalDateTime now = LocalDateTime.now();
        if (!isSessionActive(user, now)) {
            throw unauthorized();
        }
        user.setLastActiveAt(now);
        userRepository.save(user);
        return user.getUserName();
    }

    @Transactional
    public void logout(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return;
        }
        userRepository.findBySessionId(sessionId).ifPresent(user -> {
            user.setLastActiveAt(null);
            userRepository.save(user);
        });
    }

    private boolean isSessionActive(User user, LocalDateTime now) {
        return user.getLastActiveAt() != null
                && user.getLastActiveAt().isAfter(now.minusSeconds(SESSION_TIMEOUT_SECONDS));
    }

    private ResponseStatusException unauthorized() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session is missing, expired, or no longer active");
    }
}
