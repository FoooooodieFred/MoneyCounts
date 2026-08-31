#!/usr/bin/env python3
"""Generate en/note_en pairs for insurance, loan_repay, tax, salary, side_income."""

import json
import re
import sys
from pathlib import Path

ROOT = Path("/workspace/data/nl-ledger")
STAGING = ROOT / "staging-by-cat"
PAIRS = ROOT / "pairs"

# (en, note_en) keyed by (category_id, index)
TRANSLATIONS: dict[tuple[str, int], tuple[str, str]] = {
    # insurance
    ("insurance", 1): (
        "paid 6000 yuan annual critical illness insurance premium",
        "critical illness insurance",
    ),
    ("insurance", 2): ("yesterday car insurance cost 3500 bucks", "car insurance"),
    ("insurance", 3): (
        "this Monday medical insurance monthly deduction 300 HKD",
        "medical insurance",
    ),
    ("insurance", 4): ("Aug 1 accident insurance annual fee 199 yuan", "accident insurance"),
    ("insurance", 5): ("life insurance annual premium 8000 bucks", "life insurance"),
    ("insurance", 6): ("home property insurance cost 299 yuan", "home property insurance"),
    ("insurance", 7): ("Hong Kong insurance annual premium 12000 HKD", "Hong Kong insurance"),
    ("insurance", 8): (
        "today and tomorrow social insurance personal share deducted 500 yuan",
        "social insurance",
    ),
    ("insurance", 9): ("overseas medical insurance 500 USD", "overseas medical insurance"),
    ("insurance", 10): ("pet insurance cost 365 bucks", "pet insurance"),
    ("insurance", 11): ("pension insurance annual premium 8000 yuan", "pension insurance"),
    ("insurance", 12): ("compulsory traffic insurance 950 bucks", "compulsory traffic insurance"),
    ("insurance", 13): (
        "Hong Kong critical illness insurance annual premium 15000 HKD",
        "Hong Kong critical illness insurance",
    ),
    ("insurance", 14): ("unemployment insurance monthly deduction 50 yuan", "unemployment insurance"),
    ("insurance", 15): ("student accident insurance 100 bucks per year", "student accident insurance"),
    ("insurance", 16): ("million-yuan medical insurance 300 yuan per year", "million-yuan medical"),
    ("insurance", 17): (
        "Hong Kong inpatient medical insurance annual premium 5000 HKD",
        "inpatient medical insurance",
    ),
    ("insurance", 18): (
        "work injury insurance personal contribution cost 280 yuan",
        "work injury insurance",
    ),
    ("insurance", 19): ("car third-party liability insurance 1200 bucks", "third-party liability"),
    ("insurance", 20): ("annuity insurance annual premium 20000 yuan", "annuity insurance"),
    ("insurance", 21): (
        "Hong Kong savings insurance annual premium 30000 HKD",
        "savings insurance",
    ),
    ("insurance", 22): ("maternity insurance monthly deduction 10 yuan", "maternity insurance"),
    ("insurance", 23): ("car damage insurance 1800 bucks", "car damage insurance"),
    ("insurance", 24): ("cancer insurance 500 yuan per year", "cancer insurance"),
    ("insurance", 25): ("Hong Kong accident insurance annual premium 500 HKD", "Hong Kong accident insurance"),
    ("insurance", 26): ("urban-rural resident medical insurance 380 yuan per year", "resident medical insurance"),
    ("insurance", 27): ("whole life insurance annual premium 10000 bucks", "whole life insurance"),
    ("insurance", 28): ("property insurance 800 yuan per year", "property insurance"),
    ("insurance", 29): (
        "Hong Kong life insurance annual premium 20000 HKD",
        "Hong Kong life insurance",
    ),
    ("insurance", 30): ("critical illness mutual aid fund 60 yuan per year", "critical illness mutual aid"),
    ("insurance", 31): ("seat insurance 100 bucks per seat", "seat insurance"),
    ("insurance", 32): ("child critical illness insurance 800 yuan per year", "child critical illness insurance"),
    ("insurance", 33): ("Hong Kong medical insurance 500 HKD monthly", "Hong Kong medical insurance"),
    ("insurance", 34): ("supplementary medical insurance 200 yuan per year", "supplementary medical"),
    ("insurance", 35): ("theft insurance 300 bucks per year", "theft insurance"),
    ("insurance", 36): ("senior accident insurance 200 yuan per year", "senior accident insurance"),
    ("insurance", 37): ("Hong Kong travel insurance single trip 100 HKD", "travel insurance"),
    ("insurance", 38): ("Huiminbao insurance 69 yuan per year", "Huiminbao"),
    ("insurance", 39): ("water damage insurance 150 bucks per year", "water damage insurance"),
    ("insurance", 40): ("women-only insurance 300 yuan per year", "women-only insurance"),
    ("insurance", 41): ("Hong Kong employee insurance 300 HKD monthly", "employee insurance"),
    ("insurance", 42): ("commercial medical insurance 1500 yuan per year", "commercial medical insurance"),
    ("insurance", 43): ("spontaneous combustion insurance 100 bucks per year", "spontaneous combustion insurance"),
    ("insurance", 44): ("education fund insurance annual premium 5000 yuan", "education fund insurance"),
    ("insurance", 45): ("Hong Kong home insurance 800 HKD per year", "home insurance"),
    ("insurance", 46): ("social insurance back payment 1200 yuan", "social insurance back payment"),
    ("insurance", 47): ("deductible waiver insurance 200 bucks per year", "deductible waiver"),
    ("insurance", 48): ("dental insurance 500 yuan per year", "dental insurance"),
    ("insurance", 49): ("Hong Kong premium auto-deducted 8000 HKD", "auto deduction"),
    ("insurance", 50): ("Hong Kong car insurance annual premium 6000 HKD", "car insurance"),
    # loan_repay
    ("loan_repay", 1): ("yesterday mortgage monthly payment 5000 yuan", "mortgage"),
    ("loan_repay", 2): ("car loan monthly payment 2000 bucks", "car loan"),
    ("loan_repay", 3): ("credit card repayment cost 8000 HKD", "credit card"),
    ("loan_repay", 4): ("Huabei repayment cost 1500 yuan", "Huabei"),
    ("loan_repay", 5): ("Jiebei repayment cost 3000 bucks", "Jiebei"),
    ("loan_repay", 6): ("this Wednesday business loan monthly payment 12000 yuan", "business loan"),
    ("loan_repay", 7): ("Hong Kong mortgage monthly payment 15000 HKD", "Hong Kong mortgage"),
    ("loan_repay", 8): ("JD Baitiao repayment cost 800 yuan", "Baitiao"),
    ("loan_repay", 9): ("overseas loan monthly payment 2000 USD", "overseas loan"),
    ("loan_repay", 10): ("student loan repayment cost 1200 bucks", "student loan"),
    ("loan_repay", 11): ("Aug 9 commercial loan monthly payment 8000 yuan", "commercial loan"),
    ("loan_repay", 12): ("housing provident fund loan 3000 bucks monthly", "housing provident fund loan"),
    ("loan_repay", 13): ("Hong Kong private housing monthly payment 20000 HKD", "Hong Kong private housing"),
    ("loan_repay", 14): ("consumer loan monthly payment 1500 yuan", "consumer loan"),
    ("loan_repay", 15): ("renovation loan monthly payment 2000 bucks", "renovation loan"),
    ("loan_repay", 16): ("mortgage loan monthly payment 10000 yuan", "mortgage loan"),
    ("loan_repay", 17): ("Hong Kong car loan monthly payment 5000 HKD", "Hong Kong car loan"),
    ("loan_repay", 18): ("Weilidai repayment 800 yuan", "Weilidai"),
    ("loan_repay", 19): ("360 Jietiao repayment 1000 bucks", "Jietiao"),
    ("loan_repay", 20): ("mortgage early repayment 100000 yuan", "early mortgage repayment"),
    ("loan_repay", 21): (
        "today and tomorrow Hong Kong credit card repayment 10000 HKD each",
        "credit card",
    ),
    ("loan_repay", 22): ("car loan early repayment 20000 yuan", "early car loan repayment"),
    ("loan_repay", 23): ("Meituan living expense loan repayment 500 bucks", "living expense loan"),
    ("loan_repay", 24): ("mortgage interest 2000 yuan monthly", "mortgage interest"),
    ("loan_repay", 25): ("Hong Kong tax loan monthly payment 8000 HKD", "tax loan"),
    ("loan_repay", 26): ("credit card installment monthly payment 500 yuan", "credit card installment"),
    ("loan_repay", 27): ("online loan repayment 1500 bucks", "online loan"),
    ("loan_repay", 28): ("combined loan monthly payment 6000 yuan", "combined loan"),
    ("loan_repay", 29): ("Hong Kong installment loan 3000 HKD monthly", "installment loan"),
    ("loan_repay", 30): ("mortgage principal plus interest 5500 yuan monthly", "mortgage principal and interest"),
    ("loan_repay", 31): ("three-year car loan 3000 bucks monthly", "car loan installment"),
    ("loan_repay", 32): ("credit loan monthly payment 2500 yuan", "credit loan"),
    ("loan_repay", 33): ("Hong Kong second mortgage monthly payment 10000 HKD", "second mortgage"),
    ("loan_repay", 34): ("Huabei installment monthly payment 300 yuan", "Huabei installment"),
    ("loan_repay", 35): ("Jiebei early repayment fee 50 bucks", "early repayment fee"),
    ("loan_repay", 36): ("business operating loan monthly payment 15000 yuan", "business loan"),
    ("loan_repay", 37): ("Hong Kong cash advance repayment 5000 HKD monthly", "cash advance repayment"),
    ("loan_repay", 38): ("student loan interest 500 yuan per year", "student loan interest"),
    ("loan_repay", 39): ("mortgage LPR adjustment extra payment 200 bucks", "LPR adjustment"),
    ("loan_repay", 40): ("credit card minimum payment 800 yuan", "minimum payment"),
    ("loan_repay", 41): ("Hong Kong card cash repayment 8000 HKD", "card cash repayment"),
    ("loan_repay", 42): ("renovation loan early repayment 50000 yuan", "early loan repayment"),
    ("loan_repay", 43): ("JD Jintiao repayment 1000 bucks", "Jintiao"),
    ("loan_repay", 44): ("mortgage bank auto-deduction 5000 yuan", "auto deduction"),
    ("loan_repay", 45): ("Hong Kong Yijiebao repayment 3000 HKD", "Yijiebao"),
    ("loan_repay", 46): ("car loan release fee 200 yuan", "release fee"),
    ("loan_repay", 47): ("online loan settlement certificate fee 50 bucks", "settlement fee"),
    ("loan_repay", 48): ("mortgage tax refund received 12000 yuan", "tax refund received"),
    ("loan_repay", 49): ("Hong Kong loan penalty interest 500 HKD", "penalty interest"),
    ("loan_repay", 50): ("Hong Kong Huabei repayment 2000 HKD", "Huabei"),
    # tax
    ("tax", 1): ("yesterday personal income tax deducted 800 yuan", "personal income tax"),
    ("tax", 2): ("property tax paid 5000 bucks", "property tax"),
    ("tax", 3): ("Hong Kong salaries tax deducted 3000 HKD", "salaries tax"),
    ("tax", 4): ("value-added tax paid 2000 yuan", "value-added tax"),
    ("tax", 5): ("vehicle purchase tax cost 12000 bucks", "vehicle purchase tax"),
    ("tax", 6): ("this Friday stamp duty paid 500 yuan", "stamp duty"),
    ("tax", 7): ("property tax paid 1800 HKD", "property tax"),
    ("tax", 8): ("personal income tax special back payment 1200 yuan", "personal income tax back payment"),
    ("tax", 9): ("overseas consumption tax 300 USD", "overseas consumption tax"),
    ("tax", 10): ("deed tax cost 9000 bucks", "deed tax"),
    ("tax", 11): ("Aug 15 corporate income tax paid 20000 yuan", "corporate income tax"),
    ("tax", 12): ("vehicle and vessel tax 360 bucks per year", "vehicle and vessel tax"),
    ("tax", 13): ("Hong Kong profits tax 15000 HKD", "profits tax"),
    ("tax", 14): ("urban maintenance and construction tax 200 yuan", "urban maintenance tax"),
    ("tax", 15): ("education surcharge 100 bucks", "education surcharge"),
    ("tax", 16): ("land value-added tax 50000 yuan", "land value-added tax"),
    ("tax", 17): ("Hong Kong rates 5000 HKD per year", "rates"),
    ("tax", 18): ("personal business income tax 3000 yuan", "business income tax"),
    ("tax", 19): ("consumption tax 1500 bucks", "consumption tax"),
    ("tax", 20): ("farmland occupation tax 8000 yuan", "farmland occupation tax"),
    ("tax", 21): (
        "today and tomorrow Hong Kong stamp duty 2000 HKD each",
        "Hong Kong stamp duty",
    ),
    ("tax", 22): ("resource tax 500 yuan", "resource tax"),
    ("tax", 23): ("property tax back payment 2000 bucks", "property tax back payment"),
    ("tax", 24): ("urban land use tax 1000 yuan", "land use tax"),
    ("tax", 25): ("Hong Kong betting duty 1000 HKD", "betting duty"),
    ("tax", 26): ("customs duty 3000 yuan", "customs duty"),
    ("tax", 27): ("vehicle purchase tax after half-rate 6000 bucks", "half-rate purchase tax"),
    ("tax", 28): ("first-home deed tax 1.5% total 9000 yuan", "first-home deed tax"),
    ("tax", 29): ("Hong Kong personal assessment tax 4000 HKD", "personal assessment tax"),
    ("tax", 30): ("personal income tax refund received 1200 yuan", "personal income tax refund"),
    ("tax", 31): ("VAT surcharge 300 bucks", "VAT surcharge"),
    ("tax", 32): (
        "corporate income tax annual settlement back payment 5000 yuan",
        "annual settlement",
    ),
    ("tax", 33): ("Hong Kong property tax 500 HKD monthly", "property tax"),
    ("tax", 34): ("stamp duty per document 5 yuan", "stamp per document"),
    ("tax", 35): ("vehicle and vessel tax agency payment 360 bucks", "vehicle and vessel tax"),
    ("tax", 36): ("land grant fee 100000 yuan", "land grant fee"),
    ("tax", 37): ("Hong Kong import-export duty 8000 HKD", "import-export duty"),
    ("tax", 38): ("personal income tax threshold 5000 yuan", "tax threshold"),
    ("tax", 39): ("urban maintenance tax 7% total 140 yuan", "urban maintenance tax"),
    ("tax", 40): ("education surcharge 3% total 60 bucks", "education surcharge"),
    ("tax", 41): ("Hong Kong salaries tax allowance 132000 HKD", "tax allowance"),
    ("tax", 42): ("small taxpayer VAT back payment 800 yuan", "value-added tax"),
    ("tax", 43): ("vehicle purchase tax rate 10%", "purchase tax rate"),
    ("tax", 44): ("second-home deed tax 3% total 18000 yuan", "second-home deed tax"),
    ("tax", 45): ("Hong Kong profits tax rate 16.5%", "profits tax rate"),
    ("tax", 46): ("personal service income tax 20%", "service income tax"),
    ("tax", 47): ("property tax rental basis 12%", "rental basis tax"),
    ("tax", 48): ("Hong Kong rates collection rate 5%", "rates collection rate"),
    ("tax", 49): ("VAT special invoice deduction 1000 yuan", "invoice deduction"),
    ("tax", 50): ("Hong Kong rates back payment 3000 HKD", "rates"),
    # salary
    ("salary", 1): ("yesterday this month's salary paid 15000 HKD", "monthly salary"),
    ("salary", 2): ("company payroll received 8000 bucks", "monthly salary"),
    ("salary", 3): ("last month after-tax salary received 12000 yuan", "after-tax salary"),
    ("salary", 4): ("base pay plus commission total 25000 bucks", "base pay and commission"),
    ("salary", 5): ("probation salary paid 6000 yuan", "probation salary"),
    ("salary", 6): ("this Thursday Hong Kong monthly salary received 20000 HKD", "Hong Kong monthly salary"),
    ("salary", 7): ("year-end bonus paid 30000 yuan", "year-end bonus"),
    ("salary", 8): ("overtime pay paid 800 bucks", "overtime pay"),
    ("salary", 9): ("overseas monthly salary received 4000 USD", "overseas monthly salary"),
    ("salary", 10): ("performance bonus paid 5000 bucks", "performance bonus"),
    ("salary", 11): ("Aug 10 basic salary 5000 yuan", "basic salary"),
    ("salary", 12): ("position allowance 2000 bucks", "position allowance"),
    ("salary", 13): ("Hong Kong base salary 18000 HKD", "Hong Kong base salary"),
    ("salary", 14): ("perfect attendance bonus 500 yuan", "perfect attendance bonus"),
    ("salary", 15): ("transport allowance 300 bucks", "transport allowance"),
    ("salary", 16): ("meal allowance 400 yuan monthly", "meal allowance"),
    ("salary", 17): ("Aug 29 Hong Kong housing allowance 5000 HKD", "housing allowance"),
    ("salary", 18): ("seniority pay 200 yuan", "seniority pay"),
    ("salary", 19): ("quarterly bonus 10000 bucks", "quarterly bonus"),
    ("salary", 20): ("project bonus 8000 yuan", "project bonus"),
    ("salary", 21): (
        "today and tomorrow Hong Kong double pay received 18000 HKD each",
        "double pay",
    ),
    ("salary", 22): ("night shift allowance 500 yuan", "night shift allowance"),
    ("salary", 23): ("high-temperature allowance 300 bucks", "high-temperature allowance"),
    ("salary", 24): ("commission bonus 15000 yuan", "commission"),
    ("salary", 25): ("Hong Kong commission income 10000 HKD", "commission"),
    ("salary", 26): ("thirteenth-month pay paid 8000 yuan", "thirteenth-month pay"),
    ("salary", 27): ("year-end dividend paid 50000 bucks", "year-end dividend"),
    ("salary", 28): ("basic salary plus performance total 12000 yuan", "salary and performance"),
    ("salary", 29): ("Hong Kong overtime allowance 2000 HKD", "overtime allowance"),
    ("salary", 30): ("housing allowance 1000 yuan", "housing allowance"),
    ("salary", 31): ("last week daily phone allowance 100 bucks", "phone allowance"),
    ("salary", 32): ("this week daily travel allowance 200 yuan", "travel allowance"),
    ("salary", 33): ("Hong Kong meal allowance 1500 HKD", "meal allowance"),
    ("salary", 34): ("skill allowance 500 yuan", "skill allowance"),
    ("salary", 35): ("management allowance 2000 bucks", "management allowance"),
    ("salary", 36): ("sales commission 20000 yuan", "sales commission"),
    ("salary", 37): ("Hong Kong bonus 10000 HKD", "bonus"),
    ("salary", 38): ("monthly outstanding employee award 500 yuan", "outstanding employee award"),
    ("salary", 39): ("semi-annual bonus 15000 bucks", "semi-annual bonus"),
    ("salary", 40): ("non-compete compensation 3000 yuan", "non-compete compensation"),
    ("salary", 41): ("Hong Kong long service payment 20000 HKD", "long service payment"),
    ("salary", 42): ("maternity leave salary 8000 yuan", "maternity leave salary"),
    ("salary", 43): ("sick leave salary 4000 bucks", "sick leave salary"),
    ("salary", 44): ("annual leave salary 2000 yuan", "annual leave salary"),
    ("salary", 45): ("Hong Kong severance pay 50000 HKD", "severance pay"),
    ("salary", 46): ("regularized salary 8000 yuan", "regularized salary"),
    ("salary", 47): ("after raise monthly pay 10000 bucks", "after raise"),
    ("salary", 48): ("payday salary received 12000 yuan", "payday"),
    ("salary", 49): ("Hong Kong after-tax monthly salary 18000 HKD", "after-tax monthly salary"),
    ("salary", 50): ("Hong Kong performance bonus received 15000 HKD", "performance bonus"),
    # side_income
    ("side_income", 1): ("yesterday part-time work earned 2000 bucks", "part-time work"),
    ("side_income", 2): ("freelance gig payment received 3000 HKD", "freelance gig"),
    ("side_income", 3): ("self-media earnings received 500 USD", "self-media"),
    ("side_income", 4): ("Xianyu sold stuff earned 800 yuan", "Xianyu"),
    ("side_income", 5): ("designated driver income 1500 bucks", "designated driver"),
    ("side_income", 6): ("this Saturday design gig earned 4500 yuan", "design gig"),
    ("side_income", 7): ("shopping agent profit 2500 HKD", "shopping agent"),
    ("side_income", 8): ("investment interest received 300 yuan", "investment interest"),
    ("side_income", 9): ("overseas freelance earned 1200 USD", "overseas freelance"),
    ("side_income", 10): ("errand running earned 600 bucks", "errand running"),
    ("side_income", 11): ("Aug 24 stall sales earned 1000 yuan", "stall sales"),
    ("side_income", 12): ("writing fee 800 bucks", "writing fee"),
    ("side_income", 13): ("Hong Kong tutoring monthly income 5000 HKD", "tutoring"),
    ("side_income", 14): ("ride-hailing driver income 3000 yuan", "ride-hailing"),
    ("side_income", 15): ("translation part-time earned 2000 bucks", "translation"),
    ("side_income", 16): ("short-video affiliate commission 1500 yuan", "affiliate commission"),
    ("side_income", 17): ("Hong Kong stock trading profit 10000 HKD", "stock trading"),
    ("side_income", 18): (
        "today and tomorrow survey tasks earned 50 yuan each",
        "survey",
    ),
    ("side_income", 19): ("voice-over part-time 800 bucks", "voice-over"),
    ("side_income", 20): ("photo shoot earned 1200 yuan", "photo shoot"),
    ("side_income", 21): ("Hong Kong freelance earned 8000 HKD", "freelance"),
    ("side_income", 22): ("food delivery rider income 2500 yuan", "food delivery rider"),
    ("side_income", 23): ("game boosting earned 600 bucks", "game boosting"),
    ("side_income", 24): ("WeChat official account ad income 2000 yuan", "WeChat official account"),
    ("side_income", 25): ("Hong Kong tutoring monthly income 6000 HKD", "tutoring"),
    ("side_income", 26): ("resale profit 300 yuan", "resale"),
    ("side_income", 27): ("PPT gig 500 bucks", "PPT gig"),
    ("side_income", 28): ("live stream tips income 1000 yuan", "live stream tips"),
    ("side_income", 29): ("this week daily Hong Kong casual work 800 HKD", "casual work"),
    ("side_income", 30): ("deal hunting earned 100 yuan", "deal hunting"),
    ("side_income", 31): ("mini program dev gig 10000 bucks", "mini program dev"),
    ("side_income", 32): ("illustration commission earned 2000 yuan", "illustration commission"),
    ("side_income", 33): ("Hong Kong hourly work monthly income 4000 HKD", "hourly work"),
    ("side_income", 34): ("rental income 3000 yuan", "rental income"),
    ("side_income", 35): ("new bond lottery profit 200 bucks", "new bond lottery"),
    ("side_income", 36): ("fund dividend 500 yuan", "fund dividend"),
    ("side_income", 37): ("Hong Kong rental income 10000 HKD", "rental income"),
    ("side_income", 38): ("last week daily task earnings 80 yuan", "task earnings"),
    ("side_income", 39): ("bookkeeping service 1000 bucks monthly", "bookkeeping service"),
    ("side_income", 40): ("video editing gig 3000 yuan", "video editing"),
    ("side_income", 41): ("Hong Kong beauty part-time monthly income 5000 HKD", "beauty part-time"),
    ("side_income", 42): ("like-and-follow tasks earned 30 yuan", "like-and-follow tasks"),
    ("side_income", 43): ("tarot reading earned 500 bucks", "tarot reading"),
    ("side_income", 44): ("homestay operating income 8000 yuan", "homestay"),
    ("side_income", 45): ("Hong Kong parking spot rental 2000 HKD monthly", "parking spot rental"),
    ("side_income", 46): ("product trial earned 100 yuan", "product trial"),
    ("side_income", 47): ("programming side gig earned 5000 bucks", "programming side gig"),
    ("side_income", 48): ("self-media ad revenue share 1500 yuan", "ad revenue share"),
    ("side_income", 49): ("Hong Kong ride-hailing monthly income 15000 HKD", "ride-hailing"),
    ("side_income", 50): ("Hong Kong translation part-time monthly income 3000 HKD", "translation part-time"),
}

FILES = ["insurance", "loan_repay", "tax", "salary", "side_income"]


def word_count(s: str) -> int:
    return len(s.split())


def validate_item(item: dict, en: str, note_en: str) -> list[str]:
    errors: list[str] = []
    amount = item["amount"]
    if amount not in en:
        errors.append(f"amount '{amount}' not in en: {en!r}")
    if word_count(note_en) > 10:
        errors.append(f"note_en has {word_count(note_en)} words: {note_en!r}")
    return errors


def process_file(name: str) -> tuple[int, list[str]]:
    staging_path = STAGING / f"{name}.json"
    with staging_path.open(encoding="utf-8") as f:
        items = json.load(f)

    errors: list[str] = []
    out: list[dict] = []

    if len(items) != 50:
        errors.append(f"{name}: expected 50 items, got {len(items)}")

    for item in items:
        key = (item["category_id"], item["index"])
        if key not in TRANSLATIONS:
            errors.append(f"missing translation for {key}")
            continue
        en, note_en = TRANSLATIONS[key]
        item_errors = validate_item(item, en, note_en)
        for e in item_errors:
            errors.append(f"{name}[{item['index']}]: {e}")
        row = dict(item)
        row["en"] = en
        row["note_en"] = note_en
        out.append(row)

    pairs_path = PAIRS / f"{name}.json"
    with pairs_path.open("w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")

    return len(out), errors


def main() -> int:
    PAIRS.mkdir(parents=True, exist_ok=True)
    all_errors: list[str] = []
    summary: dict[str, int] = {}

    for name in FILES:
        count, errors = process_file(name)
        summary[name] = count
        all_errors.extend(errors)

    print("Generated files:")
    for name in FILES:
        print(f"  {PAIRS / f'{name}.json'}: {summary[name]} items")

    if all_errors:
        print("\nValidation errors:")
        for e in all_errors:
            print(f"  - {e}")
        return 1

    print("\nAll validations passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
