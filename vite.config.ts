import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { defineConfig, type Connect, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const llmProxyHref = pathToFileURL(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "src/lib/llmProxy.ts"),
).href;

function readNodeBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function llmChatProxyPlugin(): Plugin {
  const middleware: Connect.NextHandleFunction = async (
    req: IncomingMessage,
    res: ServerResponse,
    next,
  ) => {
    const rawUrl = req.url ?? "";
    const path = rawUrl.split("?")[0];
    const isChat = path === "/api/llm/chat";
    const isModels = path === "/api/llm/models";
    if (!isChat && !isModels) {
      next();
      return;
    }
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }
    const expectMethod = isChat ? "POST" : "GET";
    if (req.method !== expectMethod) {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }
    try {
      const { handleLlmChatRequest, handleLlmModelsRequest } = (await import(llmProxyHref)) as {
        handleLlmChatRequest: (request: Request) => Promise<Response>;
        handleLlmModelsRequest: (request: Request) => Promise<Response>;
      };
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (!value) continue;
        headers.set(key, Array.isArray(value) ? value.join(", ") : value);
      }
      const request = isChat
        ? new Request("http://vite.local/api/llm/chat", {
            method: "POST",
            headers,
            body: Uint8Array.from(await readNodeBody(req)),
          })
        : new Request(`http://vite.local${rawUrl}`, { method: "GET", headers });
      const response = isChat
        ? await handleLlmChatRequest(request)
        : await handleLlmModelsRequest(request);
      res.statusCode = response.status;
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : "代理失败",
        }),
      );
    }
  };

  return {
    name: "llm-chat-proxy",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

const isDesktopVite = process.env.VITE_DESKTOP === "1";

export default defineConfig({
  base: isDesktopVite ? "./" : "/",
  define: isDesktopVite ? { "import.meta.env.VITE_DESKTOP": JSON.stringify("1") } : undefined,
  plugins: [react(), llmChatProxyPlugin()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: isDesktopVite ? "desktop/dist" : "dist",
    emptyOutDir: true,
  },
});
