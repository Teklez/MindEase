import { useEffect, useRef, useState, useCallback } from 'react';
import { TalkingHead } from '@met4citizen/talkinghead';
import { fetchReply, VoiceSession, GEMINI_VOICES, type ChatMessage, type GeminiVoiceId } from './gemini';

type AvatarStatus = 'idle' | 'loading' | 'ready' | 'thinking' | 'speaking' | 'error';
type InputMode    = 'text' | 'voice';

function estimateWordTimings(text: string, durationMs: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return { words: [], wtimes: [], wdurations: [] };
  const msPerWord = durationMs / words.length;
  return {
    words,
    wtimes:     words.map((_, i) => i * msPerWord),
    wdurations: words.map(() => msPerWord),
  };
}

function estimateDuration(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length * 400;
}

function makeSilentPcm(durationMs: number): ArrayBuffer {
  return new Int16Array(Math.ceil((durationMs * 22050) / 1000)).buffer;
}

export function AvatarScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const headRef      = useRef<TalkingHead | null>(null);
  const chatEndRef   = useRef<HTMLDivElement>(null);
  const sessionRef   = useRef<VoiceSession | null>(null);

  const [avatarStatus, setAvatarStatus] = useState<AvatarStatus>('idle');
  const [loadProgress, setLoadProgress] = useState(0);
  const [avatarError,  setAvatarError]  = useState<string | null>(null);

  const [mode,      setMode]      = useState<InputMode>('text');
  const [voice,     setVoice]     = useState<GeminiVoiceId>('Kore');
  const [history,   setHistory]   = useState<ChatMessage[]>([]);
  const [input,     setInput]     = useState('');
  const [chatError, setChatError] = useState<string | null>(null);

  // Voice-call states
  const [callStatus, setCallStatus] = useState<'idle' | 'connecting' | 'ready' | 'recording' | 'thinking'>('idle');
  const [isRecording, setIsRecording] = useState(false);

  // Mount TalkingHead
  useEffect(() => {
    if (!containerRef.current) return;
    const head = new TalkingHead(containerRef.current, {
      ttsEndpoint: '',
      lipsyncModules: ['en'],
      lipsyncLang: 'en',
      cameraView: 'upper',
      modelFPS: 30,
      avatarMood: 'neutral',
      avatarIdleEyeContact: 0.5,
      avatarSpeakingEyeContact: 0.8,
    });
    headRef.current = head;
    setAvatarStatus('loading');

    head
      .showAvatar(
        { url: '/brunette.glb', body: 'F', lipsyncLang: 'en', avatarMood: 'neutral' },
        (ev: ProgressEvent) => {
          if (ev.lengthComputable && ev.total > 0)
            setLoadProgress(Math.round((ev.loaded / ev.total) * 100));
        },
      )
      .then(() => setAvatarStatus('ready'))
      .catch((err: unknown) => {
        setAvatarError(err instanceof Error ? err.message : String(err));
        setAvatarStatus('error');
      });

    return () => {
      head.stop();
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  // Clean up voice session when switching modes
  useEffect(() => {
    if (mode === 'text') {
      sessionRef.current?.close();
      sessionRef.current = null;
      setCallStatus('idle');
    }
  }, [mode]);

  // ── Shared: speak audio through avatar ──────────────────────────────────────
  const speakResponse = useCallback(async (text: string, pcm: ArrayBuffer | null, durationMs: number) => {
    setHistory((h) => [...h, { role: 'model', text } as ChatMessage]);
    setAvatarStatus('speaking');

    try { const t = new AudioContext(); await t.resume(); await t.close(); } catch (_) {}

    const actualPcm = pcm ?? makeSilentPcm(durationMs);
    const timing    = estimateWordTimings(text, durationMs);
    headRef.current?.speakAudio({
      audio:      [actualPcm],
      words:      timing.words,
      wtimes:     timing.wtimes,
      wdurations: timing.wdurations,
    });

    if (!pcm) {
      // browser TTS fallback (text mode)
      window.speechSynthesis.cancel();
      const utt  = new SpeechSynthesisUtterance(text);
      utt.rate   = 0.95;
      utt.onend  = () => setAvatarStatus('ready');
      window.speechSynthesis.speak(utt);
    }

    setTimeout(() => setAvatarStatus('ready'), durationMs + 400);
  }, []);

  // ── Text mode send ───────────────────────────────────────────────────────────
  async function handleSend() {
    const msg = input.trim();
    if (!msg || avatarStatus !== 'ready') return;

    setChatError(null);
    setHistory((h) => [...h, { role: 'user', text: msg }]);
    setInput('');
    setAvatarStatus('thinking');

    try {
      const replyText  = await fetchReply(msg, history);
      const durationMs = estimateDuration(replyText);
      await speakResponse(replyText, null, durationMs);
    } catch (err) {
      console.error(err);
      setChatError(err instanceof Error ? err.message : String(err));
      setAvatarStatus('ready');
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  // ── Voice mode ───────────────────────────────────────────────────────────────
  async function startCall(minimal = false) {
    if (avatarStatus !== 'ready') return;
    setCallStatus('connecting');
    setChatError(null);

    const session = new VoiceSession();
    sessionRef.current = session;

    session.onEvent = (e) => {
      if (e.type === 'ready') {
        setCallStatus('ready');
      } else if (e.type === 'response') {
        setCallStatus('ready');
        setAvatarStatus('speaking');
        speakResponse(e.text, e.pcm, e.durationMs);
        setTimeout(() => setAvatarStatus('ready'), e.durationMs + 400);
      } else if (e.type === 'error') {
        setChatError(e.message);
        setCallStatus('idle');
      }
    };

    try {
      await session.open(minimal ? undefined : voice);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : String(err));
      setCallStatus('idle');
      sessionRef.current = null;
    }
  }

  function endCall() {
    sessionRef.current?.close();
    sessionRef.current = null;
    setCallStatus('idle');
    setIsRecording(false);
  }

  function handleMicDown() {
    if (callStatus !== 'ready') return;
    sessionRef.current?.startRecording();
    setIsRecording(true);
    setHistory((h) => [...h, { role: 'user', text: '🎤 …' }]);
  }

  function handleMicUp() {
    if (!isRecording) return;
    sessionRef.current?.stopRecording();
    setIsRecording(false);
    setCallStatus('thinking');
    // Replace the placeholder user bubble with a real transcript once response arrives
  }

  const isBusy = avatarStatus === 'thinking' || avatarStatus === 'speaking';

  return (
    <div className="scene-root">
      <div ref={containerRef} className="canvas-host" />

      {avatarStatus === 'loading' && (
        <div className="overlay">
          <p>Loading avatar… {loadProgress}%</p>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${loadProgress}%` }} />
          </div>
        </div>
      )}
      {avatarStatus === 'error' && (
        <div className="overlay error">
          <p>Avatar failed to load</p>
          {avatarError && <pre>{avatarError}</pre>}
        </div>
      )}

      {avatarStatus !== 'loading' && avatarStatus !== 'error' && (
        <div className="chat-panel">

          {/* Mode + Voice row */}
          <div className="voice-row">
            <button
              className={`voice-chip${mode === 'text' ? ' active' : ''}`}
              onClick={() => setMode('text')}
              disabled={isBusy || callStatus !== 'idle'}
            >
              Text
            </button>
            <button
              className={`voice-chip${mode === 'voice' ? ' active' : ''}`}
              onClick={() => setMode('voice')}
              disabled={isBusy}
            >
              Voice call
            </button>

            <div style={{ width: 1, background: 'rgba(124,58,237,0.3)', margin: '0 4px', alignSelf: 'stretch' }} />

            {GEMINI_VOICES.map((v) => (
              <button
                key={v.id}
                className={`voice-chip${voice === v.id ? ' active' : ''}`}
                onClick={() => setVoice(v.id)}
                disabled={isBusy || callStatus !== 'idle'}
                title={v.desc}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Conversation */}
          <div className="messages">
            {history.length === 0 && (
              <p className="empty-hint">
                {mode === 'voice'
                  ? 'Start a call, then hold the mic button to speak'
                  : 'Say hello to Serenity — your AI wellness companion'}
              </p>
            )}
            {history.map((m, i) => (
              <div key={i} className={`bubble ${m.role}`}>{m.text}</div>
            ))}
            {(avatarStatus === 'thinking' || callStatus === 'thinking') && (
              <div className="bubble model thinking"><span /><span /><span /></div>
            )}
            <div ref={chatEndRef} />
          </div>

          {chatError && <p className="chat-error">{chatError}</p>}

          {/* ── Text input ── */}
          {mode === 'text' && (
            <div className="input-row">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                rows={2}
                disabled={isBusy || avatarStatus !== 'ready'}
                placeholder={
                  isBusy
                    ? avatarStatus === 'thinking' ? 'Serenity is thinking…' : 'Serenity is speaking…'
                    : 'Type a message… (Enter to send)'
                }
              />
              <button
                className="send-btn"
                onClick={handleSend}
                disabled={isBusy || !input.trim() || avatarStatus !== 'ready'}
              >
                {avatarStatus === 'thinking' ? '…' : avatarStatus === 'speaking' ? '🔊' : '↑'}
              </button>
            </div>
          )}

          {/* ── Voice call controls ── */}
          {mode === 'voice' && (
            <div className="call-row">
              {callStatus === 'idle' && (
                <>
                  <button className="call-btn start" onClick={() => startCall(false)} disabled={isBusy}>
                    Start call
                  </button>
                  <button className="call-btn start" onClick={() => startCall(true)} disabled={isBusy} style={{opacity:0.6, fontSize:'0.7rem'}}>
                    Minimal test
                  </button>
                </>
              )}

              {callStatus === 'connecting' && (
                <p className="call-hint">Connecting…</p>
              )}

              {(callStatus === 'ready' || callStatus === 'thinking') && (
                <>
                  <button
                    className={`mic-btn${isRecording ? ' recording' : ''}`}
                    onMouseDown={handleMicDown}
                    onMouseUp={handleMicUp}
                    onTouchStart={(e) => { e.preventDefault(); handleMicDown(); }}
                    onTouchEnd={(e)   => { e.preventDefault(); handleMicUp();   }}
                    disabled={callStatus === 'thinking' || isBusy}
                  >
                    {isRecording ? '🔴' : '🎤'}
                  </button>
                  <span className="call-hint">
                    {isRecording ? 'Listening…' : callStatus === 'thinking' ? 'Serenity is responding…' : 'Hold to speak'}
                  </span>
                  <button className="call-btn end" onClick={endCall}>End call</button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
