package com.paritosh.cheapchats.dto;

import lombok.Data;

@Data
public class ChatMessageDto {

    private Long id;
    private String sender;
    private String content;
    private String timestamp;
    private String type; // JOIN, LEAVE, CHAT

}
