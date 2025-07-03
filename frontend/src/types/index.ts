export interface ChatMessage {
  sender: string;
  content: string;
  type: "CHAT" | "JOIN" | "LEAVE";
  timestamp?: string;
}

export interface ChatGroup {
  id: number;
  groupName: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  members: string[];
}
