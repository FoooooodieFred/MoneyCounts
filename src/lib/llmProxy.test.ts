import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractModelIds,
  handleLlmChatRequest,
  handleLlmModelsRequest,
  resolveUpstreamUrl,
} from "./llmProxy";

type FetchArgs = [string, RequestInit];

const mockFetch = (body: unknown, status = 200) => {
  const calls: FetchArgs[] = [];
  const spy = vi.fn(async (url: string, init: RequestInit) => {
    calls.push([url, init]);
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", spy);
  return { spy, calls };
};

const chatRequest = (body: unknown, apiKey = "sk-test") =>
  new Request("http://localhost/api/llm/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("upstream url per api style", () => {
  it("appends the endpoint that matches the style", () => {
    expect(resolveUpstreamUrl("https://api.openai.com/v1", "chat-completions")).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
    expect(resolveUpstreamUrl("https://api.openai.com/v1", "responses")).toBe(
      "https://api.openai.com/v1/responses",
    );
    expect(resolveUpstreamUrl("https://api.anthropic.com/v1", "anthropic")).toBe(
      "https://api.anthropic.com/v1/messages",
    );
  });

  it("does not double up an endpoint that is already there", () => {
    expect(resolveUpstreamUrl("https://api.openai.com/v1/chat/completions", "chat-completions")).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
    expect(resolveUpstreamUrl("https://api.anthropic.com/v1/messages", "anthropic")).toBe(
      "https://api.anthropic.com/v1/messages",
    );
  });

  it("keeps a fully qualified MiniMax endpoint as-is", () => {
    expect(resolveUpstreamUrl("https://api.minimaxi.com/v1/text/chatcompletion_v2")).toBe(
      "https://api.minimaxi.com/v1/text/chatcompletion_v2",
    );
  });
});

describe("chat-completions style", () => {
  it("forwards the model, messages and usage", async () => {
    const { calls } = mockFetch({
      choices: [{ message: { content: "ok" } }],
      usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 },
    });
    const response = await handleLlmChatRequest(
      chatRequest({
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: "hi" }],
      }),
    );
    expect(calls[0][0]).toBe("https://api.openai.com/v1/chat/completions");
    const payload = JSON.parse(String(calls[0][1].body));
    expect(payload.model).toBe("gpt-4.1-mini");
    expect(payload.stream).toBe(false);
    expect(payload.response_format).toEqual({ type: "json_object" });

    const body = (await response.json()) as {
      choices: { message: { content: string } }[];
      usage: { total_tokens: number };
    };
    expect(body.choices[0].message.content).toBe("ok");
    expect(body.usage.total_tokens).toBe(15);
  });

  it("adds top_p, max_tokens and the extra body fields", async () => {
    const { calls } = mockFetch({ choices: [{ message: { content: "ok" } }] });
    await handleLlmChatRequest(
      chatRequest({
        baseUrl: "https://api.openai.com/v1",
        model: "m",
        messages: [{ role: "user", content: "hi" }],
        topP: 0.3,
        maxTokens: 512,
        extraBody: { reasoning_effort: "high" },
      }),
    );
    const payload = JSON.parse(String(calls[0][1].body));
    expect(payload.top_p).toBe(0.3);
    expect(payload.max_tokens).toBe(512);
    expect(payload.reasoning_effort).toBe("high");
  });

  it("never lets the extra body override the model or the auth", async () => {
    const { calls } = mockFetch({ choices: [{ message: { content: "ok" } }] });
    await handleLlmChatRequest(
      chatRequest({
        baseUrl: "https://api.openai.com/v1",
        model: "real-model",
        messages: [{ role: "user", content: "hi" }],
        extraBody: { model: "hijacked", stream: true },
      }),
    );
    const payload = JSON.parse(String(calls[0][1].body));
    expect(payload.model).toBe("real-model");
    expect(payload.stream).toBe(false);
  });

  it("never lets the extra headers override the authorization", async () => {
    const { calls } = mockFetch({ choices: [{ message: { content: "ok" } }] });
    await handleLlmChatRequest(
      chatRequest({
        baseUrl: "https://api.openai.com/v1",
        model: "m",
        messages: [{ role: "user", content: "hi" }],
        extraHeaders: { Authorization: "Bearer evil", "X-Team": "core" },
      }),
    );
    const headers = calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-test");
    expect(headers["X-Team"]).toBe("core");
  });
});

describe("responses style", () => {
  it("builds a responses payload and normalizes the answer", async () => {
    const { calls } = mockFetch({
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: "hello" }],
        },
      ],
      usage: { input_tokens: 20, output_tokens: 4, total_tokens: 24 },
    });
    const response = await handleLlmChatRequest(
      chatRequest({
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-5",
        apiStyle: "responses",
        messages: [
          { role: "system", content: "be terse" },
          { role: "user", content: "hi" },
        ],
      }),
    );
    expect(calls[0][0]).toBe("https://api.openai.com/v1/responses");
    const payload = JSON.parse(String(calls[0][1].body));
    expect(payload.instructions).toBe("be terse");
    expect(payload.input).toEqual([{ role: "user", content: "hi" }]);
    expect(payload.text).toEqual({ format: { type: "json_object" } });

    const body = (await response.json()) as {
      choices: { message: { content: string } }[];
      usage: { prompt_tokens: number; completion_tokens: number };
    };
    expect(body.choices[0].message.content).toBe("hello");
    expect(body.usage.prompt_tokens).toBe(20);
    expect(body.usage.completion_tokens).toBe(4);
  });
});

describe("anthropic style", () => {
  it("sends x-api-key and converts the message list", async () => {
    const { calls } = mockFetch({
      content: [{ type: "text", text: "bonjour" }],
      usage: { input_tokens: 30, output_tokens: 6 },
    });
    const response = await handleLlmChatRequest(
      chatRequest({
        baseUrl: "https://api.anthropic.com/v1",
        model: "claude-sonnet-4-5",
        apiStyle: "anthropic",
        messages: [
          { role: "system", content: "be terse" },
          { role: "user", content: "hi" },
        ],
      }),
    );
    expect(calls[0][0]).toBe("https://api.anthropic.com/v1/messages");
    const headers = calls[0][1].headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-test");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(headers.Authorization).toBeUndefined();

    const payload = JSON.parse(String(calls[0][1].body));
    expect(payload.system).toBe("be terse");
    expect(payload.messages).toEqual([{ role: "user", content: "hi" }]);
    expect(payload.max_tokens).toBeGreaterThan(0);

    const body = (await response.json()) as {
      choices: { message: { content: string } }[];
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };
    expect(body.choices[0].message.content).toBe("bonjour");
    expect(body.usage.total_tokens).toBe(36);
  });
});

describe("proxy guards", () => {
  it("rejects a missing api key", async () => {
    mockFetch({});
    const response = await handleLlmChatRequest(
      new Request("http://localhost/api/llm/chat", {
        method: "POST",
        body: JSON.stringify({ baseUrl: "https://x.test/v1", model: "m", messages: [] }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("rejects a non-https base url", async () => {
    mockFetch({});
    const response = await handleLlmChatRequest(
      chatRequest({
        baseUrl: "http://evil.test/v1",
        model: "m",
        messages: [{ role: "user", content: "hi" }],
      }),
    );
    expect(response.status).toBe(400);
  });

  it("passes the upstream error through untouched", async () => {
    mockFetch({ error: { message: "quota exceeded" } }, 429);
    const response = await handleLlmChatRequest(
      chatRequest({
        baseUrl: "https://api.openai.com/v1",
        model: "m",
        messages: [{ role: "user", content: "hi" }],
      }),
    );
    expect(response.status).toBe(429);
    const body = (await response.json()) as { error: { message: string } };
    expect(body.error.message).toBe("quota exceeded");
  });
});

describe("model discovery", () => {
  it("extracts ids from the common response shapes", () => {
    expect(extractModelIds({ data: [{ id: "a" }, { id: "b" }] })).toEqual(["a", "b"]);
    expect(extractModelIds({ models: ["a", "b"] })).toEqual(["a", "b"]);
    expect(extractModelIds(["a", { id: "b" }])).toEqual(["a", "b"]);
    expect(extractModelIds({ nothing: true })).toEqual([]);
  });

  it("lists the models the provider reports", async () => {
    const { calls } = mockFetch({ data: [{ id: "model-a" }, { id: "model-b" }] });
    const response = await handleLlmModelsRequest(
      new Request(
        "http://localhost/api/llm/models?baseUrl=https%3A%2F%2Fapi.openai.com%2Fv1",
        { headers: { Authorization: "Bearer sk-test" } },
      ),
    );
    expect(calls[0][0]).toBe("https://api.openai.com/v1/models");
    const body = (await response.json()) as { models: string[] };
    expect(body.models).toEqual(["model-a", "model-b"]);
  });

  it("explains the failure when the provider has no model list", async () => {
    mockFetch({ error: "nope" }, 404);
    const response = await handleLlmModelsRequest(
      new Request("http://localhost/api/llm/models?baseUrl=https%3A%2F%2Fapi.openai.com%2Fv1", {
        headers: { Authorization: "Bearer sk-test" },
      }),
    );
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("手动填写模型名");
  });
});
