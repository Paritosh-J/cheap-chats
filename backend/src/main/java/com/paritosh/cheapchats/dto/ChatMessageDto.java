package com.paritosh.cheapchats.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
public class ChatMessageDto {

    private Long id;
    private String sender;
    private String content;
    private String timestamp;
    private String type; // JOIN, LEAVE, CHAT
    private ReplyPreviewDto replyTo;

    @Data
    @NoArgsConstructor
    public static class ReplyPreviewDto {
        private String sender;
        private String content;
        private String timestamp;
    }

}
