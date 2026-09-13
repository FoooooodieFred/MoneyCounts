import { describe, expect, it } from "vitest";
import { parseChatMarkdown, safeMarkdownHref, stripHiddenThink } from "./chatDisplay";

describe("stripHiddenThink", () => {
  it("removes paired think tags and keeps the visible reply", () => {
    expect(stripHiddenThink("你好<think>内部推理 123</think>**本月支出**偏高")).toBe(
      "你好\n**本月支出**偏高",
    );
  });

  it("hides unclosed think blocks", () => {
    expect(stripHiddenThink("<think>不要看\n还在想")).toBe("");
    expect(stripHiddenThink("结论：42\n<think>后续推理")).toBe("结论：42");
  });

  it("strips leftover closing tags", () => {
    expect(stripHiddenThink("</think>可以记一笔咖啡")).toBe("可以记一笔咖啡");
  });
});

describe("parseChatMarkdown", () => {
  it("parses bold, italic, strike and inline code", () => {
    const [paragraph] = parseChatMarkdown("这是 **加粗** 和 *斜体*，还有 ~~删除~~ 与 `code`");
    expect(paragraph).toMatchObject({ type: "p" });
    if (paragraph?.type !== "p") throw new Error("expected paragraph");
    const types = paragraph.children.map((node) => node.type);
    expect(types).toEqual(["text", "strong", "text", "em", "text", "del", "text", "code"]);
  });

  it("parses lists and headings", () => {
    const blocks = parseChatMarkdown("# 摘要\n\n- 餐饮\n- 交通\n\n1. 第一\n2. 第二");
    expect(blocks.map((item) => item.type)).toEqual(["h", "ul", "ol"]);
  });

  it("only keeps http(s) links", () => {
    expect(safeMarkdownHref("https://example.com/a")).toBe("https://example.com/a");
    expect(safeMarkdownHref("javascript:alert(1)")).toBeNull();
  });
});
