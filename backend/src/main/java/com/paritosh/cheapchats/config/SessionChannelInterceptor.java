package com.paritosh.cheapchats.config;

import java.security.Principal;
import java.util.Map;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;

import com.paritosh.cheapchats.services.UserSessionService;

@Component
public class SessionChannelInterceptor implements ChannelInterceptor {

    private static final String SESSION_ID_ATTRIBUTE = "cheapChatsSessionId";

    private final UserSessionService userSessionService;

    public SessionChannelInterceptor(UserSessionService userSessionService) {
        this.userSessionService = userSessionService;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) {
            return message;
        }

        StompCommand command = accessor.getCommand();
        if (command == StompCommand.CONNECT) {
            String sessionId = accessor.getFirstNativeHeader(SessionAuthenticationInterceptor.SESSION_HEADER);
            String username = userSessionService.authenticateAndTouch(sessionId);
            accessor.setUser((Principal) () -> username);
            Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
            if (sessionAttributes != null) {
                sessionAttributes.put(SESSION_ID_ATTRIBUTE, sessionId);
            }
        } else if (command == StompCommand.SEND || command == StompCommand.SUBSCRIBE) {
            Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
            String sessionId = sessionAttributes == null
                    ? null
                    : (String) sessionAttributes.get(SESSION_ID_ATTRIBUTE);
            String username = userSessionService.authenticateAndTouch(sessionId);
            Principal principal = accessor.getUser();
            if (principal == null || !username.equals(principal.getName())) {
                throw new IllegalArgumentException("WebSocket identity does not match the active session");
            }
            String destination = accessor.getDestination();
            if (command == StompCommand.SUBSCRIBE
                    && destination != null
                    && destination.startsWith("/topic/user/")
                    && !destination.equals("/topic/user/" + username)) {
                throw new IllegalArgumentException("Cannot subscribe to another user's private topic");
            }
        }

        return message;
    }
}
