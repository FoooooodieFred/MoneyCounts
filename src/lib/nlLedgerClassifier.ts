/**
 * In-browser 35-class category model (char n-grams + keyword features + logistic regression).
 * Weights come from `scripts/train_nl_ledger_classifier.py`. Keep normalize / n-gram
 * extraction in lockstep with that script. Amount, currency, and date stay rule-based.
 */
import model from "./nlLedgerClassifier.model.json";

export type NlLedgerCategoryPrediction = {
  category: string;
  confidence: number;
  margin: number;
};

const NUM_RE = /\d+(?:\.\d+)?/g;
const SPEND_RE = /花了|花费|消费|支出|用了|买了|支付|付了|付款|缴费|交了/g;
const DATE_RE =
  /大前天|大后天|今天|今日|昨天|昨日|前天|明天|后天|这一周|这一周每天|每天|每日|天天|都要/g;
const CURRENCY_RE =
  /hkd|cny|rmb|usd|mop|jpy|eur|krw|thb|sgd|ntd|twd|nzd|gbp|aud|港币|港幣|港元|香港币|香港幣|香港元|人民币|人民幣|美元|美金|澳门元|澳門元|葡币|葡幣|日元|日币|日幣|欧元|歐元|韩元|韓元|泰铢|泰銖|新加坡元|新元|新台币|新台幣|台币|台幣|纽元|紐元|新西兰元|新西蘭元|英镑|英鎊|澳元/g;
const AMOUNT_UNIT_RE = /0\s*(?:元|块钱|块|圆)/g;
const WORD_RE = /[a-z]{2,}/g;
const SPACE_RE = /\s+/g;

const vocabIndex = new Map(model.vocab.map((token, index) => [token, index]));

const resetAndReplace = (source: string, pattern: RegExp, replacement: string) => {
  pattern.lastIndex = 0;
  return source.replace(pattern, replacement);
};

export const normalizeNlLedgerClassifierText = (text: string) => {
  let lowered = text.toLowerCase();
  lowered = resetAndReplace(lowered, NUM_RE, "0");
  lowered = resetAndReplace(lowered, AMOUNT_UNIT_RE, " ");
  lowered = resetAndReplace(lowered, SPEND_RE, " ");
  lowered = resetAndReplace(lowered, DATE_RE, " ");
  lowered = resetAndReplace(lowered, CURRENCY_RE, " ");
  lowered = lowered.replaceAll("0", " ");
  return resetAndReplace(lowered, SPACE_RE, " ").trim();
};

const extractFeatureTokens = (text: string) => {
  const originalLower = text.toLowerCase();
  const normalized = normalizeNlLedgerClassifierText(text);
  const chars = [...normalized];
  const tokens: string[] = [];
  const seen = new Set<string>();

  const add = (token: string) => {
    if (!token || seen.has(token)) return;
    seen.add(token);
    tokens.push(token);
  };

  for (let n = model.nMin; n <= model.nMax; n += 1) {
    if (chars.length < n) continue;
    for (let index = 0; index <= chars.length - n; index += 1) {
      const gram = chars.slice(index, index + n).join("");
      if (gram.trim() === "") continue;
      add(gram);
    }
  }

  WORD_RE.lastIndex = 0;
  for (const word of normalized.match(WORD_RE) ?? []) add(`w:${word}`);

  for (const [, phrases] of model.keywords) {
    for (const phrase of phrases) {
      if (phrase && originalLower.includes(phrase)) add(`k:${phrase}`);
    }
  }

  return tokens;
};

const softmax = (scores: number[]) => {
  let max = -Infinity;
  for (const score of scores) if (score > max) max = score;
  const shifted = scores.map((score) => Math.exp(score - max));
  const sum = shifted.reduce((total, value) => total + value, 0);
  return shifted.map((value) => value / sum);
};

export const classifyNlLedgerCategory = (text: string): NlLedgerCategoryPrediction | null => {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const active = new Map<number, number>();
  for (const token of extractFeatureTokens(trimmed)) {
    const column = vocabIndex.get(token);
    if (column === undefined) continue;
    active.set(column, model.idf[column] ?? 0);
  }

  let sumSquares = 0;
  for (const value of active.values()) sumSquares += value * value;
  const norm = Math.sqrt(sumSquares);
  if (norm > 0) {
    for (const [column, value] of active) active.set(column, value / norm);
  }

  const scores = model.bias.slice();
  for (const [column, value] of active) {
    for (let classIndex = 0; classIndex < scores.length; classIndex += 1) {
      scores[classIndex] += (model.weights[classIndex]?.[column] ?? 0) * value;
    }
  }

  const probabilities = softmax(scores);
  let bestIndex = 0;
  let secondBest = 0;
  for (let index = 1; index < probabilities.length; index += 1) {
    const probability = probabilities[index] ?? 0;
    if (probability > (probabilities[bestIndex] ?? 0)) {
      secondBest = bestIndex;
      bestIndex = index;
    } else if (probability > (probabilities[secondBest] ?? 0) || secondBest === bestIndex) {
      secondBest = index;
    }
  }

  const category = model.classes[bestIndex];
  if (!category) return null;
  return {
    category,
    confidence: probabilities[bestIndex] ?? 0,
    margin: (probabilities[bestIndex] ?? 0) - (probabilities[secondBest] ?? 0),
  };
};
