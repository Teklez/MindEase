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

export interface MoodEntry {
  entry_id: string;
  user_id: string;
  mood_level: number;
  note: string | null;
  entry_source: string;
  created_at: string;
}

export interface Badge {
  badge_id: string;
  name: string;
  name_am: string | null;
  description: string;
  description_am: string | null;
  icon: string;
  earned_at: string | null;
  is_earned: boolean;
}

export interface MoodTrend {
  date: string;
  average_mood: number;
  entry_count: number;
}

export interface MoodDayAggregate {
  date: string;
  average_mood: number;
  entry_count: number;
  entries: MoodEntry[];
}

export interface MoodStats {
  total_entries: number;
  average_mood: number | null;
  current_streak: number;
  longest_streak: number;
  most_common_mood: number | null;
  entries_this_week: number;
  entries_this_month: number;
  mood_distribution: Record<string, number>;
  weekly_averages: { week: string; average: number }[];
}

export interface MoodHistoryResponse {
  entries: MoodEntry[];
  stats: MoodStats;
  daily_trends: MoodTrend[];
  calendar_data: MoodDayAggregate[];
}
