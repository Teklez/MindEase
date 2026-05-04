"""
Test: Gemini Live API speaking Amharic.
Model: gemini-2.5-flash-native-audio-latest
Sends an Amharic wellness message, saves + plays the audio response.
"""
import asyncio, os, wave, subprocess
from google import genai
from google.genai import types

API_KEY = os.environ["GEMINI_API_KEY"]
MODEL   = "models/gemini-2.5-flash-native-audio-latest"

USER_MESSAGE = "Hello, I don't feel happy today. I feel a bit down"
# "Hello, I don't feel happy today. I feel a bit down."

SYSTEM = (
    # "አንተ ሴሬኒቲ ነህ፣ ሞቅ ያለ እና አዛኝ የ AI ጤና ጓደኛ። "
    # "ሁልጊዜ በአማርኛ ምላሽ ስጥ። "
    # "አጭር፣ ሞቅ ያለ ምላሾችን ስጥ — ከ2 ዓረፍተ ነገር አይበልጥ።"
    "You are a warm and empathetic AI wellness companion. You help people explore their feelings, provide emotional support, and offer gentle guidance using evidence-based approaches like CBT and mindfulness. Keep responses conversational, under 3 sentences unless more detail is truly needed. Be warm, never clinical. Never diagnose. Always validate feelings first."
)

async def run():
    client = genai.Client(api_key=API_KEY)  # noqa: E501  (key from env)
    config = types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        system_instruction=SYSTEM,
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Kore")
            )
        ),
    )

    audio_chunks = []
    print(f"Connecting to {MODEL}...")

    async with client.aio.live.connect(model=MODEL, config=config) as session:
        print(f"Sending: {USER_MESSAGE}\n")
        await session.send_client_content(
            turns=[types.Content(role="user", parts=[types.Part(text=USER_MESSAGE)])],
            turn_complete=True,
        )
        async for response in session.receive():
            if response.data:
                audio_chunks.append(response.data)
            sc = getattr(response, "server_content", None)
            if sc and getattr(sc, "turn_complete", False):
                break

    if not audio_chunks:
        print("No audio received.")
        return

    pcm = b"".join(audio_chunks)
    out = "gemini_live_amharic.wav"
    with wave.open(out, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(24000)
        wf.writeframes(pcm)

    dur = len(pcm) / (24000 * 2)
    print(f"Saved: {out}  ({len(pcm)//1024} KB, {dur:.1f}s)")
    subprocess.run(["open", out])

if __name__ == "__main__":
    asyncio.run(run())
