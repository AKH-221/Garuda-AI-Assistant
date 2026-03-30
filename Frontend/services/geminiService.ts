import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { toolDeclarations, executeTool } from './toolExecutor';
import type { AppState } from '../types';

type RealtimeBlob = { data: string; mimeType: string };

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
  for (let i = 0; i < l; i++) {
    const sample = Math.max(-1, Math.min(1, data[i]));
    int16[i] = sample < 0 ? sample * 32768 : sample * 32767;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

const SYSTEM_PROMPT = `
You are "JARVIS", a voice-controlled browser assistant running inside a web application deployed on Vercel.

GLOBAL STATE CONTROL
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

When DEACTIVATED:
- Do NOT call any tools.
- Do NOT execute any browser actions.
- Respond only with:
  "Jarvis is deactivated. Say 'Activate Jarvis' to wake me up."

CAPABILITIES
You operate inside the browser using safe, URL-based actions.

TOOLS YOU MUST USE
- openUrl({ url })
- openUrlNewTab({ url })
- searchGoogle({ query, newTab })
- youtubeSearch({ query, newTab })

ACTION RULES
- If the user asks for an action, call a tool.
- Never describe an action without executing it.
- If no platform is specified, default to Google search.

RESPONSE STYLE
- Be concise.
- Execute immediately when ACTIVE.
`;

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

export const connectToJarvis = async (
  callbacks: JarvisCallbacks
): Promise<JarvisSession> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

  if (!apiKey || !apiKey.trim()) {
    throw new Error(
      'VITE_GEMINI_API_KEY is missing in your frontend env. Add it in Frontend/.env.local for local use and in Vercel Environment Variables for deployment.'
    );
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone access is not supported in this browser.');
  }

  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

  const inputAudioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)({ sampleRate: 16000 });
  const outputAudioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)({ sampleRate: 24000 });

  if (inputAudioContext.state === 'suspended') {
    await inputAudioContext.resume();
  }
  if (outputAudioContext.state === 'suspended') {
    await outputAudioContext.resume();
  }

  const sources = new Set<AudioBufferSourceNode>();
  let nextStartTime = 0;
  let stream: MediaStream | null = null;
  let scriptProcessor: ScriptProcessorNode | null = null;
  let inputSourceNode: MediaStreamAudioSourceNode | null = null;
  let closed = false;

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    callbacks.onStateChange('LISTENING');

    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Zephyr' },
          },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: SYSTEM_PROMPT,
        tools: [{ functionDeclarations: toolDeclarations as any }],
      },
      callbacks: {
        onopen: () => {
          if (!stream) return;

          inputSourceNode = inputAudioContext.createMediaStreamSource(stream);
          scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);

          scriptProcessor.onaudioprocess = (event) => {
            if (closed) return;

            const inputData = event.inputBuffer.getChannelData(0);
            const pcmBlob = createPcmBlob(inputData);

            sessionPromise
              .then((session) => {
                if (!closed) {
                  session.sendRealtimeInput({ media: pcmBlob as any });
                }
              })
              .catch((err) => callbacks.onError(err instanceof Error ? err : new Error(String(err))));
          };

          inputSourceNode.connect(scriptProcessor);

          const silentGain = inputAudioContext.createGain();
          silentGain.gain.setValueAtTime(0, inputAudioContext.currentTime);
          scriptProcessor.connect(silentGain);
          silentGain.connect(inputAudioContext.destination);
        },

        onmessage: async (message: LiveServerMessage) => {
          if (message.serverContent?.inputTranscription?.text) {
            callbacks.onUserTranscription(message.serverContent.inputTranscription.text);
          }

          if (message.serverContent?.outputTranscription?.text) {
            callbacks.onJarvisTranscription(message.serverContent.outputTranscription.text);
          }

          const audioData =
            message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;

          if (audioData) {
            callbacks.onStateChange('SPEAKING');
            nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);

            const audioBuffer = await decodeAudioData(
              decode(audioData),
              outputAudioContext,
              24000,
              1
            );

            const src = outputAudioContext.createBufferSource();
            src.buffer = audioBuffer;
            src.connect(outputAudioContext.destination);

            src.addEventListener('ended', () => {
              sources.delete(src);
              if (sources.size === 0 && !closed) {
                callbacks.onStateChange('LISTENING');
              }
            });

            src.start(nextStartTime);
            nextStartTime += audioBuffer.duration;
            sources.add(src);
          }

          if (message.toolCall?.functionCalls?.length) {
            callbacks.onStateChange('THINKING');

            for (const fc of message.toolCall.functionCalls) {
              callbacks.onToolCall(fc.name, fc.args);

              const result = await executeTool(fc.name, fc.args);
              const session = await sessionPromise;

              session.sendToolResponse({
                functionResponses: [
                  {
                    id: fc.id,
                    name: fc.name,
                    response: { result: JSON.stringify(result) },
                  },
                ],
              });
            }
          }

          if (message.serverContent?.turnComplete) {
            callbacks.onTurnComplete();
          }

          if (message.serverContent?.interrupted) {
            for (const s of Array.from(sources)) {
              s.stop();
              sources.delete(s);
            }
            nextStartTime = 0;
            callbacks.onStateChange('LISTENING');
          }
        },

        onerror: (e: ErrorEvent) => {
          callbacks.onError(e);
        },

        onclose: async () => {
          closed = true;

          for (const s of Array.from(sources)) {
            try {
              s.stop();
            } catch {}
            sources.delete(s);
          }

          stream?.getTracks().forEach((t) => t.stop());

          try {
            scriptProcessor?.disconnect();
          } catch {}

          try {
            inputSourceNode?.disconnect();
          } catch {}

          if (inputAudioContext.state !== 'closed') {
            await inputAudioContext.close();
          }
          if (outputAudioContext.state !== 'closed') {
            await outputAudioContext.close();
          }
        },
      },
    });

    const session = await sessionPromise;

    return {
      close: () => {
        closed = true;
        session.close();
      },
    };
  } catch (error) {
    closed = true;

    stream?.getTracks().forEach((t) => t.stop());

    try {
      if (inputAudioContext.state !== 'closed') {
        await inputAudioContext.close();
      }
    } catch {}

    try {
      if (outputAudioContext.state !== 'closed') {
        await outputAudioContext.close();
      }
    } catch {}

    throw error instanceof Error ? error : new Error(String(error));
  }
};