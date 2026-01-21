
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Type, FunctionDeclaration, Blob } from '@google/genai';
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


const SYSTEM_PROMPT = `You are "JARVIS", a voice-controlled desktop assistant that helps the user operate their computer safely and efficiently.

Core behavior:
- The user speaks; the app converts speech to text and sends it to you as the user message.
- Your job is to interpret the request, plan the steps, and then call the appropriate tools to execute actions on the computer.
- You must be concise in your spoken responses: 1–2 short sentences maximum unless the user asks for detail.

Safety rules (must follow):
1) Confirm before executing any action that is destructive, sensitive, or irreversible:
   - deleting files, formatting, uninstalling, closing unsaved work, sending emails/messages, payments, changing system settings, running unknown scripts/commands, sharing data.
   Ask a short confirmation question: "Do you want me to proceed?"
2) Never ask for or speak out passwords, OTPs, private keys, or sensitive personal info. If login is required, ask the user to manually do it.
3) Do not run commands that download/install unknown software unless the user explicitly asks and confirms.
4) If the request is unclear, ask one short clarifying question.
5) If the user asks for something illegal, privacy-invasive, or harmful, refuse and offer a safe alternative.

Execution style:
- Prefer minimal steps.
- Use the available tools to interact with the OS (open apps, click, type, keyboard shortcuts, read screen text if available).
- After each tool call, check results. If something fails, try one alternative approach, then explain what you need from the user.

Task handling rules:
- For common tasks (open apps, web search, write text, create folders/files, play music, adjust volume/brightness), proceed quickly.
- For multi-step tasks, do them in small chunks and keep the user informed.
- If you need to locate something (a file/app), use search tools or OS search steps.

Response format:
- When executing: call tools. Do not include long explanations.
- When finished: respond with a short completion message and optionally what you did.
- When confirmation is needed: ask for confirmation, do not call tools until confirmed.

Examples you should follow:
- "Open Chrome and search for best laptops" → call openApplication(name='Chrome') → call searchWeb(query='best laptops').
- "Create a folder on desktop named Projects" → call createFolder(path='~/Desktop/Projects').
- "Delete my Downloads" → ask "This will permanently delete all files in your Downloads folder. Do you want me to proceed?" → wait for user confirmation before calling deleteFile(path='~/Downloads').`;

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

export const connectToJarvis = async (callbacks: JarvisCallbacks): Promise<JarvisSession> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
          sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
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
                        response: { result: JSON.stringify(result) }
                    }
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
         stream.getTracks().forEach(track => track.stop());
         if (inputAudioContext.state !== 'closed') {
            await inputAudioContext.close();
         }
         if (outputAudioContext.state !== 'closed') {
            await outputAudioContext.close();
         }
      },
    }
  });

  const session = await sessionPromise;
  
  return {
    close: () => {
        session.close();
    }
  };
};
