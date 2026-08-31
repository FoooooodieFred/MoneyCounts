#!/usr/bin/env python3
"""Patch the 30-class Chinese source, inject date specs, write staging JSON."""
from __future__ import annotations

import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "source-zh-30.csv"
CATS = json.loads((ROOT / "categories.json").read_text(encoding="utf-8"))
ZH_TO_ID = {c["zh"]: c["id"] for c in CATS["categories"]}
OUT = ROOT / "staging-zh.json"

# In-place replacements: (category_zh, exact original text) -> new row fields
REPLACEMENTS = {
    ("餐饮美食", "超市买了一箱纯牛奶花了65元"): {
        "自然表达": "食堂窗口再打一份红烧肉花了12元",
        "金额": "12",
        "币种": "CNY",
        "备注": "食堂加菜",
    },
    ("餐饮美食", "菜市场买菜晚上自己做饭花了90块"): {
        "自然表达": "昨晚自己煮面加煎蛋花了9块",
        "金额": "9",
        "币种": "CNY",
        "备注": "自己做饭",
    },
    ("餐饮美食", "超市囤薯片饼干等零食花了120元"): {
        "自然表达": "深夜点了份黄焖鸡米饭花了26元",
        "金额": "26",
        "币种": "CNY",
        "备注": "夜宵外卖",
    },
    ("餐饮美食", "超市买原味酸奶一打花了36块"): {
        "自然表达": "同事聚餐吃日式定食花了72块",
        "金额": "72",
        "币种": "CNY",
        "备注": "定食",
    },
    ("餐饮美食", "超市买泡面和火腿肠花了25元"): {
        "自然表达": "下午茶点了蛋糕卷花了18元",
        "金额": "18",
        "币种": "CNY",
        "备注": "下午茶",
    },
    ("商超购物", "便利店买早餐花了15元"): {
        "自然表达": "超市买土鸡蛋一盒花了15元",
        "金额": "15",
        "币种": "CNY",
        "备注": "鸡蛋",
    },
    ("休闲娱乐", "香港海洋公园门票480HKD"): {
        "自然表达": "朋友局再开一局剧本杀花了138元",
        "金额": "138",
        "币种": "CNY",
        "备注": "剧本杀",
    },
    ("影视演出", "香港海洋公园哈啰喂门票398HKD"): {
        "自然表达": "看了场话剧门票花了180元",
        "金额": "180",
        "币种": "CNY",
        "备注": "话剧",
    },
    ("医疗诊疗", "医院停车费花了15块"): {
        "自然表达": "口腔科拍牙片花了80元",
        "金额": "80",
        "币种": "CNY",
        "备注": "牙片",
    },
    ("保险缴费", "工伤保险单位缴纳个人不扣"): {
        "自然表达": "工伤保险个人缴纳花了280元",
        "金额": "280",
        "币种": "CNY",
        "备注": "工伤险",
    },
    ("保险缴费", "医保每月返款100元"): {
        "自然表达": "城乡居民医保年交380元",
        "金额": "380",
        "币种": "CNY",
        "备注": "居民医保",
    },
    ("税费支出", "小规模纳税人增值税减免"): {
        "自然表达": "小规模纳税人补交增值税800元",
        "金额": "800",
        "币种": "CNY",
        "备注": "增值税",
    },
}

# After replacements, rewrite selected rows to add date diversity.
# Keyed by category_id then 0-based index within that category.
DATE_REWRITES: dict[str, dict[int, tuple[str, str]]] = {
    "food_dining": {
        1: ("昨天中午点黄焖鸡米饭外卖花了28块", "rel:-1"),
        4: ("这一周每天公司楼下买冰美式花了30HKD", "week:0"),
        9: ("今天明天食堂午饭都刷15元", "rel:0,1"),
        18: ("今天到后天兰州拉面馆牛肉面加蛋都花22元", "span:0:2"),
        25: ("本周三外卖点了份意式披萨花了68元", "weekday:3"),
        31: ("8月20日居酒屋吃日料小酌花了280HKD", "ymd:2026-08-20"),
        33: ("上周每天早餐店肠粉加粥花了12块", "week:-1"),
        47: ("大前天包子铺买一笼小笼包花了16元", "rel:-3"),
    },
    "transport": {
        0: ("今天坐地铁上下班花了8HKD", "rel:0"),
        1: ("昨天打车去公司付了45块钱", "rel:-1"),
        7: ("这一周每天骑共享单车通勤花了3块钱", "week:0"),
        10: ("今天明天坐公交去市区都花2元", "rel:0,1"),
        24: ("今天到后天骑共享电动车都花5元", "span:0:2"),
        25: ("本周五滴滴打快车花了28块", "weekday:5"),
        29: ("8月15日打车去高铁站花了60块", "ymd:2026-08-15"),
        41: ("上周每天地铁通勤刷了50元", "week:-1"),
    },
    "groceries": {
        0: ("昨天永辉超市买菜花了90元", "rel:-1"),
        5: ("本周六山姆会员店囤货花了680元", "weekday:6"),
        7: ("8月18日海外超市买伴手礼花了120USD", "ymd:2026-08-18"),
        10: ("这一周每天711买水和纸巾花了12HKD", "week:0"),
        18: ("今天明天小卖部买饮料都花8元", "rel:0,1"),
        22: ("上周每天菜市场买肉和菜花了120块", "week:-1"),
        30: ("今天到后天便利店买冰棍都花10块", "span:0:2"),
    },
    "household_goods": {
        0: ("昨天买垃圾袋洗洁精花了35元", "rel:-1"),
        3: ("本周三买厨房清洁用品花了56元", "weekday:3"),
        8: ("8月12日买驱蚊用品花了32USD", "ymd:2026-08-12"),
        15: ("今天明天都补了纸巾抽纸整箱花了99块", "rel:0,1"),
    },
    "rent": {
        0: ("昨天把这个月房租3500元交了", "rel:-1"),
        5: ("本周一交商铺月租金12000元", "weekday:1"),
        10: ("8月1日交了一室一厅月租3000元", "ymd:2026-08-01"),
        20: ("大前天房租押金交了7000元", "rel:-3"),
    },
    "property_mgmt": {
        0: ("昨天交这个月物业费280元", "rel:-1"),
        4: ("本周五物业公摊费交了50块", "weekday:5"),
        8: ("8月5日缴了海外公寓物业费180USD", "ymd:2026-08-05"),
    },
    "utilities": {
        0: ("昨天交这个月电费180元", "rel:-1"),
        2: ("本周二燃气费充值200HKD", "weekday:2"),
        6: ("8月10日商用电费交了560HKD", "ymd:2026-08-10"),
        12: ("今天明天煤气罐换气都花120HKD", "rel:0,1"),
    },
    "mobile_phone": {
        0: ("昨天手机话费充值100元", "rel:-1"),
        3: ("这一周每天流量包续费花了30元", "week:0"),
        8: ("今天明天海外电话卡都充值50USD", "rel:0,1"),
        14: ("本周四来电显示费每月6块", "weekday:4"),
        20: ("8月9日增值业务费15元每月", "ymd:2026-08-09"),
        30: ("上周每天香港漫游到内地每日28HKD", "week:-1"),
    },
    "broadband": {
        1: ("昨天月网费扣了50块", "rel:-1"),
        5: ("本周一家庭千兆宽带年费960元", "weekday:1"),
        10: ("8月3日宽带移机费80元", "ymd:2026-08-03"),
    },
    "medical": {
        0: ("昨天去医院挂号看病花了300元", "rel:-1"),
        11: ("今天明天牙科洗牙都花200块", "rel:0,1"),
        16: ("今天到后天针灸推拿都花120块", "span:0:2"),
        25: ("本周三内科专家挂号费100元", "weekday:3"),
        32: ("8月22日香港急症室就诊180HKD", "ymd:2026-08-22"),
        34: ("上周每天康复治疗一次200块", "week:-1"),
    },
    "pharmacy": {
        0: ("昨天买感冒药花了45元", "rel:-1"),
        5: ("这一周每天降压药按150元记", "week:0"),
        8: ("今天明天海外保健品都按80USD记", "rel:0,1"),
        12: ("本周六香港买鱼肝油150HKD", "weekday:6"),
        18: ("8月11日感冒药口服液花了58元", "ymd:2026-08-11"),
    },
    "education": {
        0: ("昨天报英语培训班花了3000元", "rel:-1"),
        6: ("本周六编程课学费3500HKD", "weekday:6"),
        12: ("8月8日香港DSE补习费3000HKD", "ymd:2026-08-08"),
        20: ("今天明天香港普通话培训都按1500HKD记", "rel:0,1"),
    },
    "books_stationery": {
        1: ("昨天买笔记本笔花了35块", "rel:-1"),
        4: ("本周三买文具套装花了88块", "weekday:3"),
        11: ("这一周每天中性笔按盒15块", "week:0"),
        13: ("8月16日复印身份证花了2元", "ymd:2026-08-16"),
        18: ("今天明天便利贴都花了8元", "rel:0,1"),
    },
    "leisure": {
        0: ("昨天去KTV唱歌花了380元", "rel:-1"),
        3: ("这一周每天桌游吧消费花了80元", "week:0"),
        9: ("今天明天网吧上网都花40块", "rel:0,1"),
        10: ("今天到后天台球厅打球都花80元", "span:0:2"),
        15: ("本周五舞厅跳舞门票50元", "weekday:5"),
        34: ("8月21日脱口秀开放麦门票50元", "ymd:2026-08-21"),
        42: ("上周每天网吧包夜30元", "week:-1"),
    },
    "shows_media": {
        0: ("昨天电影票两张花了80元", "rel:-1"),
        5: ("本周六相声演出票花了299元", "weekday:6"),
        10: ("8月19日IMAX电影票一张65元", "ymd:2026-08-19"),
        20: ("8月31日跨年演唱会门票880块", "ymd:2026-08-31"),
    },
    "fitness": {
        0: ("昨天健身卡年卡花了2400元", "rel:-1"),
        2: ("这一周每天羽毛球场地费花了120HKD", "week:0"),
        8: ("8月16日海外滑雪票200USD", "ymd:2026-08-16"),
        12: ("今天到后天香港网球场一小时都150HKD", "span:0:2"),
        18: ("本周日散打课一节150块", "weekday:7"),
        25: ("8月14日健身房次卡20次500元", "ymd:2026-08-14"),
        30: ("上周六买了羽毛球拍一支800块", "weekday:-1:6"),
    },
    "travel": {
        0: ("昨天三亚旅游花了5000元", "rel:-1"),
        5: ("本周五云南自由行花了6000元", "weekday:5"),
        10: ("8月7日成都重庆旅游4000元", "ymd:2026-08-07"),
        20: ("今天明天香港本地一日游都300HKD", "rel:0,1"),
    },
    "lodging": {
        0: ("昨天酒店住一晚花了380元", "rel:-1"),
        4: ("本周四五星级酒店一晚1800块", "weekday:4"),
        10: ("8月6日连锁酒店标间一晚280元", "ymd:2026-08-06"),
        20: ("8月27日香港迪士尼酒店一晚3000HKD", "ymd:2026-08-27"),
    },
    "gifts": {
        0: ("昨天给朋友买生日礼物花了300元", "rel:-1"),
        3: ("本周三教师节买花送老师花了200元", "weekday:3"),
        19: ("今天明天生日鲜花蛋糕都按288元记", "rel:0,1"),
        25: ("8月14日情人节送女朋友礼物520元", "ymd:2026-08-14"),
    },
    "red_packet": {
        0: ("昨天给侄子发压岁钱红包2000块", "rel:-1"),
        5: ("本周六乔迁之喜发红包1888元", "weekday:6"),
        10: ("8月13日满月酒随礼500元", "ymd:2026-08-13"),
        20: ("今天明天香港满月酒礼金都3000HKD", "rel:0,1"),
    },
    "pets": {
        0: ("昨天给猫买猫粮花了180元", "rel:-1"),
        5: ("这一周每天狗粮按袋摊下来记320元", "week:0"),
        10: ("今天明天猫罐头都按200元记", "rel:0,1"),
        15: ("今天到后天宠物沐浴露都58元", "span:0:2"),
        20: ("本周日香港宠物寄养每天200HKD", "weekday:7"),
        30: ("8月17日猫咪体检套餐300块", "ymd:2026-08-17"),
        40: ("上周日买了宠物饮水机158元", "weekday:-1:7"),
    },
    "apparel": {
        0: ("昨天买外套花了599元", "rel:-1"),
        8: ("本周六海外买奢侈品包2000USD", "weekday:6"),
        16: ("8月4日香港买运动鞋1000HKD", "ymd:2026-08-04"),
        24: ("8月26日香港买正装西装3000HKD", "ymd:2026-08-26"),
    },
    "beauty": {
        0: ("昨天剪头发花了68元", "rel:-1"),
        6: ("本周五做SPA花了980HKD", "weekday:5"),
        12: ("8月23日香港美容院补水500HKD", "ymd:2026-08-23"),
        18: ("今天明天脱毛膏脱毛仪都按199块记", "rel:0,1"),
        24: ("上周五香港剪头发150HKD", "weekday:-1:5"),
    },
    "electronics": {
        0: ("昨天买新手机花了5999元", "rel:-1"),
        5: ("本周三买笔记本电脑花了7999元", "weekday:3"),
        10: ("8月2日买蓝牙耳机199元", "ymd:2026-08-02"),
        20: ("本周五香港买耳机1200HKD", "weekday:5"),
    },
    "home_decor": {
        0: ("昨天买沙发花了3500元", "rel:-1"),
        5: ("本周日买衣柜花了2800元", "weekday:7"),
        10: ("8月25日买餐桌1500元", "ymd:2026-08-25"),
        20: ("8月28日香港定制橱柜20000HKD", "ymd:2026-08-28"),
    },
    "insurance": {
        1: ("昨天车险花了3500块", "rel:-1"),
        2: ("本周一医疗险每月扣300HKD", "weekday:1"),
        3: ("8月1日意外险年费199元", "ymd:2026-08-01"),
        7: ("今天明天社保个人部分都扣了500元", "rel:0,1"),
    },
    "loan_repay": {
        0: ("昨天房贷月供5000元", "rel:-1"),
        5: ("本周三经营贷月供12000元", "weekday:3"),
        10: ("8月9日商贷月供8000元", "ymd:2026-08-09"),
        20: ("今天明天香港信用卡还款都10000HKD", "rel:0,1"),
    },
    "tax": {
        0: ("昨天个人所得税扣了800元", "rel:-1"),
        5: ("本周五印花税交了500元", "weekday:5"),
        10: ("8月15日企业所得税交了20000元", "ymd:2026-08-15"),
        20: ("今天明天香港印花税都2000HKD", "rel:0,1"),
    },
    "salary": {
        0: ("昨天这个月发工资15000HKD", "rel:-1"),
        5: ("本周四香港月薪到账20000HKD", "weekday:4"),
        10: ("8月10日基本工资5000元", "ymd:2026-08-10"),
        16: ("8月29日香港房屋津贴5000HKD", "ymd:2026-08-29"),
        20: ("今天明天香港双粮出粮都18000HKD", "rel:0,1"),
        30: ("上周每天话费补贴100块", "week:-1"),
        31: ("这一周每天出差补贴200元", "week:0"),
    },
    "side_income": {
        0: ("昨天做兼职赚了2000块钱", "rel:-1"),
        5: ("本周六设计接单赚了4500元", "weekday:6"),
        10: ("8月24日摆摊卖货赚了1000元", "ymd:2026-08-24"),
        17: ("今天明天问卷调查都赚了50元", "rel:0,1"),
        28: ("这一周每天香港散工日结800HKD", "week:0"),
        37: ("上周每天做任务赚了80元", "week:-1"),
    },
}


def infer_date_spec(text: str) -> str:
    if re.search(r"(?:上|下|本|这)?(?:一)?周(?:每天|每日|天天|每一天|整周|一周七天)", text):
        if text.startswith("上") or "上周" in text[:4]:
            return "week:-1"
        if "下周" in text[:4]:
            return "week:1"
        return "week:0"
    if re.search(r"今天明天后天|今天到后天", text):
        return "span:0:2"
    if "今天明天" in text:
        return "rel:0,1"
    if "大前天" in text:
        return "rel:-3"
    if "前天" in text:
        return "rel:-2"
    if re.search(r"昨天|昨日", text):
        return "rel:-1"
    if "大后天" in text:
        return "rel:3"
    if "后天" in text:
        return "rel:2"
    if "明天" in text:
        return "rel:1"
    weekday = re.search(r"(上|下|本)?(?:周|星期|礼拜)([一二三四五六日天])", text)
    if weekday:
        mapping = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "日": 7, "天": 7}
        week_offset = {"上": -1, "下": 1}.get(weekday.group(1) or "", 0)
        day = mapping[weekday.group(2)]
        if week_offset == 0:
            return f"weekday:{day}"
        return f"weekday:{week_offset}:{day}"
    ymd = re.search(r"(20\d{2})年(\d{1,2})月(\d{1,2})[日号]?", text)
    if ymd:
        return f"ymd:{int(ymd.group(1)):04d}-{int(ymd.group(2)):02d}-{int(ymd.group(3)):02d}"
    md = re.search(r"(\d{1,2})月(\d{1,2})[日号]?", text)
    if md:
        return f"ymd:2026-{int(md.group(1)):02d}-{int(md.group(2)):02d}"
    if re.search(r"今早|今天|今日|今晚|今午", text):
        return "rel:0"
    if text.startswith("周末") or "周末去" in text:
        return "weekday:6"
    return "anchor"


def main() -> None:
    rows = list(csv.DictReader(SOURCE.open(encoding="utf-8")))
    grouped: dict[str, list[dict]] = {}
    for row in rows:
        cat = row["分类名称"]
        key = (cat, row["自然表达"])
        if key in REPLACEMENTS:
            row = {**row, **REPLACEMENTS[key]}
        grouped.setdefault(cat, []).append(row)

    samples = []
    for cat_zh, items in grouped.items():
        cat_id = ZH_TO_ID[cat_zh]
        rewrites = DATE_REWRITES.get(cat_id, {})
        if len(items) != 50:
            raise SystemExit(f"{cat_zh} has {len(items)} rows")
        for index, row in enumerate(items):
            text = row["自然表达"]
            spec = infer_date_spec(text)
            if index in rewrites:
                text, spec = rewrites[index]
            amount = row["金额"]
            if amount in {"0", "0.0"}:
                raise SystemExit(f"zero amount remains: {cat_zh} {text}")
            abs_amount = amount.lstrip("-")
            if abs_amount not in text:
                raise SystemExit(f"amount {amount} not in text: {text}")
            samples.append(
                {
                    "category_id": cat_id,
                    "category_zh": cat_zh,
                    "index": index + 1,
                    "zh": text,
                    "amount": amount,
                    "currency": row["币种"],
                    "note_zh": row["备注"],
                    "date_spec": spec,
                }
            )
    OUT.write_text(json.dumps(samples, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(samples)} rows to {OUT}")


if __name__ == "__main__":
    main()
