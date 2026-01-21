/**
 * Browser automation tool executor
 * Works with:
 * 1) Chrome Extension + Local Bridge (full power)
 * 2) Browser fallback (Vercel-safe for open/search)
 */

export const toolDeclarations = [
  // BASIC NAVIGATION
  {
    name: 'openUrl',
    description: 'Open a website in the current tab',
    parameters: {
      type: 'object',
      properties: { url: { type: 'string' } },
      required: ['url'],
    },
  },
  {
    name: 'openUrlNewTab',
    description: 'Open a website in a new tab',
    parameters: {
      type: 'object',
      properties: { url: { type: 'string' } },
      required: ['url'],
    },
  },

  // SEARCH
  {
    name: 'searchGoogle',
    description: 'Search something on Google',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        newTab: { type: 'boolean' },
      },
      required: ['query'],
    },
  },
  {
    name: 'youtubeSearch',
    description: 'Search a song or video on YouTube',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        newTab: { type: 'boolean' },
      },
      required: ['query'],
    },
  },

  // TAB CONTROL
  {
    name: 'switchTab',
    description: 'Switch to a tab number (1 = first tab)',
    parameters: {
      type: 'object',
      properties: { number: { type: 'number' } },
      required: ['number'],
    },
  },
  { name: 'closeTab', description: 'Close current tab', parameters: { type: 'object', properties: {} } },
  {
    name: 'closeTabByNumber',
    description: 'Close a tab by number',
    parameters: {
      type: 'object',
      properties: { number: { type: 'number' } },
      required: ['number'],
    },
  },
  { name: 'closeOtherTabs', description: 'Close all other tabs', parameters: { type: 'object', properties: {} } },
  { name: 'closeAllTabs', description: 'Close all tabs', parameters: { type: 'object', properties: {} } },

  // PAGE ACTIONS
  {
    name: 'scrollPage',
    description: 'Scroll page up or down',
    parameters: {
      type: 'object',
      properties: {
        direction: { type: 'string', enum: ['up', 'down'] },
        amount: { type: 'number' },
      },
      required: ['direction'],
    },
  },
  { name: 'goBack', description: 'Go back', parameters: { type: 'object', properties: {} } },
  { name: 'reloadPage', description: 'Reload page', parameters: { type: 'object', properties: {} } },
  {
    name: 'typeText',
    description: 'Type text into active input',
    parameters: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    },
  },
  { name: 'pressEnter', description: 'Press Enter', parameters: { type: 'object', properties: {} } },
  {
    name: 'clickSelector',
    description: 'Click element by CSS selector',
    parameters: {
      type: 'object',
      properties: { selector: { type: 'string' } },
      required: ['selector'],
    },
  },
];

function normalizeUrl(input: string): string {
  let url = input.trim();
  if (!url.startsWith('http')) url = 'https://' + url;
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
  } catch {
    return false;
  }
}

export const executeTool = async (toolName: string, args: any) => {
  switch (toolName) {
    case 'openUrl': {
      const url = normalizeUrl(args.url);
      const ok = await sendToBridge({ cmd: 'open_url', url });
      if (!ok) window.location.href = url;
      return { success: true };
    }

    case 'openUrlNewTab': {
      const url = normalizeUrl(args.url);
      const ok = await sendToBridge({ cmd: 'new_tab', url });
      if (!ok) window.open(url, '_blank');
      return { success: true };
    }

    case 'searchGoogle': {
      const url = `https://www.google.com/search?q=${encodeURIComponent(args.query)}`;
      const ok = await sendToBridge({ cmd: args.newTab ? 'new_tab' : 'open_url', url });
      if (!ok) args.newTab ? window.open(url, '_blank') : (window.location.href = url);
      return { success: true };
    }

    case 'youtubeSearch': {
      const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(args.query)}`;
      const ok = await sendToBridge({ cmd: args.newTab ? 'new_tab' : 'open_url', url });
      if (!ok) args.newTab ? window.open(url, '_blank') : (window.location.href = url);
      return { success: true };
    }

    case 'switchTab':
      await sendToBridge({ cmd: 'switch_tab', index: args.number - 1 });
      return { success: true };

    case 'closeTab':
      await sendToBridge({ cmd: 'close_tab' });
      return { success: true };

    case 'closeTabByNumber':
      await sendToBridge({ cmd: 'close_tab_index', index: args.number - 1 });
      return { success: true };

    case 'closeOtherTabs':
      await sendToBridge({ cmd: 'close_other_tabs' });
      return { success: true };

    case 'closeAllTabs':
      await sendToBridge({ cmd: 'close_all_tabs' });
      return { success: true };

    case 'scrollPage': {
      const dir = args.direction === 'up' ? -1 : 1;
      const amount = args.amount ?? 800;
      const ok = await sendToBridge({ cmd: 'scroll', direction: args.direction, amount });
      if (!ok) window.scrollBy({ top: dir * amount, behavior: 'smooth' });
      return { success: true };
    }

    case 'goBack':
      await sendToBridge({ cmd: 'go_back' }) || window.history.back();
      return { success: true };

    case 'reloadPage':
      await sendToBridge({ cmd: 'reload' }) || window.location.reload();
      return { success: true };

    case 'typeText':
      await sendToBridge({ cmd: 'type', text: args.text });
      return { success: true };

    case 'pressEnter':
      await sendToBridge({ cmd: 'press_enter' });
      return { success: true };

    case 'clickSelector':
      await sendToBridge({ cmd: 'click', selector: args.selector });
      return { success: true };

    default:
      return { success: false };
  }
};
