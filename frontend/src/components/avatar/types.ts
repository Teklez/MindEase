import type { GeminiVoiceId } from "@/lib/gemini-avatar";

export type AvatarBody = "F" | "M";

export type AvatarOption = {
  id: string;
  name: string;
  blurb: string;
  intro: string;
  url: string | null;
  body: AvatarBody;
  geminiVoice: GeminiVoiceId;
};
