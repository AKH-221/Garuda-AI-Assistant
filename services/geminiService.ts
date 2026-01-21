import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { toolDeclarations, executeTool } from './toolExecutor';
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

// ✅ IMPORTANT: Force Gemini to CALL TOOLS for actions (not JSON text)
const SYSTEM_PROMPT = `
You are "JARVIS", a voice assistant operating INSIDE A WEB BROWSER.

Hard rules:
- For ANY browser action (open site, new tab, search, scroll, back, reload, type, enter, click),
  you MUST use the provided tools (function calls).
- Do NOT output JSON as plain text.
- Keep spoken responses 1–2 short sentences.

Tools available:
- openUrl({ url })
- openUrlNewTab({ url })
- searchGoogle({ query })
- scrollPage({ direction, amount })
- goBack({})
- reloadPage({})
- typeText({ text })
- pressEnter({})
- clickSelector({ selector })
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

export const connectToJarvis = async (callbacks: JarvisCallbacks): Promise<JarvisSession> => {
  // ✅ Vite frontend env var
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) throw new Error('Missing VITE_GEMINI_API_KEY (set it in Vercel + .env.local)');

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
      tools: [{ functionDeclarations: toolDeclarations }],
    },
    callbacks: {
      onopen: () => {
        const source = inputAudioContext.createMediaStreamSource(stream);
        const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);

        scriptProcessor.onaudioprocess = (event) => {
          const inputData = event.inputBuffer.getChannelData(0);
          const pcmBlob = createPcmBlob(inputData);
          sessionPromise.then((session) => session.sendRealtimeInput({ media: pcmBlob }));
        };

        source.connect(scriptProcessor);

        // keep pipeline alive without audio feedback
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

        const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
        if (audioData) {
          callbacks.onStateChange('SPEAKING');
          nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);

          const audioBuffer = await decodeAudioData(decode(audioData), outputAudioContext, 24000, 1);
          const source = outputAudioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(outputAudioContext.destination);

          source.addEventListener('ended', () => {
            sources.delete(source);
            if (sources.size === 0) callbacks.onStateChange('LISTENING');
          });

          source.start(nextStartTime);
          nextStartTime += audioBuffer.duration;
          sources.add(source);
        }

        // ✅ tool calls
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
