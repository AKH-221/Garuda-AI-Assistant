import { Type } from "@google/genai";

/**
 * Tool declarations
 * These tell Gemini WHAT actions it is allowed to call
 */
export const toolDeclarations = [
  {
    name: "openUrl",
    description: "Open a website in the current browser tab",
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: {
          type: Type.STRING,
          description: "Website URL to open",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "searchGoogle",
    description: "Search something on Google",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "Search query",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "scrollPage",
    description: "Scroll the current page",
    parameters: {
      type: Type.OBJECT,
      properties: {
        direction: {
          type: Type.STRING,
          enum: ["up", "down"],
        },
        amount: {
          type: Type.NUMBER,
          description: "Scroll amount in pixels",
        },
      },
      required: ["direction"],
    },
  },
  {
    name: "goBack",
    description: "Go back in browser history",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "reloadPage",
    description: "Reload the current page",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
];

/**
 * Tool executor
 * This actually performs the browser actions
 */
export async function executeTool(name: string, args: any) {
  switch (name) {
    case "openUrl": {
      let url = String(args?.url || "").trim();
      if (!url) return { ok: false };

      if (!url.startsWith("http")) {
        url = "https://" + url;
      }

      window.location.href = url;
      return { ok: true };
    }

    case "searchGoogle": {
      const q = String(args?.query || "").trim();
      if (!q) return { ok: false };

      window.location.href =
        "https://www.google.com/search?q=" +
        encodeURIComponent(q);

      return { ok: true };
    }

    case "scrollPage": {
      const dir = args?.direction === "up" ? -1 : 1;
      const amt = typeof args?.amount === "number" ? args.amount : 800;

      window.scrollBy({
        top: dir * amt,
        left: 0,
        behavior: "smooth",
      });

      return { ok: true };
    }

    case "goBack":
      window.history.back();
      return { ok: true };

    case "reloadPage":
      window.location.reload();
      return { ok: true };

    default:
      console.warn("Unknown tool:", name);
      return { ok: false };
  }
}
