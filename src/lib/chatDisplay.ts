export type ChatInlineNode =
  | { type: "text"; value: string }
  | { type: "code"; value: string }
  | { type: "strong"; children: ChatInlineNode[] }
  | { type: "em"; children: ChatInlineNode[] }
  | { type: "del"; children: ChatInlineNode[] }
  | { type: "link"; href: string; children: ChatInlineNode[] };

export type ChatBlockNode =
  | { type: "p"; children: ChatInlineNode[] }
  | { type: "h"; level: 1 | 2 | 3; children: ChatInlineNode[] }
  | { type: "ul"; items: ChatInlineNode[][] }
  | { type: "ol"; items: ChatInlineNode[][] }
  | { type: "quote"; children: ChatInlineNode[] }
  | { type: "pre"; value: string };

const THINK_PAIR =
  /<\s*(think|thinking|thought|redacted_thinking)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const THINK_OPEN = /<\s*(think|thinking|thought|redacted_thinking)\b[^>]*>[\s\S]*$/gi;
const THINK_CLOSE = /<\s*\/\s*(think|thinking|thought|redacted_thinking)\s*>/gi;
const THINK_BRACKET = /\[\s*\/?(?:think|thinking|thought)\s*\]/gi;

const collapseBlank = (text: string) =>
  text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export const stripHiddenThink = (text: string) => {
  let result = text.replace(/\u0000/g, "");
  result = result.replace(THINK_PAIR, "\n");
  result = result.replace(THINK_OPEN, "\n");
  result = result.replace(THINK_CLOSE, "\n");
  result = result.replace(THINK_BRACKET, "");
  return collapseBlank(result);
};

export const safeMarkdownHref = (href: string) => {
  try {
    const url = new URL(href);
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
  } catch {
    return null;
  }
  return null;
};

const takeUntil = (input: string, token: string, from: number) => {
  const end = input.indexOf(token, from);
  return end >= from ? end : -1;
};

const parseInline = (input: string): ChatInlineNode[] => {
  const nodes: ChatInlineNode[] = [];
  let cursor = 0;
  let buffer = "";

  const flush = () => {
    if (!buffer) return;
    nodes.push({ type: "text", value: buffer });
    buffer = "";
  };

  while (cursor < input.length) {
    const rest = input.slice(cursor);
    if (rest.startsWith("`")) {
      const end = takeUntil(input, "`", cursor + 1);
      if (end > cursor) {
        flush();
        nodes.push({ type: "code", value: input.slice(cursor + 1, end) });
        cursor = end + 1;
        continue;
      }
    }
    if (rest.startsWith("~~")) {
      const end = takeUntil(input, "~~", cursor + 2);
      if (end > cursor) {
        flush();
        nodes.push({ type: "del", children: parseInline(input.slice(cursor + 2, end)) });
        cursor = end + 2;
        continue;
      }
    }
    if (rest.startsWith("***")) {
      const end = takeUntil(input, "***", cursor + 3);
      if (end > cursor) {
        flush();
        nodes.push({
          type: "strong",
          children: [{ type: "em", children: parseInline(input.slice(cursor + 3, end)) }],
        });
        cursor = end + 3;
        continue;
      }
    }
    if (rest.startsWith("**")) {
      const end = takeUntil(input, "**", cursor + 2);
      if (end > cursor) {
        flush();
        nodes.push({ type: "strong", children: parseInline(input.slice(cursor + 2, end)) });
        cursor = end + 2;
        continue;
      }
    }
    if (rest.startsWith("__")) {
      const end = takeUntil(input, "__", cursor + 2);
      if (end > cursor) {
        flush();
        nodes.push({ type: "strong", children: parseInline(input.slice(cursor + 2, end)) });
        cursor = end + 2;
        continue;
      }
    }
    if (rest.startsWith("*") && !rest.startsWith("* ")) {
      const end = takeUntil(input, "*", cursor + 1);
      if (end > cursor) {
        flush();
        nodes.push({ type: "em", children: parseInline(input.slice(cursor + 1, end)) });
        cursor = end + 1;
        continue;
      }
    }
    if (rest.startsWith("[")) {
      const labelEnd = takeUntil(input, "]", cursor + 1);
      if (labelEnd > cursor && input[labelEnd + 1] === "(") {
        const hrefEnd = takeUntil(input, ")", labelEnd + 2);
        if (hrefEnd > labelEnd) {
          const href = safeMarkdownHref(input.slice(labelEnd + 2, hrefEnd).trim());
          if (href) {
            flush();
            nodes.push({
              type: "link",
              href,
              children: parseInline(input.slice(cursor + 1, labelEnd)),
            });
            cursor = hrefEnd + 1;
            continue;
          }
        }
      }
    }
    buffer += input[cursor];
    cursor += 1;
  }
  flush();
  return nodes;
};

const headingLevel = (line: string): 1 | 2 | 3 | null => {
  const match = line.match(/^(#{1,3})\s+(.+)$/);
  if (!match) return null;
  return match[1].length as 1 | 2 | 3;
};

const listItem = (line: string) => {
  const unordered = line.match(/^[-*]\s+(.+)$/);
  if (unordered) return { ordered: false, text: unordered[1] };
  const ordered = line.match(/^\d+\.\s+(.+)$/);
  if (ordered) return { ordered: true, text: ordered[1] };
  return null;
};

export const parseChatMarkdown = (text: string): ChatBlockNode[] => {
  const source = collapseBlank(text);
  if (!source) return [];
  const lines = source.split("\n");
  const blocks: ChatBlockNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (line.startsWith("```")) {
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        body.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: "pre", value: body.join("\n") });
      continue;
    }
    const heading = headingLevel(line);
    if (heading) {
      blocks.push({
        type: "h",
        level: heading,
        children: parseInline(line.replace(/^#{1,3}\s+/, "")),
      });
      index += 1;
      continue;
    }
    if (line.startsWith("> ")) {
      const quoted: string[] = [];
      while (index < lines.length && lines[index].startsWith("> ")) {
        quoted.push(lines[index].slice(2));
        index += 1;
      }
      blocks.push({ type: "quote", children: parseInline(quoted.join("\n")) });
      continue;
    }
    const item = listItem(line);
    if (item) {
      const ordered = item.ordered;
      const items: ChatInlineNode[][] = [];
      while (index < lines.length) {
        const next = listItem(lines[index]);
        if (!next || next.ordered !== ordered) break;
        items.push(parseInline(next.text));
        index += 1;
      }
      blocks.push({ type: ordered ? "ol" : "ul", items });
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length) {
      const current = lines[index];
      if (
        !current.trim() ||
        current.startsWith("```") ||
        current.startsWith("> ") ||
        headingLevel(current) ||
        listItem(current)
      ) {
        break;
      }
      paragraph.push(current);
      index += 1;
    }
    blocks.push({ type: "p", children: parseInline(paragraph.join("\n")) });
  }

  return blocks;
};
