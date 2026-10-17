export interface Message {
  id: string;
  from: string;
  text: string;
  timestamp: number;
}

export interface Group {
  id: string;
  name: string;
  creator: string;
  members: string[];
  messages: Message[];
  expiresAt: number;
  createdAt: number;
}

export interface User {
  username: string;
}

export interface ChatGroup {
  groupName: string;
  createdBy: string;
  expiresIn: string;
  expired: boolean;
  members: string[];
}

export interface ChatMessage {
  id?: number;
  sender: string;
  content: string;
  timestamp: string;
  type: "CHAT" | "JOIN" | "LEAVE" | "DELETE";
  replyTo?: {
    sender: string;
    content: string;
    timestamp: string;
  };
}

export interface ReplyPreview {
  sender: string;
  content: string;
  timestamp: string;
}

export interface ChatMessageProps {
  message: ChatMessage;
  isOwnMessage: boolean;
  onDelete?: (messageId: number) => void;
  onReply?: (message: ChatMessage) => void;
  username?: string;
}