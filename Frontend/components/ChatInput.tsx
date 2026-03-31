import React, { useState } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend }) => {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input);
    setInput('');
  };

  return (
    <div className="w-full flex items-center gap-3 mt-4">
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type your command..."
        className="flex-1 px-4 py-3 rounded-lg bg-black bg-opacity-40 border border-cyan-400/30 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
      />

      <button
        onClick={handleSend}
        className="px-6 py-3 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white font-semibold shadow-lg shadow-cyan-500/30"
      >
        Send
      </button>
    </div>
  );
};