package com.paritosh.cheapchats.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import com.paritosh.cheapchats.services.UserSessionService;

@ExtendWith(MockitoExtension.class)
class SessionAuthenticationInterceptorTest {

    @Mock
    private UserSessionService userSessionService;

    @InjectMocks
    private SessionAuthenticationInterceptor interceptor;

    @Test
    void rejectsRequestThatClaimsAnotherUsername() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(SessionAuthenticationInterceptor.SESSION_HEADER, "alice-session");
        request.setParameter("username", "bob");
        MockHttpServletResponse response = new MockHttpServletResponse();
        when(userSessionService.authenticateAndTouch("alice-session")).thenReturn("alice");

        boolean allowed = interceptor.preHandle(request, response, new Object());

        assertThat(allowed).isFalse();
        assertThat(response.getStatus()).isEqualTo(403);
    }

    @Test
    void acceptsRequestForActiveSessionOwner() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(SessionAuthenticationInterceptor.SESSION_HEADER, "alice-session");
        request.setParameter("username", "alice");
        MockHttpServletResponse response = new MockHttpServletResponse();
        when(userSessionService.authenticateAndTouch("alice-session")).thenReturn("alice");

        boolean allowed = interceptor.preHandle(request, response, new Object());

        assertThat(allowed).isTrue();
        assertThat(request.getAttribute(SessionAuthenticationInterceptor.USERNAME_ATTRIBUTE))
                .isEqualTo("alice");
    }
}
