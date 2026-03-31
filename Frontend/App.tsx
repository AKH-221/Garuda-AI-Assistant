import React, { useState, useRef, useCallback } from 'react';
import './app.css';
import { connectToJarvis, JarvisSession } from './services/geminiService';
import type { Message, AppState } from './types';
import { Controls } from './components/Controls';
import { Visualizer } from './components/Visualizer';
import { TranscriptionLog } from './components/TranscriptionLog';
import { ToolCallLog } from './components/ToolCallLog';
import { ChatInput } from './components/ChatInput';
import { Analytics } from '@vercel/analytics/react';

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

  const handleSendMessage = (text: string) => {
    addMessage('user', text);
    addMessage('jarvis', 'Processing: ' + text);
  };

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
          console.error('Session Error:', error);
          addMessage('jarvis', 'An error occurred. Please try again.');
          setAppState('IDLE');
          sessionRef.current = null;
        },
      });

      sessionRef.current = session;
    } catch (error) {
      console.error('Failed to start session:', error);
      setAppState('IDLE');
      addMessage('jarvis', 'Failed to start session.');
    }
  };

  return (
    <div className="jarvis-shell min-h-screen flex flex-col items-center justify-center p-4 font-sans text-gray-200">
      <div className="floating-orb orb-1" />
      <div className="floating-orb orb-2" />

      <div className="w-full max-w-6xl flex flex-col items-center relative z-10">
        <div className="status-pill px-4 py-2 rounded-full mb-6 text-xs tracking-[0.3em] uppercase text-cyan-200">
          {appState}
        </div>

        <h1 className="text-5xl md:text-6xl font-extralight text-cyan-300 tracking-wider mb-2 glow-title">
          J.A.R.V.I.S
        </h1>
        <p className="text-gray-400 mb-8 text-center">
          Futuristic Browser Automation Assistant
        </p>

        <div className="w-full glass-panel neon-ring rounded-3xl p-6 md:p-8 mb-8">
          <div className="w-full h-64 md:h-80 flex items-center justify-center">
            <Visualizer state={appState} />
          </div>

          <div className="mt-6 flex justify-center">
            <Controls
              isSessionActive={appState !== 'IDLE' && appState !== 'CONNECTING'}
              isLoading={appState === 'CONNECTING'}
              onToggle={handleToggleSession}
            />
          </div>
        </div>

        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-panel rounded-2xl p-2">
            <TranscriptionLog messages={messages} />
          </div>

          <div className="glass-panel rounded-2xl p-2">
            <ToolCallLog toolCalls={toolCalls} />
          </div>
        </div>

        <div className="w-full mt-6 glass-panel rounded-2xl p-4">
          <ChatInput onSend={handleSendMessage} />
        </div>

        <footer className="text-gray-500 text-xs mt-10 text-center">
          <p>JARVIS operates inside your browser via a Chrome Extension.</p>
          <p>All actions are executed locally for security.</p>
        </footer>
      </div>
      <Analytics />
    </div>
  );
};

export default App;