#!/usr/bin/env python3
"""Export bilingual CSV/JSONL from pairs/*.json. Dates use anchor 2026-08-31 (Monday)."""
from __future__ import annotations

import csv
import json
import re
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ANCHOR = date(2026, 8, 31)
ANCHOR_KEY = ANCHOR.isoformat()

CURRENCY_SURFACES = {
    "HKD": ["HKD", "HK$", "港币", "港幣", "港元", "HK dollars", "hk dollars"],
    "CNY": ["CNY", "RMB", "人民币", "人民幣", "yuan", "Yuan", "元", "块钱", "块", "bucks"],
    "USD": ["USD", "US$", "美元", "美金", "bucks"],
    "MOP": ["MOP", "澳门元", "澳門元", "葡币", "葡幣"],
    "JPY": ["JPY", "日元", "日币", "日幣", "yen"],
    "EUR": ["EUR", "欧元", "歐元", "euro"],
    "KRW": ["KRW", "韩元", "韓元"],
    "THB": ["THB", "泰铢", "泰銖"],
    "SGD": ["SGD", "新加坡元", "新元"],
    "NTD": ["NTD", "TWD", "新台币", "新台幣", "台币", "台幣"],
    "NZD": ["NZD", "纽元", "紐元"],
    "GBP": ["GBP", "英镑", "英鎊"],
    "AUD": ["AUD", "澳元"],
}


def fmt(day: date) -> str:
    return day.isoformat()


def shift(day: date, offset: int) -> date:
    return day + timedelta(days=offset)


def week_dates(anchor: date, week_offset: int) -> list[date]:
    monday = anchor - timedelta(days=anchor.weekday()) + timedelta(weeks=week_offset)
    return [monday + timedelta(days=index) for index in range(7)]


def resolve_date_spec(spec: str, anchor: date = ANCHOR) -> list[str]:
    trimmed = (spec or "anchor").strip() or "anchor"
    if trimmed == "anchor":
        return [fmt(anchor)]
    if trimmed.startswith("rel:"):
        dates: list[str] = []
        seen: set[str] = set()
        for raw in trimmed[4:].split(","):
            key = fmt(shift(anchor, int(raw)))
            if key not in seen:
                seen.add(key)
                dates.append(key)
        return dates
    if trimmed.startswith("week:"):
        return [fmt(day) for day in week_dates(anchor, int(trimmed[5:]))]
    if trimmed.startswith("weekday:"):
        rest = trimmed[8:]
        parts = rest.split(":")
        if len(parts) == 1:
            week_offset, weekday = 0, int(parts[0])
        else:
            week_offset, weekday = int(parts[0]), int(parts[1])
        return [fmt(week_dates(anchor, week_offset)[weekday - 1])]
    if trimmed.startswith("ymd:"):
        return [trimmed[4:]]
    if trimmed.startswith("md:"):
        month, day = (int(part) for part in trimmed[3:].split("-"))
        return [date(anchor.year, month, day).isoformat()]
    if trimmed.startswith("span:"):
        start, end = (int(part) for part in trimmed[5:].split(":"))
        return [fmt(shift(anchor, offset)) for offset in range(start, end + 1)]
    raise ValueError(f"Unknown date_spec: {spec}")


def find_amount_span(text: str, unsigned: str) -> dict[str, int] | None:
    match = re.search(rf"(?<!\d){re.escape(unsigned)}(?!\d)", text)
    if not match:
        return None
    return {"start": match.start(), "end": match.end()}


def find_surface_span(text: str, surfaces: list[str]) -> dict[str, int] | None:
    lower = text.lower()
    best: dict[str, int] | None = None
    for surface in sorted(surfaces, key=len, reverse=True):
        idx = lower.find(surface.lower())
        if idx < 0:
            continue
        span = {"start": idx, "end": idx + len(surface)}
        if best is None or (span["end"] - span["start"]) > (best["end"] - best["start"]):
            best = span
    return best


def find_note_span(text: str, note: str) -> dict[str, int] | None:
    if not note:
        return None
    idx = text.find(note)
    if idx >= 0:
        return {"start": idx, "end": idx + len(note)}
    idx = text.lower().find(note.lower())
    if idx >= 0:
        return {"start": idx, "end": idx + len(note)}
    return None


def slice_span(text: str, span: dict[str, int] | None) -> str | None:
    if not span:
        return None
    return text[span["start"] : span["end"]]


def load_pairs() -> list[dict]:
    meta = json.loads((ROOT / "categories.json").read_text(encoding="utf-8"))
    order = [item["id"] for item in meta["categories"]]
    by_id = {item["id"]: item for item in meta["categories"]}
    rows: list[dict] = []
    for category_id in order:
        path = ROOT / "pairs" / f"{category_id}.json"
        items = json.loads(path.read_text(encoding="utf-8"))
        if len(items) != 50:
            raise SystemExit(f"{category_id} has {len(items)} pairs")
        for item in items:
            rows.append({**item, "category_en": by_id[category_id]["en"], "kind": by_id[category_id]["kind"]})
    return rows


def expand_lang(item: dict, lang: str) -> dict:
    unsigned = str(item["amount"]).lstrip("-")
    text = item["zh"] if lang == "zh" else item["en"]
    note = item["note_zh"] if lang == "zh" else item["note_en"]
    dates = resolve_date_spec(item["date_spec"])
    amount_span = find_amount_span(text, unsigned)
    currency_span = find_surface_span(text, CURRENCY_SURFACES.get(item["currency"], [item["currency"]]))
    note_span = find_note_span(text, note)
    sample_id = f"{item['category_id']}-{lang}-{int(item['index']):03d}"
    return {
        "id": sample_id,
        "lang": lang,
        "category_id": item["category_id"],
        "category_zh": item["category_zh"],
        "category_en": item["category_en"],
        "kind": item["kind"],
        "text": text,
        "amount": item["amount"],
        "currency": item["currency"],
        "note": note,
        "date_spec": item["date_spec"],
        "dates": dates,
        "anchor_date": ANCHOR_KEY,
        "spans": {
            "amount": amount_span,
            "currency": currency_span,
            "note": note_span,
        },
    }


def write_csv(path: Path, rows: list[dict], fieldnames: list[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    **row,
                    "dates": "|".join(row["dates"]),
                }
            )


def main() -> None:
    pairs = load_pairs()
    samples = [expand_lang(item, lang) for item in pairs for lang in ("zh", "en")]
    missing_amount = [row["id"] for row in samples if row["spans"]["amount"] is None]
    if missing_amount:
        raise SystemExit(f"amount span missing: {missing_amount[:8]}")

    jsonl_path = ROOT / "samples.jsonl"
    with jsonl_path.open("w", encoding="utf-8") as handle:
        for row in samples:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")

    csv_fields = [
        "id",
        "lang",
        "category_id",
        "category_zh",
        "category_en",
        "kind",
        "text",
        "amount",
        "currency",
        "note",
        "date_spec",
        "dates",
        "anchor_date",
    ]
    write_csv(ROOT / "ledger_utterances.csv", samples, csv_fields)
    write_csv(ROOT / "zh.csv", [row for row in samples if row["lang"] == "zh"], csv_fields)
    write_csv(ROOT / "en.csv", [row for row in samples if row["lang"] == "en"], csv_fields)

    human_fields = [
        "分类名称",
        "语言",
        "自然表达",
        "金额",
        "币种",
        "备注",
        "日期规则",
        "展开日期",
    ]
    with (ROOT / "记账语义数据集.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=human_fields)
        writer.writeheader()
        for row in samples:
            writer.writerow(
                {
                    "分类名称": row["category_zh"],
                    "语言": row["lang"],
                    "自然表达": row["text"],
                    "金额": row["amount"],
                    "币种": row["currency"],
                    "备注": row["note"],
                    "日期规则": row["date_spec"],
                    "展开日期": "|".join(row["dates"]),
                }
            )

    print(f"exported {len(samples)} samples ({len(pairs)} pairs x 2 langs)")


if __name__ == "__main__":
    main()
