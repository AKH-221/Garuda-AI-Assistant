import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { toolDeclarations, executeTool } from './toolExecutor';
import type { AppState } from '../types';

type RealtimeBlob = { data: string; mimeType: string };

// -------------------------
// Audio helpers
// -------------------------
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

function encode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createPcmBlob(data: Float32Array): RealtimeBlob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) int16[i] = data[i] * 32768;
  return { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
}

// -------------------------
// ✅ SYSTEM PROMPT (FULL AUTOMATION)
// -------------------------
const SYSTEM_PROMPT = `
You are "JARVIS", a voice-controlled browser assistant running inside a web application deployed on Vercel.

========================
GLOBAL STATE CONTROL
========================
You maintain an internal state:
- ACTIVE (default)
- DEACTIVATED

State commands:
- "Deactivate Jarvis"
- "Sleep Jarvis"
- "Stop Jarvis"
→ Switch state to DEACTIVATED.

- "Activate Jarvis"
- "Wake up Jarvis"
- "Start Jarvis"
→ Switch state to ACTIVE.

State behavior:
- When DEACTIVATED:
  - Do NOT call any tools.
  - Do NOT execute any browser actions.
  - Respond only with:
    "Jarvis is deactivated. Say 'Activate Jarvis' to wake me up."

========================
CAPABILITIES (ACTIVE MODE)
========================
You operate ONLY inside the browser using safe, URL-based actions.

You CAN:
- Open ANY website mentioned by the user.
- Open websites in a NEW TAB when requested.
- Search for ANY topic, product, song, person, code, or question on the web.
- Search on specific platforms if named (YouTube, Google, Amazon, Flipkart, GitHub, Stack Overflow, etc.).

You CANNOT:
- Click buttons or type text inside other websites.
- Switch, close, or control browser tabs.
- Control media playback (play, pause, stop).
- Read prices automatically or interact with shopping carts.
- Perform login, checkout, or payment actions.

========================
TOOLS YOU MUST USE
========================
- openUrl({ url })
- openUrlNewTab({ url })
- searchGoogle({ query, newTab })
- youtubeSearch({ query, newTab })

========================
ACTION RULES (MANDATORY)
========================
- If the user asks for ANY action, you MUST call a tool.
- Never describe an action without executing it.
- Never output JSON as plain text.

Command mapping:
- "open <site>" → openUrl or openUrlNewTab
- "open <site> in new tab" → openUrlNewTab
- "search <anything>" → searchGoogle
- "search <song> on youtube" → youtubeSearch
- "open youtube and search <song>" → youtubeSearch
- If no platform is specified → default to Google search.

========================
RESPONSE STYLE
========================
- Be concise (1–2 sentences).
- Execute immediately when ACTIVE.
- Do not explain technical limitations unless the user asks.
`;


// -------------------------
// Public types
// -------------------------
export interface JarvisSession {
  close: () => void;
}

interface JarvisCallbacks {
  onStateChange: (state: AppState) => void;
  onUserTranscription: (text: string) => void;
  onJarvisTranscription: (text: string) => void;
  onTurnComplete: () => void;
  onToolCall: (toolName: string, args: any) => void;
  onError: (error: ErrorEvent | Error) => void;
}

// -------------------------
// ✅ Connect to Jarvis (Gemini Live Audio)
// -------------------------
export const connectToJarvis = async (callbacks: JarvisCallbacks): Promise<JarvisSession> => {
  // ✅ Vite client env (MUST start with VITE_)
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) throw new Error('Missing VITE_GEMINI_API_KEY in .env.local / Vercel env vars');

  const ai = new GoogleGenAI({ apiKey });

  const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
  const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

  const sources = new Set<AudioBufferSourceNode>();
  let nextStartTime = 0;

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  callbacks.onStateChange('LISTENING');

  const sessionPromise = ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-12-2025',
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations: toolDeclarations as any }],
    },
    callbacks: {
      onopen: () => {
        const source = inputAudioContext.createMediaStreamSource(stream);
        const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);

        scriptProcessor.onaudioprocess = (event) => {
          const inputData = event.inputBuffer.getChannelData(0);
          const pcmBlob = createPcmBlob(inputData);
          sessionPromise.then((session) => session.sendRealtimeInput({ media: pcmBlob as any }));
        };

        source.connect(scriptProcessor);

        // keep audio pipeline alive without feedback
        const gainNode = inputAudioContext.createGain();
        gainNode.gain.setValueAtTime(0, inputAudioContext.currentTime);
        scriptProcessor.connect(gainNode);
        gainNode.connect(inputAudioContext.destination);
      },

      onmessage: async (message: LiveServerMessage) => {
        // user transcript
        if (message.serverContent?.inputTranscription) {
          callbacks.onUserTranscription(message.serverContent.inputTranscription.text);
        }

        // jarvis transcript
        if (message.serverContent?.outputTranscription) {
          callbacks.onJarvisTranscription(message.serverContent.outputTranscription.text);
        }

        // audio output
        const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (audioData) {
          callbacks.onStateChange('SPEAKING');
          nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);

          const audioBuffer = await decodeAudioData(decode(audioData), outputAudioContext, 24000, 1);
          const src = outputAudioContext.createBufferSource();
          src.buffer = audioBuffer;
          src.connect(outputAudioContext.destination);

          src.addEventListener('ended', () => {
            sources.delete(src);
            if (sources.size === 0) callbacks.onStateChange('LISTENING');
          });

          src.start(nextStartTime);
          nextStartTime += audioBuffer.duration;
          sources.add(src);
        }

        // tool calls
        if (message.toolCall?.functionCalls) {
          callbacks.onStateChange('THINKING');

          for (const fc of message.toolCall.functionCalls) {
            callbacks.onToolCall(fc.name, fc.args);

            const result = await executeTool(fc.name, fc.args);

            const session = await sessionPromise;
            session.sendToolResponse({
              functionResponses: {
                id: fc.id,
                name: fc.name,
                response: { result: JSON.stringify(result) },
              },
            });
          }
        }

        if (message.serverContent?.turnComplete) callbacks.onTurnComplete();

        if (message.serverContent?.interrupted) {
          for (const s of sources.values()) {
            s.stop();
            sources.delete(s);
          }
          nextStartTime = 0;
          callbacks.onStateChange('LISTENING');
        }
      },

      onerror: (e: ErrorEvent) => callbacks.onError(e),

      onclose: async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (inputAudioContext.state !== 'closed') await inputAudioContext.close();
        if (outputAudioContext.state !== 'closed') await outputAudioContext.close();
      },
    },
  });

  const session = await sessionPromise;

  return {
    close: () => session.close(),
  };
};
