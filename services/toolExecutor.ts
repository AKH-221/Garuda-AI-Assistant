
import { FunctionDeclaration, Type } from '@google/genai';

// In a real app, these would interact with the OS. Here, they are mocks.
const openApplication = (name: string) => ({ success: true, message: `Opened application: ${name}` });
const searchWeb = (query: string) => ({ success: true, message: `Searching web for: ${query}` });
const createFolder = (path: string) => ({ success: true, message: `Created folder at: ${path}` });
const deleteFile = (path: string) => ({ success: true, message: `Deleted file/folder at: ${path}` });
const typeText = (text: string) => ({ success: true, message: `Typed text: "${text}"`});

const toolHandlers: { [key: string]: (...args: any[]) => any } = {
  openApplication: ({ name }: { name: string }) => openApplication(name),
  searchWeb: ({ query }: { query: string }) => searchWeb(query),
  createFolder: ({ path }: { path: string }) => createFolder(path),
  deleteFile: ({ path }: { path: string }) => deleteFile(path),
  typeText: ({ text }: { text: string }) => typeText(text),
};

export const executeTool = async (toolName: string, args: any) => {
  console.log(`Executing tool: ${toolName}`, args);
  if (toolHandlers[toolName]) {
    return toolHandlers[toolName](args);
  }
  return { success: false, message: `Unknown tool: ${toolName}` };
};

export const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'openApplication',
    parameters: {
      type: Type.OBJECT,
      description: 'Opens a specified application on the computer.',
      properties: {
        name: { type: Type.STRING, description: 'The name of the application to open, e.g., "Chrome", "Spotify", "Terminal".' },
      },
      required: ['name'],
    },
  },
  {
    name: 'searchWeb',
    parameters: {
      type: Type.OBJECT,
      description: 'Performs a web search using the default browser.',
      properties: {
        query: { type: Type.STRING, description: 'The search query.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'createFolder',
    parameters: {
      type: Type.OBJECT,
      description: 'Creates a new folder at a specified path.',
      properties: {
        path: { type: Type.STRING, description: 'The full path where the folder should be created, e.g., "~/Desktop/New Folder".' },
      },
      required: ['path'],
    },
  },
  {
    name: 'deleteFile',
    parameters: {
      type: Type.OBJECT,
      description: 'Deletes a file or folder at a specified path. This is a destructive action and requires confirmation.',
      properties: {
        path: { type: Type.STRING, description: 'The full path of the file or folder to delete.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'typeText',
    parameters: {
        type: Type.OBJECT,
        description: 'Types a given string of text into the currently active input field.',
        properties: {
            text: { type: Type.STRING, description: 'The text to be typed.'},
        },
        required: ['text'],
    }
  }
];
