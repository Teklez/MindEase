import type { GeminiVoiceId } from "@/lib/gemini-avatar";

export type AvatarBody = "F" | "M";

// Per-bone offsets passed into TalkingHead's showAvatar() to fix
// source-rig differences (e.g. Avaturn skeletons need a slight shoulder
// + spine nudge so the avatar doesn't look hunched).
export type BoneOffset = {
  x?: number; y?: number; z?: number;
  rx?: number; ry?: number; rz?: number;
};
// `retarget` keys are bone names mapped to BoneOffset, with a couple of
// scalar-valued specials (scaleToHipsLevel, scaleToEyesLevel) that the
// TalkingHead library reads from the same object — hence the union value.
export type AvatarRig = {
  retarget?: Record<string, BoneOffset | number>;
  baseline?: Record<string, number>;
};

export type AvatarOption = {
  id: string;
  name: string;
  blurb: string;
  intro: string;
  url: string | null;
  body: AvatarBody;
  geminiVoice: GeminiVoiceId;
  rig?: AvatarRig;
};
