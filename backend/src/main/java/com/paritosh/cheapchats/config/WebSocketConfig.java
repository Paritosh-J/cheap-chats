package com.paritosh.cheapchats.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {

        // Register the /ws endpoint, enabling SockJS fallback options
        registry.addEndpoint("/ws").setAllowedOriginPatterns("*").withSockJS();

    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {

        // Enable a simple in-memory message broker
        // and set the prefix for messages that are bound for methods annotated with @MessageMapping
        config.enableSimpleBroker("/topic");
        config.setApplicationDestinationPrefixes("/app");

    }

}
