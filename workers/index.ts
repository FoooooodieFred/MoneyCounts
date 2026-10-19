import { handleLlmChatRequest, handleLlmModelsRequest } from "../src/lib/llmProxy";

const notFound = () =>
  new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const methodNotAllowed = () =>
  new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/llm/chat") {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
      }
      if (request.method !== "POST") return methodNotAllowed();
      return handleLlmChatRequest(request);
    }
    if (url.pathname === "/api/llm/models") {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
      }
      if (request.method !== "GET") return methodNotAllowed();
      return handleLlmModelsRequest(request);
    }
    return notFound();
  },
};
