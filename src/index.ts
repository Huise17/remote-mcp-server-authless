
import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

type AppEnv = Env & {
  GEMINI_API_KEY: string;
  MCP_ACCESS_TOKEN: string;
};

function createServer(apiKey: string) {
  const server = new McpServer({
    name: "Gemini MCP Bridge",
    version: "1.0.0",
  });

  server.registerTool(
    "add",
    {
      inputSchema: z.object({
        a: z.number(),
        b: z.number(),
      }),
    },
    async ({ a, b }) => ({
      content: [{ type: "text", text: String(a + b) }],
    }),
  );

  server.registerTool(
    "ask_gemini",
    {
      description: "Send a question to Google Gemini and return its answer.",
      inputSchema: z.object({
        prompt: z.string().min(1).max(20000),
      }),
    },
    async ({ prompt }) => {
      try {
        const response = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [{ text: prompt }],
                },
              ],
            }),
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          return {
            content: [{
              type: "text",
              text: `Gemini API error (${response.status}): ${errorText}`,
            }],
          };
        }

        const data = await response.json() as {
          candidates?: Array<{
            content?: {
              parts?: Array<{ text?: string }>;
            };
          }>;
        };

        const answer = data.candidates?.[0]?.content?.parts
          ?.map((part) => part.text ?? "")
          .join("\n");

        return {
          content: [{
            type: "text",
            text: answer || "Gemini tidak memberikan jawaban.",
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error: ${String(error)}`,
          }],
        };
      }
    },
  );

  return server;
}

export default {
  fetch(request: Request, env: AppEnv, ctx: ExecutionContext) {
    if (request.method !== "OPTIONS") {
     const token = request.headers.get("x-api-key");
if (token !== env.MCP_ACCESS_TOKEN) {
  return new Response("Unauthorized", { status: 401 });
}
    }

    const handler = createMcpHandler(
      () => createServer(env.GEMINI_API_KEY),
    );

    return handler(request, env, ctx);
  },
} satisfies ExportedHandler<AppEnv>;
