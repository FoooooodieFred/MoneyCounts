import type { ReactNode } from "react";
import { parseChatMarkdown, type ChatInlineNode } from "../lib/chatDisplay";

const renderInline = (nodes: ChatInlineNode[], keyPrefix: string): ReactNode[] =>
  nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    if (node.type === "text") {
      return node.value.split("\n").map((line, lineIndex) => (
        <span key={`${key}-${lineIndex}`}>
          {lineIndex > 0 ? <br /> : null}
          {line}
        </span>
      ));
    }
    if (node.type === "code") return <code key={key}>{node.value}</code>;
    if (node.type === "strong")
      return <strong key={key}>{renderInline(node.children, key)}</strong>;
    if (node.type === "em") return <em key={key}>{renderInline(node.children, key)}</em>;
    if (node.type === "del") return <del key={key}>{renderInline(node.children, key)}</del>;
    return (
      <a key={key} href={node.href} target="_blank" rel="noreferrer">
        {renderInline(node.children, key)}
      </a>
    );
  });

type ChatMarkdownProps = {
  text: string;
};

export function ChatMarkdown({ text }: ChatMarkdownProps) {
  const blocks = parseChatMarkdown(text);
  if (!blocks.length) return null;
  return (
    <div className="chat-md">
      {blocks.map((block, index) => {
        const key = `b${index}`;
        if (block.type === "p") return <p key={key}>{renderInline(block.children, key)}</p>;
        if (block.type === "h") {
          const Tag = block.level === 1 ? "h3" : block.level === 2 ? "h4" : "h5";
          return <Tag key={key}>{renderInline(block.children, key)}</Tag>;
        }
        if (block.type === "quote") {
          return <blockquote key={key}>{renderInline(block.children, key)}</blockquote>;
        }
        if (block.type === "pre") return <pre key={key}>{block.value}</pre>;
        const ListTag = block.type === "ol" ? "ol" : "ul";
        return (
          <ListTag key={key}>
            {block.items.map((item, itemIndex) => (
              <li key={`${key}-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>
            ))}
          </ListTag>
        );
      })}
    </div>
  );
}
