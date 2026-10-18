package com.paritosh.cheapchats.config;

import java.io.IOException;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.HandlerInterceptor;

import com.paritosh.cheapchats.services.UserSessionService;

@Component
public class SessionAuthenticationInterceptor implements HandlerInterceptor {

    public static final String SESSION_HEADER = "X-Session-Id";
    public static final String USERNAME_ATTRIBUTE = "authenticatedUsername";

    private final UserSessionService userSessionService;

    public SessionAuthenticationInterceptor(UserSessionService userSessionService) {
        this.userSessionService = userSessionService;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws IOException {
        String username;
        try {
            username = userSessionService.authenticateAndTouch(request.getHeader(SESSION_HEADER));
        } catch (ResponseStatusException exception) {
            if (exception.getStatusCode().value() == HttpStatus.UNAUTHORIZED.value()) {
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, exception.getReason());
                return false;
            }
            throw exception;
        }

        if (!matchesIdentity(request.getParameter("username"), username)
                || !matchesIdentity(request.getParameter("createdBy"), username)) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "Request identity does not match the active session");
            return false;
        }

        request.setAttribute(USERNAME_ATTRIBUTE, username);
        return true;
    }

    private boolean matchesIdentity(String requestedUsername, String authenticatedUsername) {
        return requestedUsername == null || requestedUsername.equals(authenticatedUsername);
    }
}
