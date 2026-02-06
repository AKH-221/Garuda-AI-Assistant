
export type AppState = 'IDLE' | 'CONNECTING' | 'LISTENING' | 'THINKING' | 'SPEAKING';

export interface Message {
  author: 'user' | 'jarvis';
  text: string;
}
