#!/usr/bin/env python3
"""Train a compact 35-class n-gram logistic model for in-browser ledger classification.

Amount / currency / date stay rule-based. This model only predicts category_zh.
Keyword phrases from `nlLedgerCategories.ts` are extra features and seed rows.

    python3 scripts/train_nl_ledger_classifier.py
"""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

ROOT = Path(__file__).resolve().parents[1]
SAMPLES = ROOT / "data" / "nl-ledger" / "samples.jsonl"
CATEGORIES = ROOT / "data" / "nl-ledger" / "categories.json"
KEYWORDS_TS = ROOT / "src" / "lib" / "nlLedgerCategories.ts"
OUT = ROOT / "src" / "lib" / "nlLedgerClassifier.model.json"

N_MIN = 2
N_MAX = 4
MAX_FEATURES = 8000
WORD_RE = re.compile(r"[a-z]{2,}")
NUM_RE = re.compile(r"\d+(?:\.\d+)?")
SPACE_RE = re.compile(r"\s+")
STRING_RE = re.compile(r'"((?:\\.|[^"\\])*)"')
SPEND_RE = re.compile(r"花了|花费|消费|支出|用了|买了|支付|付了|付款|缴费|交了")
DATE_RE = re.compile(
    r"大前天|大后天|今天|今日|昨天|昨日|前天|明天|后天|这一周|这一周每天|每天|每日|天天|都要"
)
CURRENCY_RE = re.compile(
    r"hkd|cny|rmb|usd|mop|jpy|eur|krw|thb|sgd|ntd|twd|nzd|gbp|aud|"
    r"港币|港幣|港元|香港币|香港幣|香港元|人民币|人民幣|美元|美金|"
    r"澳门元|澳門元|葡币|葡幣|日元|日币|日幣|欧元|歐元|韩元|韓元|"
    r"泰铢|泰銖|新加坡元|新元|新台币|新台幣|台币|台幣|纽元|紐元|"
    r"新西兰元|新西蘭元|英镑|英鎊|澳元"
)
AMOUNT_UNIT_RE = re.compile(r"0\s*(?:元|块钱|块|圆)")


def normalize_ledger_text(text: str) -> str:
    lowered = text.lower()
    lowered = NUM_RE.sub("0", lowered)
    lowered = AMOUNT_UNIT_RE.sub(" ", lowered)
    lowered = SPEND_RE.sub(" ", lowered)
    lowered = DATE_RE.sub(" ", lowered)
    lowered = CURRENCY_RE.sub(" ", lowered)
    lowered = lowered.replace("0", " ")
    lowered = SPACE_RE.sub(" ", lowered).strip()
    return lowered


def load_keyword_table() -> list[tuple[str, list[str]]]:
    source = KEYWORDS_TS.read_text(encoding="utf-8")
    marker = "export const CATEGORY_KEYWORDS"
    start = source.index(marker)
    eq = source.index("=", start)
    i = source.index("[", eq)
    depth = 0
    end = None
    for index in range(i, len(source)):
        char = source[index]
        if char == "[":
            depth += 1
        elif char == "]":
            depth -= 1
            if depth == 0:
                end = index + 1
                break
    if end is None:
        raise SystemExit("failed to find CATEGORY_KEYWORDS array end")

    body = source[i:end]
    table: list[tuple[str, list[str]]] = []
    depth = 0
    entry_start = None
    for index, char in enumerate(body):
        if char == "[":
            depth += 1
            if depth == 2 and entry_start is None:
                entry_start = index
        elif char == "]":
            if depth == 2 and entry_start is not None:
                entry = body[entry_start : index + 1]
                strings = STRING_RE.findall(entry)
                if strings:
                    category, phrases = strings[0], [item.lower() for item in strings[1:] if item]
                    if phrases:
                        table.append((category, phrases))
                entry_start = None
            depth -= 1

    if len(table) < 30:
        raise SystemExit(f"failed to parse keyword table, got {len(table)} classes")
    return table


def extract_feature_tokens(text: str, keyword_table: list[tuple[str, list[str]]]) -> list[str]:
    original_lower = text.lower()
    normalized = normalize_ledger_text(text)
    chars = list(normalized)
    tokens: list[str] = []
    seen: set[str] = set()

    def add(token: str) -> None:
        if token and token not in seen:
            seen.add(token)
            tokens.append(token)

    for n in range(N_MIN, N_MAX + 1):
        if len(chars) < n:
            continue
        for index in range(len(chars) - n + 1):
            gram = "".join(chars[index : index + n])
            if gram.strip() == "":
                continue
            add(gram)

    for word in WORD_RE.findall(normalized):
        add(f"w:{word}")

    for _, phrases in keyword_table:
        for phrase in phrases:
            if phrase and phrase in original_lower:
                add(f"k:{phrase}")

    return tokens


def load_corpus() -> tuple[list[str], list[str]]:
    allowed = {
        item["zh"] for item in json.loads(CATEGORIES.read_text(encoding="utf-8"))["categories"]
    }
    texts: list[str] = []
    labels: list[str] = []
    for line in SAMPLES.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        sample = json.loads(line)
        label = sample["category_zh"]
        if label not in allowed:
            raise SystemExit(f"unknown category_zh: {label}")
        texts.append(sample["text"])
        labels.append(label)
    return texts, labels


def seed_keyword_rows(keyword_table: list[tuple[str, list[str]]]) -> tuple[list[str], list[str]]:
    texts: list[str] = []
    labels: list[str] = []
    for category, phrases in keyword_table:
        for phrase in phrases:
            variants = [phrase, f"{phrase} 0", f"花了0{phrase}"]
            if re.fullmatch(r"[\u4e00-\u9fff]+", phrase):
                variants.append(f"买{phrase}")
            for variant in variants:
                texts.append(variant)
                labels.append(category)
    return texts, labels


def forced_tokens(keyword_table: list[tuple[str, list[str]]]) -> list[str]:
    tokens: list[str] = []
    seen: set[str] = set()
    for category, phrases in keyword_table:
        for phrase in phrases:
            for extra in (phrase, f"{phrase} 0", f"花了0{phrase}", f"{phrase}花了0"):
                for token in extract_feature_tokens(extra, keyword_table):
                    if token not in seen:
                        seen.add(token)
                        tokens.append(token)
            key = f"k:{phrase}"
            if key not in seen:
                seen.add(key)
                tokens.append(key)
        _ = category
    return tokens


def build_vocab(
    train_texts: list[str],
    keyword_table: list[tuple[str, list[str]]],
) -> list[str]:
    document_freq: Counter[str] = Counter()
    for text in train_texts:
        document_freq.update(extract_feature_tokens(text, keyword_table))
    required = forced_tokens(keyword_table)
    vocab: list[str] = []
    seen: set[str] = set()
    for token in required:
        if token not in seen:
            seen.add(token)
            vocab.append(token)
    ranked = sorted(document_freq.items(), key=lambda item: (-item[1], item[0]))
    for token, _ in ranked:
        if token in seen:
            continue
        vocab.append(token)
        seen.add(token)
        if len(vocab) >= MAX_FEATURES:
            break
    return vocab


def vectorize(
    texts: list[str],
    vocab_index: dict[str, int],
    idf: np.ndarray | None,
    keyword_table: list[tuple[str, list[str]]],
) -> np.ndarray:
    matrix = np.zeros((len(texts), len(vocab_index)), dtype=np.float64)
    for row, text in enumerate(texts):
        for token in extract_feature_tokens(text, keyword_table):
            column = vocab_index.get(token)
            if column is not None:
                matrix[row, column] = 1.0
        if idf is not None:
            matrix[row] *= idf
            norm = np.linalg.norm(matrix[row])
            if norm > 0:
                matrix[row] /= norm
    return matrix


def compute_idf(binary_matrix: np.ndarray) -> np.ndarray:
    n_samples = binary_matrix.shape[0]
    df = binary_matrix.sum(axis=0)
    return np.log((1.0 + n_samples) / (1.0 + df)) + 1.0


def fit_model(x: np.ndarray, y: np.ndarray) -> LogisticRegression:
    model = LogisticRegression(
        max_iter=800,
        C=3.0,
        solver="lbfgs",
        random_state=31,
    )
    model.fit(x, y)
    return model


def predict_label(
    text: str,
    model: LogisticRegression,
    vocab_index: dict[str, int],
    idf: np.ndarray,
    keyword_table: list[tuple[str, list[str]]],
    classes: np.ndarray,
) -> str:
    vector = vectorize([text], vocab_index, idf, keyword_table)
    scores = model.decision_function(vector)[0]
    return str(classes[int(np.argmax(scores))])


def main() -> None:
    keyword_table = load_keyword_table()
    print(f"keyword classes={len(keyword_table)} phrases={sum(len(p) for _, p in keyword_table)}")
    texts, labels = load_corpus()
    seed_texts, seed_labels = seed_keyword_rows(keyword_table)

    encoder = LabelEncoder()
    encoder.fit(labels + seed_labels)

    train_texts, test_texts, train_labels, test_labels = train_test_split(
        texts,
        labels,
        test_size=0.2,
        random_state=31,
        stratify=labels,
    )
    probe_train_texts = train_texts + seed_texts
    probe_train_y = encoder.transform(train_labels + seed_labels)
    vocab = build_vocab(probe_train_texts, keyword_table)
    vocab_index = {token: index for index, token in enumerate(vocab)}
    train_binary = vectorize(probe_train_texts, vocab_index, None, keyword_table)
    idf = compute_idf(train_binary)
    x_train = vectorize(probe_train_texts, vocab_index, idf, keyword_table)
    x_test = vectorize(test_texts, vocab_index, idf, keyword_table)
    probe = fit_model(x_train, probe_train_y)
    predicted = probe.predict(x_test)
    print(
        classification_report(
            encoder.transform(test_labels),
            predicted,
            target_names=encoder.classes_,
            digits=3,
            zero_division=0,
        )
    )

    shipped_texts = texts + seed_texts
    shipped_y = encoder.transform(labels + seed_labels)
    vocab = build_vocab(shipped_texts, keyword_table)
    vocab_index = {token: index for index, token in enumerate(vocab)}
    shipped_binary = vectorize(shipped_texts, vocab_index, None, keyword_table)
    idf = compute_idf(shipped_binary)
    shipped = fit_model(vectorize(shipped_texts, vocab_index, idf, keyword_table), shipped_y)

    probes = {
        "星巴克 38 HKD": "餐饮美食",
        "地铁来回 10.8HKD": "交通出行",
        "发工资 5000": "工资收入",
        "淘宝退款50元": "购物退款",
        "今天明天都要洗衣服花10HKD": "日用百货",
        "lunch 50 HKD": "餐饮美食",
        "朋友还我100": "他人还款",
        "花了45元买水果": "商超购物",
        "公交12": "交通出行",
        "报销到账200元": "报销到账",
        "会员 68": "休闲娱乐",
        "33块钱的充值": "休闲娱乐",
        "负30元交通": "交通出行",
    }
    failed = 0
    for raw, expected in probes.items():
        got = predict_label(raw, shipped, vocab_index, idf, keyword_table, encoder.classes_)
        mark = "ok" if got == expected else "FAIL"
        if got != expected:
            failed += 1
        print(f"  [{mark}] {raw!r} -> {got} (want {expected})")
    if failed:
        raise SystemExit(f"{failed} probe(s) failed")

    payload = {
        "version": 2,
        "nMin": N_MIN,
        "nMax": N_MAX,
        "classes": encoder.classes_.tolist(),
        "vocab": vocab,
        "idf": np.round(idf, 6).tolist(),
        "bias": np.round(shipped.intercept_.astype(np.float64), 6).tolist(),
        "weights": np.round(shipped.coef_.astype(np.float64), 6).tolist(),
        "keywords": keyword_table,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes), vocab={len(vocab)}")


if __name__ == "__main__":
    main()
