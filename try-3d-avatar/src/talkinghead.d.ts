declare module '@met4citizen/talkinghead' {
  export class TalkingHead {
    constructor(node: HTMLElement, opt?: Record<string, unknown>);
    showAvatar(
      avatar: { url: string; body?: string; lipsyncLang?: string; avatarMood?: string },
      onprogress?: (ev: ProgressEvent) => void,
    ): Promise<void>;
    speakText(
      s: string,
      opt?: Record<string, unknown>,
      onsubtitles?: (node: unknown) => void,
      excludes?: number[][],
    ): void;
    speakAudio(
      r: {
        audio?: ArrayBuffer | ArrayBuffer[];
        words?: string[];
        wtimes?: number[];
        wdurations?: number[];
        visemes?: string[];
        vtimes?: number[];
        vdurations?: number[];
      },
      opt?: Record<string, unknown>,
      onsubtitles?: (node: unknown) => void,
    ): void;
    stop(): void;
    start(): void;
  }
}
