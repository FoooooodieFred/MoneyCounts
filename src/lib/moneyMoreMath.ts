/**
 * Tiny arithmetic evaluator for MoneyMore.
 * Supports Python-like + - * / % ** //, parentheses, unary minus, and a few functions.
 * No eval(), no names besides the allowlisted functions.
 */

const FUNCTIONS = new Set(["abs", "sqrt", "round", "min", "max", "sum", "mean"]);

type Token =
  | { kind: "num"; value: number }
  | { kind: "op"; value: string }
  | { kind: "id"; value: string }
  | { kind: "lp" }
  | { kind: "rp" }
  | { kind: "comma" };

const isDigit = (ch: string) => ch >= "0" && ch <= "9";
const isIdStart = (ch: string) => /[A-Za-z_]/.test(ch);
const isIdPart = (ch: string) => /[A-Za-z0-9_]/.test(ch);

const tokenize = (source: string): Token[] => {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i += 1;
      continue;
    }
    if (isDigit(ch) || (ch === "." && isDigit(source[i + 1] ?? ""))) {
      let j = i;
      while (isDigit(source[j] ?? "")) j += 1;
      if (source[j] === ".") {
        j += 1;
        while (isDigit(source[j] ?? "")) j += 1;
      }
      if (source[j] === "e" || source[j] === "E") {
        j += 1;
        if (source[j] === "+" || source[j] === "-") j += 1;
        if (!isDigit(source[j] ?? "")) throw new Error("指数格式无效。");
        while (isDigit(source[j] ?? "")) j += 1;
      }
      const raw = source.slice(i, j);
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new Error(`无法解析数字 ${raw}。`);
      tokens.push({ kind: "num", value });
      i = j;
      continue;
    }
    if (isIdStart(ch)) {
      let j = i + 1;
      while (isIdPart(source[j] ?? "")) j += 1;
      tokens.push({ kind: "id", value: source.slice(i, j).toLowerCase() });
      i = j;
      continue;
    }
    if (ch === "*" && source[i + 1] === "*") {
      tokens.push({ kind: "op", value: "**" });
      i += 2;
      continue;
    }
    if (ch === "/" && source[i + 1] === "/") {
      tokens.push({ kind: "op", value: "//" });
      i += 2;
      continue;
    }
    if ("+-*/%".includes(ch)) {
      tokens.push({ kind: "op", value: ch });
      i += 1;
      continue;
    }
    if (ch === "(") {
      tokens.push({ kind: "lp" });
      i += 1;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "rp" });
      i += 1;
      continue;
    }
    if (ch === ",") {
      tokens.push({ kind: "comma" });
      i += 1;
      continue;
    }
    throw new Error(`不支持的字符：${ch}`);
  }
  return tokens;
};

class Parser {
  private index = 0;
  constructor(private readonly tokens: Token[]) {}

  parse(): number {
    const value = this.parseExpr();
    if (this.index < this.tokens.length) throw new Error("表达式有未解析的尾部。");
    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.index];
  }

  private take(): Token {
    const token = this.tokens[this.index];
    if (!token) throw new Error("表达式不完整。");
    this.index += 1;
    return token;
  }

  private parseExpr(): number {
    return this.parseAdd();
  }

  private parseAdd(): number {
    let left = this.parseMul();
    while (this.peek()?.kind === "op") {
      const op = (this.peek() as { value: string }).value;
      if (op !== "+" && op !== "-") break;
      this.take();
      const right = this.parseMul();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  private parseMul(): number {
    let left = this.parsePow();
    while (
      this.peek()?.kind === "op" &&
      ["*", "/", "%", "//"].includes((this.peek() as { value: string }).value)
    ) {
      const op = (this.take() as { value: string }).value;
      const right = this.parsePow();
      if (op === "*") left *= right;
      else if (op === "/") {
        if (right === 0) throw new Error("除数不能为 0。");
        left /= right;
      } else if (op === "//") {
        if (right === 0) throw new Error("除数不能为 0。");
        left = Math.trunc(left / right);
      } else {
        if (right === 0) throw new Error("除数不能为 0。");
        left %= right;
      }
    }
    return left;
  }

  private parsePow(): number {
    const left = this.parseUnary();
    if (this.peek()?.kind === "op" && (this.peek() as { value: string }).value === "**") {
      this.take();
      const right = this.parsePow();
      return left ** right;
    }
    return left;
  }

  private parseUnary(): number {
    if (this.peek()?.kind === "op" && (this.peek() as { value: string }).value === "+") {
      this.take();
      return this.parseUnary();
    }
    if (this.peek()?.kind === "op" && (this.peek() as { value: string }).value === "-") {
      this.take();
      return -this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const token = this.peek();
    if (!token) throw new Error("表达式不完整。");
    if (token.kind === "num") {
      this.take();
      return token.value;
    }
    if (token.kind === "id") {
      this.take();
      if (!FUNCTIONS.has(token.value)) throw new Error(`不支持的函数：${token.value}`);
      if (this.peek()?.kind !== "lp") throw new Error(`${token.value} 需要括号。`);
      this.take();
      const args: number[] = [];
      if (this.peek()?.kind !== "rp") {
        args.push(this.parseExpr());
        while (this.peek()?.kind === "comma") {
          this.take();
          args.push(this.parseExpr());
        }
      }
      if (this.peek()?.kind !== "rp") throw new Error("缺少右括号。");
      this.take();
      return applyFunction(token.value, args);
    }
    if (token.kind === "lp") {
      this.take();
      const value = this.parseExpr();
      if (this.peek()?.kind !== "rp") throw new Error("缺少右括号。");
      this.take();
      return value;
    }
    throw new Error("表达式语法无效。");
  }
}

const applyFunction = (name: string, args: number[]) => {
  if (name === "abs") {
    if (args.length !== 1) throw new Error("abs 需要 1 个参数。");
    return Math.abs(args[0]);
  }
  if (name === "sqrt") {
    if (args.length !== 1) throw new Error("sqrt 需要 1 个参数。");
    if (args[0] < 0) throw new Error("sqrt 不能作用于负数。");
    return Math.sqrt(args[0]);
  }
  if (name === "round") {
    if (args.length < 1 || args.length > 2) throw new Error("round 需要 1 或 2 个参数。");
    const digits = args[1] ?? 0;
    const factor = 10 ** digits;
    return Math.round(args[0] * factor) / factor;
  }
  if (!args.length) throw new Error(`${name} 至少需要 1 个参数。`);
  if (name === "min") return Math.min(...args);
  if (name === "max") return Math.max(...args);
  if (name === "sum") return args.reduce((sum, item) => sum + item, 0);
  return args.reduce((sum, item) => sum + item, 0) / args.length;
};

export const evaluateMathExpression = (expression: string) => {
  const trimmed = expression.trim();
  if (!trimmed) throw new Error("表达式为空。");
  if (trimmed.length > 400) throw new Error("表达式过长。");
  const parser = new Parser(tokenize(trimmed));
  const value = parser.parse();
  if (!Number.isFinite(value)) throw new Error("计算结果不是有限数字。");
  return value;
};
