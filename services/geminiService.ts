/**
 * IMPORTANT:
 * - Do NOT import FunctionDeclaration/Type from '@google/genai' in Vite build.
 * - Use plain JSON schema strings instead.
 * - This file is browser-safe.
 */

export const toolDeclarations = [
  {
    name: 'openUrl',
    description: 'Open a website in the current browser tab.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Full URL or domain (example.com)' },
      },
      required: ['url'],
    },
  },
  {
    name: 'openUrlNewTab',
    description: 'Open a website in a new browser tab.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Full URL or domain (example.com)' },
      },
      required: ['url'],
    },
  },
  {
    name: 'searchGoogle',
    description: 'Search on Google for a query.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        newTab: { type: 'boolean', description: 'Open results in a new tab' },
      },
      required: ['query'],
    },
  },
  {
    name: 'scrollPage',
    description: 'Scroll the current page.',
    parameters: {
      type: 'object',
      properties: {
        direction: { type: 'string', enum: ['up', 'down'] },
        amount: { type: 'number', description: 'Pixels to scroll (default 800)' },
      },
      required: ['direction'],
    },
  },
  { name: 'goBack', description: 'Go back in browser history.', parameters: { type: 'object', properties: {} } },
  { name: 'reloadPage', description: 'Reload the current page.', parameters: { type: 'object', properties: {} } },
  {
    name: 'typeText',
    description: 'Type text into active input (best via extension).',
    parameters: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    },
  },
  { name: 'pressEnter', description: 'Press Enter key (best via extension).', parameters: { type: 'object', properties: {} } },
  {
    name: 'clickSelector',
    description: 'Click an element by CSS selector (best via extension).',
    parameters: {
      type: 'object',
      properties: { selector: { type: 'string' } },
      required: ['selector'],
    },
  },
];

function normalizeUrl(input: string): string {
  let url = (input || '').trim();
  if (!url) return '';
  if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
  return url;
}

/**
 * Bridge -> Chrome Extension (optional).
 * On Vercel/HTTPS, calling http://localhost can fail (mixed content).
 * So we try bridge, and fallback to normal browser navigation when possible.
 */
async function sendToBridge(payload: any): Promise<boolean> {
  try {
    await fetch('http://localhost:4545/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return true;
  } catch (e) {
    return false;
  }
}

export const executeTool = async (toolName: string, args: any) => {
  switch (toolName) {
    case 'openUrl': {
      const url = normalizeUrl(String(args?.url || ''));
      if (!url) return { success: false, message: 'Missing url' };
      const ok = await sendToBridge({ cmd: 'open_url', url });
      if (!ok) window.location.href = url;
      return { success: true };
    }

    case 'openUrlNewTab': {
      const url = normalizeUrl(String(args?.url || ''));
      if (!url) return { success: false, message: 'Missing url' };
      const ok = await sendToBridge({ cmd: 'new_tab', url });
      if (!ok) window.open(url, '_blank', 'noopener,noreferrer');
      return { success: true };
    }

    case 'searchGoogle': {
      const query = String(args?.query || '').trim();
      if (!query) return { success: false, message: 'Missing query' };
      const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      const newTab = Boolean(args?.newTab);
      const ok = await sendToBridge({ cmd: newTab ? 'new_tab' : 'open_url', url });
      if (!ok) {
        if (newTab) window.open(url, '_blank', 'noopener,noreferrer');
        else window.location.href = url;
      }
      return { success: true };
    }

    case 'scrollPage': {
      const direction = args?.direction === 'up' ? 'up' : 'down';
      const amount = typeof args?.amount === 'number' ? args.amount : 800;

      const ok = await sendToBridge({ cmd: 'scroll', direction, amount });
      if (!ok) {
        const dir = direction === 'up' ? -1 : 1;
        window.scrollBy({ top: dir * amount, left: 0, behavior: 'smooth' });
      }
      return { success: true };
    }

    case 'goBack': {
      const ok = await sendToBridge({ cmd: 'go_back' });
      if (!ok) window.history.back();
      return { success: true };
    }

    case 'reloadPage': {
      const ok = await sendToBridge({ cmd: 'reload' });
      if (!ok) window.location.reload();
      return { success: true };
    }

    case 'typeText': {
      const text = String(args?.text ?? '');
      const ok = await sendToBridge({ cmd: 'type', text });
      if (!ok) {
        const el = document.activeElement as any;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
          el.value = text;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
      return { success: true };
    }

    case 'pressEnter': {
      const ok = await sendToBridge({ cmd: 'press_enter' });
      if (!ok) {
        const el = document.activeElement as HTMLElement | null;
        if (el) {
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
        }
      }
      return { success: true };
    }

    case 'clickSelector': {
      const selector = String(args?.selector || '').trim();
      if (!selector) return { success: false, message: 'Missing selector' };
      const ok = await sendToBridge({ cmd: 'click', selector });
      if (!ok) {
        const el = document.querySelector(selector) as HTMLElement | null;
        if (el) el.click();
      }
      return { success: true };
    }

    default:
      return { success: false, message: `Unknown tool: ${toolName}` };
  }
};
