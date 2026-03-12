export interface User {
  user_id: string;
  email: string;
  display_name: string;
  is_verified: boolean;
  created_at: string;
}

export interface Conversation {
  conversation_id: string;
  user_id: string;
  title: string | null;
  started_at: string;
  last_message_at: string;
  status: string;
  total_messages: number;
  crisis_detected: boolean;
}

export interface Message {
  message_id: string;
  conversation_id: string;
  sender_type: "user" | "ai";
  content: string;
  detected_emotion: string | null;
  timestamp: string;
  is_crisis_flagged: boolean;
}

export interface CrisisResources {
  ethiopia: { name: string; phone: string }[];
  international: { name: string; info?: string; url?: string }[];
}

export interface ChatEvent {
  type: "token" | "done" | "crisis_alert" | "error";
  content?: string;
  message_id?: string;
  resources?: CrisisResources;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}
