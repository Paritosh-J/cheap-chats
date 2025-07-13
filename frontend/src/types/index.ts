export interface ChatMessage {
  id?: number;
  sender: string;
  content: string;
  type: "CHAT" | "JOIN" | "LEAVE" | "DELETE";
  timestamp?: string;
  replyTo?: {
    sender: string;
    content: string;
    timestamp?: string;
  };
}

export interface ChatMessageProps {
  message: ChatMessage;
  isOwnMessage: boolean;
  onDelete?: (messageId: number) => void;
  onReply?: (message: ChatMessage) => void;
  username: string;
}

export interface ChatGroup {
  id: number;
  groupName: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  members: string[];
}
