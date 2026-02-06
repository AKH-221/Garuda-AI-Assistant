import React, { useState, useRef, useCallback } from 'react';
import { connectToJarvis, JarvisSession } from './services/geminiService';
import type { Message, AppState } from './types';
import { Controls } from './components/Controls';
import { Visualizer } from './components/Visualizer';
import { TranscriptionLog } from './components/TranscriptionLog';
import { ToolCallLog } from './components/ToolCallLog';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('IDLE');
  const [messages, setMessages] = useState<Message[]>([]);
  const [toolCalls, setToolCalls] = useState<string[]>([]);

  const sessionRef = useRef<JarvisSession | null>(null);
  const userTranscriptionRef = useRef('');
  const jarvisTranscriptionRef = useRef('');

  const addMessage = useCallback((author: 'user' | 'jarvis', text: string) => {
    if (text.trim()) {
      setMessages(prev => [...prev, { author, text }]);
    }
  }, []);

  const addToolCall = useCallback((toolCallString: string) => {
    setToolCalls(prev => [...prev.slice(-6), toolCallString]);
  }, []);

  const handleToggleSession = async () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
      setAppState('IDLE');
      setMessages([]);
      setToolCalls([]);
      return;
    }

    try {
      setAppState('CONNECTING');

      const session = await connectToJarvis({
        onStateChange: setAppState,

        onUserTranscription: (text) => {
          userTranscriptionRef.current += text;
        },

        onJarvisTranscription: (text) => {
          jarvisTranscriptionRef.current += text;
        },

        onTurnComplete: () => {
          addMessage('user', userTranscriptionRef.current);
          addMessage('jarvis', jarvisTranscriptionRef.current);
          userTranscriptionRef.current = '';
          jarvisTranscriptionRef.current = '';
        },

        onToolCall: (toolName, args) => {
          addToolCall(`🛠 ${toolName} → ${JSON.stringify(args)}`);
        },

        onError: (error) => {
          console.error("Session Error:", error);
          addMessage('jarvis', "An error occurred. Please try again.");
          setAppState('IDLE');
          sessionRef.current = null;
        },
      });

      sessionRef.current = session;
    } catch (error) {
      console.error('Failed to start session:', error);
      setAppState('IDLE');
      addMessage('jarvis', "Failed to start session.");
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex flex-col items-center justify-center p-4 font-sans text-gray-200">
      <div className="w-full max-w-4xl flex flex-col items-center">
        <h1 className="text-5xl md:text-6xl font-extralight text-cyan-300 tracking-wider mb-2">
          J.A.R.V.I.S
        </h1>
        <p className="text-gray-400 mb-8">Full Browser Automation Assistant</p>

        <div className="w-full h-64 md:h-80 flex items-center justify-center mb-8">
          <Visualizer state={appState} />
        </div>

        <Controls
          isSessionActive={appState !== 'IDLE' && appState !== 'CONNECTING'}
          isLoading={appState === 'CONNECTING'}
          onToggle={handleToggleSession}
        />

        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <TranscriptionLog messages={messages} />
          <ToolCallLog toolCalls={toolCalls} />
        </div>

        <footer className="text-gray-600 text-xs mt-12 text-center">
          <p>JARVIS operates inside your browser via a Chrome Extension.</p>
          <p>All actions are executed locally for security.</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
