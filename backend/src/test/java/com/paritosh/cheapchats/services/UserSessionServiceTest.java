package com.paritosh.cheapchats.services;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import com.paritosh.cheapchats.models.User;
import com.paritosh.cheapchats.repositories.UserRepository;

@ExtendWith(MockitoExtension.class)
class UserSessionServiceTest {

    private static final BCryptPasswordEncoder PASSWORD_ENCODER = new BCryptPasswordEncoder();

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserSessionService userSessionService;

    @Test
    void loginCreatesUniqueActiveSession() {
        when(userRepository.findByUserNameForUpdate("alice")).thenReturn(Optional.empty());
        when(userRepository.saveAndFlush(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User user = userSessionService.login(" alice ", "secret-pass", null);

        assertThat(user.getUserName()).isEqualTo("alice");
        assertThat(user.getSessionId()).isNotBlank();
        assertThat(PASSWORD_ENCODER.matches("secret-pass", user.getPasswordHash())).isTrue();
        assertThat(user.getLastActiveAt()).isNotNull();
    }

    @Test
    void loginRejectsUsernameWithActiveSession() {
        User existing = new User();
        existing.setUserName("alice");
        existing.setSessionId("active-session");
        existing.setPasswordHash(PASSWORD_ENCODER.encode("secret-pass"));
        existing.setLastActiveAt(LocalDateTime.now());
        when(userRepository.findByUserNameForUpdate("alice")).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> userSessionService.login("alice", "secret-pass", "active-session"))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(error -> ((ResponseStatusException) error).getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);
        verify(userRepository, never()).saveAndFlush(any(User.class));
    }

    @Test
    void loginRejectsExistingUsernameWithoutItsSavedSession() {
        User existing = new User();
        existing.setUserName("alice");
        existing.setSessionId("saved-session");
        existing.setLastActiveAt(null);
        when(userRepository.findByUserNameForUpdate("alice")).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> userSessionService.login("alice", "secret-pass", null))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(error -> ((ResponseStatusException) error).getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);
        verify(userRepository, never()).saveAndFlush(any(User.class));
    }

    @Test
    void loginResumesExpiredSessionWithCorrectPasswordAndRotatesToken() {
        User existing = new User();
        existing.setUserName("alice");
        existing.setSessionId("saved-session");
        existing.setPasswordHash(PASSWORD_ENCODER.encode("secret-pass"));
        existing.setLastActiveAt(LocalDateTime.now().minusSeconds(UserSessionService.SESSION_TIMEOUT_SECONDS + 1));
        when(userRepository.findByUserNameForUpdate("alice")).thenReturn(Optional.of(existing));
        when(userRepository.saveAndFlush(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User user = userSessionService.login("alice", "secret-pass", "saved-session");

        assertThat(user.getSessionId()).isNotEqualTo("saved-session");
        assertThat(user.getLastActiveAt()).isAfter(LocalDateTime.now().minusSeconds(1));
    }

    @Test
    void legacyAccountCanSetPasswordOnlyWithOriginalInactiveSessionToken() {
        User existing = new User();
        existing.setUserName("alice");
        existing.setSessionId("saved-session");
        existing.setLastActiveAt(null);
        when(userRepository.findByUserNameForUpdate("alice")).thenReturn(Optional.of(existing));
        when(userRepository.saveAndFlush(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User user = userSessionService.login("alice", "secret-pass", "saved-session");

        assertThat(PASSWORD_ENCODER.matches("secret-pass", user.getPasswordHash())).isTrue();
        assertThat(user.getSessionId()).isNotEqualTo("saved-session");
    }

    @Test
    void loginRejectsIncorrectPassword() {
        User existing = new User();
        existing.setUserName("alice");
        existing.setSessionId("saved-session");
        existing.setPasswordHash(PASSWORD_ENCODER.encode("correct-pass"));
        existing.setLastActiveAt(null);
        when(userRepository.findByUserNameForUpdate("alice")).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> userSessionService.login("alice", "wrong-pass", null))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(error -> ((ResponseStatusException) error).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
        verify(userRepository, never()).saveAndFlush(any(User.class));
    }

    @Test
    void inactiveSessionCannotBeReactivatedWithoutLoggingIn() {
        User existing = new User();
        existing.setUserName("alice");
        existing.setSessionId("saved-session");
        existing.setLastActiveAt(null);
        when(userRepository.findBySessionId("saved-session")).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> userSessionService.authenticateAndTouch("saved-session"))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(error -> ((ResponseStatusException) error).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(existing.getLastActiveAt()).isNull();
        verify(userRepository, never()).save(existing);
    }

    @Test
    void logoutMarksSessionInactiveButPreservesSavedToken() {
        User existing = new User();
        existing.setUserName("alice");
        existing.setSessionId("active-session");
        existing.setLastActiveAt(LocalDateTime.now());
        when(userRepository.findBySessionId("active-session")).thenReturn(Optional.of(existing));

        userSessionService.logout("active-session");

        assertThat(existing.getSessionId()).isEqualTo("active-session");
        assertThat(existing.getLastActiveAt()).isNull();
        verify(userRepository).save(existing);
    }
}
