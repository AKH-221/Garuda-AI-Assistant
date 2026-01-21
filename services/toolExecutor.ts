import { FunctionDeclaration, Type } from '@google/genai';

/**
 * This project runs in the browser.
 * Real "tab switching / guaranteed new-tab / cross-site typing & clicking"
 * requires the Local Bridge + Chrome Extension.
 *
 * But we ALSO include browser-only fallback for:
 * - openUrl, openUrlNewTab, searchGoogle, scroll, back, reload
 * so at least URLs open even if bridge isn't reachable (ex: Vercel https mixed-content block).
 */

export const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'openUrl',
    description: 'Open a website in the current browser tab.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: { type: Type.STRING, description: 'Full URL (https://...) or domain (example.com).' },
      },
      required: ['url'],
    },
  },
  {
    name: 'openUrlNewTab',
    description: 'Open a website in a NEW browser tab.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: { type: Type.STRING, description: 'Full URL (https://...) or domain (example.com).' },
      },
      required: ['url'],
    },
  },
  {
    name: 'searchGoogle',
    description: 'Search Google for a query (opens results in current tab unless user asked new tab).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Search query text.' },
        newTab: { type: Type.BOOLEAN, description: 'If true, open search results in a new tab.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'scrollPage',
    description: 'Scroll the current page up or down.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        direction: { type: Type.STRING, enum: ['up', 'down'] },
        amount: { type: Type.NUMBER, description: 'Pixels to scroll (default 800).' },
      },
      required: ['direction'],
    },
  },
  {
    name: 'goBack',
    description: 'Go back in browser history.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'reloadPage',
    description: 'Reload the current page.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'typeText',
    description: 'Type text into the active input field (works best via Chrome Extension).',
    parameters: {
      type: Type.OBJECT,
      properties: { text: { type: Type.STRING } },
      required: ['text'],
    },
  },
  {
    name: 'pressEnter',
    description: 'Press Enter key (works best via Chrome Extension).',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'clickSelector',
    description: 'Click an element using a CSS selector (works best via Chrome Extension).',
    parameters: {
      type: Type.OBJECT,
      properties: { selector: { type: Type.STRING } },
      required: ['selector'],
    },
  },
];

function normalizeUrl(input: string): string {
  let url = (input || '').trim();
  if (!url) return '';
  // If user says "youtube" or "youtube.com"
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  return url;
}

async function sendToBridge(payload: any): Promise<boolean> {
  try {
    await fetch('http://localhost:4545/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return true;
  } catch (e) {
    console.warn('Bridge not reachable (localhost:4545). Using browser fallback when possible.', e);
    return false;
  }
}

export const executeTool = async (toolName: string, args: any) => {
  console.log(`Executing tool: ${toolN
