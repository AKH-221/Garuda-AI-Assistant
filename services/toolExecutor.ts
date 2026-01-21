import { Type } from "@google/genai";

/**
 * Tool declarations exposed to Gemini
 * These are GENERAL browser tools (NOT YouTube-only)
 */
export const toolDeclarations = [
  {
    name: "openUrl",
    description: "Open a website in the current browser tab",
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: { type: Type.STRING },
      },
      required: ["url"],
    },
  },
  {
    name: "openUrlNewTab",
    description: "Open a website in a new browser tab",
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: { type: Type.STRING },
      },
      required: ["url"],
    },
  },
  {
    name: "scrollPage",
    description: "Scroll the current page",
    parameters: {
      type: Type.OBJECT,
      properties: {
        direction: { type: Type.STRING, enum: ["up", "down"] },
        amount: { type: Type.NUMBER },
      },
      required: ["direction"],
    },
  },
  { name: "goBack", description: "Go back in browser history", parameters: { type: Type.OBJECT, properties: {} } },
  { name: "reloadPage", description: "Reload the current page", parameters: { type: Type.OBJECT, properties: {} } },
  {
    name: "typeText",
    description: "Type text into the currently focused input",
    parameters: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING },
      },
      required: ["text"],
    },
  },
  { name: "pressEnter", description: "Press Enter key", parameters: { type: Type.OBJECT, properties: {} } },
  {
    name: "clickSelector",
    description: "Click an element using a CSS selector",
    parameters: {
      type: Type.OBJECT,
      properties: {
        selector: { type: Type.STRING },
      },
      required: ["selector"],
    },
  },
];

/**
 * Sends commands to LOCAL BRIDGE → Chrome Extension
 */
async function sendToBridge(payload: any) {
  await fetch("http://localhost:4545/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/**
 * Executes tool calls from Gemini
 */
export async function executeTool(name: string, args: any) {
  switch (name) {
    case "openUrl":
      await sendToBridge({ cmd: "open_url", url: args.url });
      return { ok: true };

    case "openUrlNewTab":
      await sendToBridge({ cmd: "new_tab", url: args.url });
      return { ok: true };

    case "scrollPage":
      await sendToBridge({
        cmd: "scroll",
        direction: args.direction,
        amount: args.amount ?? 800,
      });
      return { ok: true };

    case "goBack":
      await sendToBridge({ cmd: "go_back" });
      return { ok: true };

    case "reloadPage":
      await sendToBridge({ cmd: "reload" });
      return { ok: true };

    case "typeText":
      await sendToBridge({ cmd: "type", text: args.text });
      return { ok: true };

    case "pressEnter":
      await sendToBridge({ cmd: "press_enter" });
      return { ok: true };

    case "clickSelector":
      await sendToBridge({ cmd: "click", selector: args.selector });
      return { ok: true };

    default:
      console.warn("Unknown tool:", name, args);
      return { ok: false };
  }
}
