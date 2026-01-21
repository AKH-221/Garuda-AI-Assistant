import {
  GoogleGenAI,
  LiveSession,
  LiveServerMessage,
  Modality,
  Type,
  FunctionDeclaration,
  Blob,
} from '@google/genai';
import { toolDeclarations } from './toolExecutor';
import type { AppState } from '../types';

// Audio utility functions (decode/encode)
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
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

function createPcmBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

const SYSTEM_PROMPT = `
You are "JARVIS", a voice-controlled AI assistant operating INSIDE A WEB BROWSER.

IMPORTANT SCOPE (must follow strictly):
- You do NOT control the operating system.
- You do NOT open desktop applications.
- You ONLY perform actions that are possible inside a browser tab (Chrome-compatible).
- When the user says "open Chrome", treat it as "open a website in the browser".

Your responsibilities:
- Listen to the user's voice command (already converted to text).
- If the command is a browser task, respond with a SINGLE valid JSON object ONLY.
- Do NOT include explanations, greetings, or extra text when responding with JSON.

Supported browser actions (ONLY THESE):

1) Open a website:
{"action":"open_url","url":"https://example.com"}

2) Search on Google:
{"action":"search","query":"your search text"}

3) Scroll the current page:
{"action":"scroll","direction":"down","amount":800}
{"action":"scroll","direction":"up","amount":800}

4) Navigation:
{"action":"back"}
{"action":"reload"}

Rules:
- If the user says "open youtube", respond with:
  {"action":"open_url","url":"https://www.youtube.com"}
- If the user says "open instagram", respond with:
  {"action":"open_url","url":"https://www.instagram.com"}
- If the user says "search cats", respond with:
  {"action":"search","query":"cats"}
- If the request cannot be performed in a browser, politely explain in ONE sentence that it is not supported yet.

Response rules:
- For browser tasks → JSON ONLY.
- For normal conversation → short natural language response (1–2 sentences max).
- Never mention tools, functions, or system internals.

Future note:
- Desktop automation (opening apps, typing, clicking outside browser) is NOT enabled yet.
`;

// --- Tool Executor ---
// In a real app, this would interact with the OS. Here, it's a mock.
import { executeTool } from './toolExecutor';

// --- Gemini Service ---
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
  callbacks: JarvisCallbacks,
): Promise<JarvisSession> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const inputAudioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)({ sampleRate: 16000 });
  const outputAudioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)({ sampleRate: 24000 });
  const sources = new Set<AudioBufferSourceNode>();
  let nextStartTime = 0;

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  callbacks.onStateChange('LISTENING');

  const sessionPromise = ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-12-2025',
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations: toolDeclarations }],
    },
    callbacks: {
      onopen: () => {
        const source = inputAudioContext.createMediaStreamSource(stream);
        const scriptProcessor = inputAudioContext.createScriptProcessor(
          4096,
          1,
          1,
        );
        scriptProcessor.onaudioprocess = (event) => {
          const inputData = event.inputBuffer.getChannelData(0);
          const pcmBlob = createPcmBlob(inputData);
          sessionPromise.then((session) =>
            session.sendRealtimeInput({ media: pcmBlob }),
          );
        };
        source.connect(scriptProcessor);

        // To prevent audio feedback, the scriptProcessor is connected to a GainNode with a gain of 0.
        // This is then connected to the destination to ensure the processing pipeline remains active.
        const gainNode = inputAudioContext.createGain();
        gainNode.gain.setValueAtTime(0, inputAudioContext.currentTime);
        scriptProcessor.connect(gainNode);
        gainNode.connect(inputAudioContext.destination);
      },
      onmessage: async (message: LiveServerMessage) => {
        if (message.serverContent?.inputTranscription) {
          callbacks.onUserTranscription(message.serverContent.inputTranscription.text);
        }

        if (message.serverContent?.outputTranscription) {
          callbacks.onJarvisTranscription(message.serverContent.outputTranscription.text);
        }

        const audioData =
          message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
        if (audioData) {
          callbacks.onStateChange('SPEAKING');
          nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
          const audioBuffer = await decodeAudioData(
            decode(audioData),
            outputAudioContext,
            24000,
            1,
          );
          const source = outputAudioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(outputAudioContext.destination);
          source.addEventListener('ended', () => {
            sources.delete(source);
            if (sources.size === 0) {
              callbacks.onStateChange('LISTENING');
            }
          });
          source.start(nextStartTime);
          nextStartTime += audioBuffer.duration;
          sources.add(source);
        }

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

        if (message.serverContent?.turnComplete) {
          callbacks.onTurnComplete();
        }

        if (message.serverContent?.interrupted) {
          for (const source of sources.values()) {
            source.stop();
            sources.delete(source);
          }
          nextStartTime = 0;
          callbacks.onStateChange('LISTENING');
        }
      },
      onerror: (e: ErrorEvent) => callbacks.onError(e),
      onclose: async () => {
        stream.getTracks().forEach((track) => track.stop());
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
      session.close();
    },
  };
};
