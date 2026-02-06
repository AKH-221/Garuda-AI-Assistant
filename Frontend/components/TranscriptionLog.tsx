
import React, { useRef, useEffect } from 'react';
import type { Message } from '../types';

interface TranscriptionLogProps {
  messages: Message[];
}

export const TranscriptionLog: React.FC<TranscriptionLogProps> = ({ messages }) => {
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="bg-black bg-opacity-30 rounded-lg p-4 h-64 flex flex-col">
        <h2 className="text-lg font-semibold text-cyan-300 mb-2 border-b border-cyan-300/20 pb-2">Conversation Log</h2>
        <div className="flex-grow overflow-y-auto pr-2">
            {messages.length === 0 && (
                <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500">Awaiting activation...</p>
                </div>
            )}
            {messages.map((msg, index) => (
            <div key={index} className={`mb-3 last:mb-0 ${msg.author === 'user' ? 'text-right' : 'text-left'}`}>
                <div className={`inline-block p-2 rounded-lg max-w-xs md:max-w-sm ${msg.author === 'user' ? 'bg-blue-800 bg-opacity-50' : 'bg-gray-700 bg-opacity-50'}`}>
                    <p className="font-bold text-sm capitalize mb-1 ${msg.author === 'user' ? 'text-blue-300' : 'text-gray-300'}">
                        {msg.author}
                    </p>
                    <p className="text-white text-sm">{msg.text}</p>
                </div>
            </div>
            ))}
            <div ref={endOfMessagesRef} />
        </div>
    </div>
  );
};
