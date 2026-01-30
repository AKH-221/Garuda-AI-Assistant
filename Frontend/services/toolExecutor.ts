export const toolDeclarations = [
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
  {
    name: 'searchGoogle',
    description: 'Search something on Google',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'searchYouTube',
    description: 'Search videos on YouTube',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'searchAmazon',
    description: 'Search a product on Amazon',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'searchFlipkart',
    description: 'Search a product on Flipkart',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
];

function normalizeUrl(url: string) {
  if (!url.startsWith('http')) return 'https://' + url;
  return url;
}

export const executeTool = async (toolName: string, args: any) => {
  switch (toolName) {
    case 'openUrl':
      window.location.href = normalizeUrl(args.url);
      return { success: true };

    case 'openUrlNewTab':
      window.open(normalizeUrl(args.url), '_blank', 'noopener,noreferrer');
      return { success: true };

    case 'searchGoogle':
      window.open(
        `https://www.google.com/search?q=${encodeURIComponent(args.query)}`,
        '_blank'
      );
      return { success: true };

    case 'searchYouTube':
      window.open(
        `https://www.youtube.com/results?search_query=${encodeURIComponent(args.query)}`,
        '_blank'
      );
      return { success: true };

    case 'searchAmazon':
      window.open(
        `https://www.amazon.in/s?k=${encodeURIComponent(args.query)}`,
        '_blank'
      );
      return { success: true };

    case 'searchFlipkart':
      window.open(
        `https://www.flipkart.com/search?q=${encodeURIComponent(args.query)}`,
        '_blank'
      );
      return { success: true };

    default:
      return { success: false };
  }
};
