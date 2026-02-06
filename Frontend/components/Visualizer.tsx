
import React from 'react';
import type { AppState } from '../types';

interface VisualizerProps {
  state: AppState;
}

export const Visualizer: React.FC<VisualizerProps> = ({ state }) => {
  const getStateProperties = () => {
    switch (state) {
      case 'IDLE':
        return { color: 'rgb(107 114 128)', text: 'Idle', glowFilter: 'url(#glow-idle)', animation: 'pulse-idle' };
      case 'CONNECTING':
        return { color: 'rgb(209 213 229)', text: 'Connecting', glowFilter: 'url(#glow-connecting)', animation: 'pulse-connecting' };
      case 'LISTENING':
        return { color: 'rgb(59 130 246)', text: 'Listening', glowFilter: 'url(#glow-listening)', animation: 'pulse-listening' };
      case 'THINKING':
        return { color: 'rgb(139 92 246)', text: 'Thinking', glowFilter: 'url(#glow-thinking)', animation: 'spin-thinking' };
      case 'SPEAKING':
        return { color: 'rgb(6 182 212)', text: 'Speaking', glowFilter: 'url(#glow-speaking)', animation: 'pulse-speaking' };
      default:
        return { color: 'rgb(107 114 128)', text: 'Idle', glowFilter: 'url(#glow-idle)', animation: 'pulse-idle' };
    }
  };

  const { color, text, glowFilter, animation } = getStateProperties();

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <style>{`
        @keyframes pulse-idle { 0%, 100% { transform: scale(0.95); opacity: 0.8; } 50% { transform: scale(1); opacity: 1; } }
        @keyframes pulse-connecting { 0%, 100% { transform: scale(0.98); opacity: 0.9; } 50% { transform: scale(1.02); opacity: 1; } }
        @keyframes pulse-listening { 0%, 100% { transform: scale(1); filter: brightness(1); } 50% { transform: scale(1.05); filter: brightness(1.2); } }
        @keyframes spin-thinking { 0% { transform: rotate(0deg) scale(1); } 100% { transform: rotate(360deg) scale(1); } }
        @keyframes pulse-speaking { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.9; } }

        .anim-idle { animation: pulse-idle 4s ease-in-out infinite; }
        .anim-connecting { animation: pulse-connecting 1s ease-in-out infinite; }
        .anim-listening { animation: pulse-listening 1s ease-in-out infinite; }
        .anim-thinking { animation: spin-thinking 3s linear infinite; }
        .anim-speaking { animation: pulse-speaking 0.5s ease-in-out infinite; }
      `}</style>
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <defs>
          <filter id="glow-idle" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-connecting" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
           <filter id="glow-listening" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
           <filter id="glow-thinking" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="10" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
           <filter id="glow-speaking" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="12" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <g style={{ animationName: animation, animationDuration: '3s', animationIterationCount: 'infinite', animationTimingFunction: 'linear', transformOrigin: 'center' }}>
          <circle cx="100" cy="100" r="80" fill="none" stroke={color} strokeWidth="2" filter={glowFilter} />
          <circle cx="100" cy="100" r="60" fill="none" stroke={color} strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
          <circle cx="100" cy="100" r="90" fill="none" stroke={color} strokeWidth="0.5" opacity="0.3" />
        </g>
      </svg>
      <div className="absolute text-center">
        <p className="text-2xl font-bold tracking-widest uppercase" style={{ color }}>{text}</p>
      </div>
    </div>
  );
};
