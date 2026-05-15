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
  conversation_type: "text" | "voice";
  attrs: {
    persona_id?: string;
    persona_name?: string;
    persona_blurb?: string;
    voice?: string;
  } | null;
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

export type ResourceType = "article" | "video" | "audio";

export interface ResourceResponse {
  resource_id: string;
  title: string;
  title_am: string | null;
  description: string;
  description_am: string | null;
  resource_type: ResourceType;
  url: string;
  thumbnail_url: string | null;
  category: string;
  duration: string | null;
  is_favorite: boolean;
  is_viewed: boolean;
}

export interface ResourceCategory {
  name: string;
  count: number;
}

export interface ResourceListResponse {
  resources: ResourceResponse[];
  categories: string[];
  total: number;
}

export interface ResourceRecommendation {
  resource: ResourceResponse;
  reason: string;
  reason_am: string | null;
}

// Assessments
export interface AssessmentOption {
  value: number;
  label: string;
  label_am: string | null;
}

export interface AssessmentQuestion {
  id: number;
  text: string;
  text_am: string | null;
}

export interface AssessmentRange {
  min: number;
  max: number;
  level: string;
  label: string;
  label_am: string | null;
  feedback: string;
  feedback_am: string | null;
  color: string;
  recommended_avatar: string | null;
}

export interface AssessmentScoringLogic {
  options: AssessmentOption[];
  max_score: number;
  ranges: AssessmentRange[];
  crisis_question_id?: number;
  crisis_threshold?: number;
}

export interface AssessmentFull {
  assessment_id: string;
  name: string;
  name_am: string | null;
  description: string;
  description_am: string | null;
  assessment_type: string;
  icon: string;
  estimated_time: string | null;
  questions: AssessmentQuestion[];
  scoring_logic: AssessmentScoringLogic;
  is_active: boolean;
}

export interface AssessmentListItem {
  assessment_id: string;
  name: string;
  name_am: string | null;
  description: string;
  description_am: string | null;
  assessment_type: string;
  icon: string;
  estimated_time: string | null;
  question_count: number;
  last_taken: string | null;
  times_taken: number;
}

export interface AssessmentResponseEntry {
  question_id: number;
  value: number;
}

export interface RecommendedResource {
  resource_id: string;
  title: string;
  title_am?: string | null;
  resource_type: string;
  url: string;
  thumbnail_url: string | null;
  category: string;
  duration: string | null;
  reason: string;
}

export interface AssessmentResult {
  user_assessment_id: string;
  assessment_name: string;
  assessment_type: string;
  score: number;
  max_score: number;
  feedback_level: string;
  feedback_text: string;
  feedback_text_am: string | null;
  color: string;
  recommended_avatar: string | null;
  recommended_resources: RecommendedResource[];
  completed_at: string;
  responses: AssessmentResponseEntry[];
  crisis_detected: boolean;
  crisis_resources: CrisisResources | null;
  new_badges: Badge[];
}

export interface AssessmentHistoryItem {
  user_assessment_id: string;
  assessment_name: string;
  assessment_type: string;
  icon: string;
  score: number;
  max_score: number;
  feedback_level: string;
  color: string;
  completed_at: string;
}

export interface AssessmentHistory {
  history: AssessmentHistoryItem[];
  total: number;
  score_trends: Record<string, { date: string; score: number }[]>;
}

// Groups
export interface GroupCategory {
  value: string;
  label: string;
  label_am: string;
  icon: string;
  color: string;
}

export interface GroupListItem {
  group_id: string;
  name: string;
  name_am: string | null;
  description: string;
  description_am: string | null;
  category: string;
  icon: string;
  cover_color: string | null;
  member_count: number;
  is_member: boolean;
  is_public: boolean;
  last_activity: string | null;
  has_unread: boolean;
}

export interface GroupUnreadSummary {
  has_unread: boolean;
  unread_group_count: number;
}

export interface GroupResponse {
  group_id: string;
  name: string;
  name_am: string | null;
  description: string;
  description_am: string | null;
  category: string;
  icon: string;
  cover_color: string | null;
  created_by: string;
  creator_name: string;
  is_public: boolean;
  max_members: number;
  member_count: number;
  is_member: boolean;
  my_role: "creator" | "admin" | "member" | null;
  rules: string | null;
  rules_am: string | null;
  created_at: string;
}

export interface GroupMemberResponse {
  user_id: string;
  display_name: string;
  role: "creator" | "admin" | "member";
  joined_at: string;
  is_muted: boolean;
}

export interface GroupMessageResponse {
  message_id: string;
  group_id: string;
  user_id: string | null;
  sender_type: "user" | "ai_moderator" | "system";
  sender_name: string | null;
  content: string;
  is_crisis_flagged: boolean;
  timestamp: string;
}

export interface GroupCreatePayload {
  name: string;
  name_am?: string | null;
  description: string;
  description_am?: string | null;
  category: string;
  icon: string;
  is_public: boolean;
  max_members: number;
  rules?: string | null;
  rules_am?: string | null;
}

export interface GroupUpdatePayload {
  name?: string;
  name_am?: string | null;
  description?: string;
  description_am?: string | null;
  icon?: string;
  rules?: string | null;
  rules_am?: string | null;
  max_members?: number;
}
