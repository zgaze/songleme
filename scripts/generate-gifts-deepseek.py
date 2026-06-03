#!/usr/bin/env python3
"""Generate v3 gift directions with DeepSeek's OpenAI-compatible API.

Usage:
  python3 scripts/generate-gifts-deepseek.py 80          # try to keep 80 candidates
  python3 scripts/generate-gifts-deepseek.py --prompts-only   # inspect prompts, no API spend

Put the API key in:
  .secrets/deepseek-api-key.txt   (first line = key)

Design notes (why this is a rewrite, not a tweak):
  - Self-contained: no longer imports the v1 Ollama generator. Field set follows
    docs/gift-protocol-v3.md + schemas/gift-direction.schema.json.
  - The real yield killer was NOT the field gate: it was global name dedup +
    concept repetition + batch_size=1. Fixes here:
      * batch_size default 6 (one repeated name no longer wastes a whole call)
      * loop-until-count with hard caps (max calls / consecutive empty batches)
      * semantic dedup (strip 套装/礼盒/款... before comparing)
      * cross-run dedup: load prior data/generated-gifts-*.{gifts.jsonl,json}
      * cells = category × budget tier: each cell has its own quota + its own
        small tail avoid-list, so coverage drives stopping (not an absolute count)
      * static cacheable prefix: principles / enums / field-rules / few-shot are
        byte-identical on every call; the per-cell avoid-list lives at the very
        END so DeepSeek's prefix cache keeps hitting (usage.prompt_cache_hit_tokens
        is logged per call and summarized at the end)
      * searchKeywords: the model emits real hot-item / classic / brand names as
        downstream e-commerce search seeds; direction names themselves stay
        brand-free and concise (fixes the "X礼盒/X套装" name collapse)
      * finish_reason==length detection + per-object salvage parse (a truncated
        batch loses only its last object, not all of it)
  - Only 6 fields are hard-required (name/target/budget/scene/recommendReason/
    category); soft fields are kept-or-empty, never backfilled with fake values.
  - Compliance word-filtering is intentionally OUT of v3 scope. The only hard
    content rule is e-commerce purchasability (see GIFT_PRINCIPLES_PROMPT).
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import socket
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
RUNTIME_GIFTS_PATH = ROOT / "cloudfunctions/recommendGift/data/giftDirections.js"
TOKEN_PATH = ROOT / ".secrets/deepseek-api-key.txt"
OUTPUT_DIR = ROOT / "data"

DEEPSEEK_BASE_URL = "https://api.deepseek.com"
DEEPSEEK_MODEL = "deepseek-v4-flash"  # verified valid 2026-06 (also: deepseek-v4-pro)
DEFAULT_COUNT = 80
DEFAULT_BATCH_SIZE = 6
DEFAULT_MAX_TOKENS = 4096
DEFAULT_TIMEOUT_SECONDS = 120
DEFAULT_RETRIES = 2
DEFAULT_MAX_EMPTY = 12          # stop after this many consecutive empty batches
DEFAULT_PAUSE_SECONDS = 0.6

# ---- v3 enums (mirror schemas/gift-direction.schema.json) -------------------
TARGETS = ["partner", "parents", "bestie"]
GENDERS = ["female", "male"]
SCENES = ["birthday", "anniversary", "festival", "apology", "daily"]
RECIPIENT_STYLES = ["practical", "aesthetic", "experiential", "quality"]
TONE_FITS = ["romantic", "memory", "surprise", "playful", "warm", "sincere"]
PERSONA_TAGS = [
    "tech_geek", "office_pro", "creative", "student", "night_owl", "homebody",
    "outdoorsy", "fitness", "coffee_tea", "foodie", "pet_owner", "beauty_lover",
    "fandom_gamer", "bookish",
]
BUDGETS = ["under_200", "200_500", "500_1000", "1000_2000", "2000_plus"]
COMMERCE_TYPES = ["ecommerce", "o2o"]
RISK_LEVELS = ["low", "medium", "high"]
CATEGORIES = [
    "beauty_personal_care", "fragrance", "bags_accessories", "digital_accessories",
    "desk_office", "fashion_wear", "food_dessert", "coffee_tea", "nutrition_wellness",
    "home_appliance", "travel_commute", "sports_outdoor", "fandom_ip",
    "books_music_video", "pet_lifestyle", "o2o_experience", "custom_craft",
]
SPECIFIC_OCCASIONS = [
    "none", "520", "qixi", "valentines_day", "mothers_day", "fathers_day",
    "graduation", "new_year", "spring_festival", "mid_autumn", "christmas",
]
SEASONS = ["spring", "summer", "autumn", "winter"]

# Short Chinese glosses to make the prompt enums self-explanatory.
LABELS = {
    "target": {"partner": "恋人", "parents": "爸妈", "bestie": "闺蜜"},
    "scene": {"birthday": "生日", "anniversary": "纪念日", "festival": "节日", "apology": "道歉/和好", "daily": "日常关心"},
    "recipientStyle": {"practical": "实用派", "aesthetic": "颜值控", "experiential": "体验派", "quality": "品质党"},
    "toneFit": {"romantic": "浪漫", "memory": "纪念感", "surprise": "惊喜", "playful": "俏皮", "warm": "温暖陪伴", "sincere": "真诚郑重"},
    "personaTags": {
        "tech_geek": "数码控/程序猿", "office_pro": "白领", "creative": "设计创意", "student": "学生党",
        "night_owl": "夜猫子", "homebody": "宅家党", "outdoorsy": "户外控", "fitness": "健身党",
        "coffee_tea": "咖啡/茶星人", "foodie": "吃货", "pet_owner": "铲屎官", "beauty_lover": "美妆护肤控",
        "fandom_gamer": "追星/游戏迷", "bookish": "文艺/阅读控",
    },
    "budget": {"under_200": "200内", "200_500": "200-500", "500_1000": "500-1000", "1000_2000": "1000-2000", "2000_plus": "2000+"},
}

GIFT_PRINCIPLES_PROMPT = """
你是“送了么”礼物推荐平台的商品数据策划，不是广告文案写手。
你的任务是生成「礼物方向」——具体到用户能在电商平台搜索下单的商品方向，而不是泛泛的品类大词。

履约硬约束（最重要，违反即作废）：
- 只生成能在淘宝/京东/天猫/拼多多/抖音电商等主流平台直接搜索、下单、配送的实物礼物，
  或可在线预约/核销的本地服务（如写真、烘焙课、调香体验、城市展览）。
- 不要生成：大件家具、装修建材、需上门安装或长期维护的设备、纯线下不可买的东西、
  二手物、需复杂参数匹配的核心专业装备（相机镜头/鱼竿/客制化键盘套件/专业音频等）。

礼物性原则：
- 要像礼物：有印象点、有包装感、可郑重交付；不是随手买的日用补货品或公司采购品。
- 名称（name）要具体到可搜索购买、且简洁好匹配，例如“补水面膜”“手冲咖啡套装”，不要写“化妆品”“数码产品”这类大词。
- 方向名（name）不写具体品牌、型号、明星或 IP（如写“补水面膜”而不是“可复美胶原棒”），保持可跨多个商品匹配。
- 高风险品类给真实、简短的购买风险提示（色号/肤质/尺码/口味/兼容/需确认习惯）。
- 推荐理由要说明“为什么适合作为礼物”，不要只描述功能。
- 预算由商品方向自然决定，不要为凑便宜生成低价值感的小物。

搜索关键词（searchKeywords）：
- 为每条方向额外给 3~8 个 searchKeywords：可以且应当是真实存在的爆品/经典款/品牌名（如 面膜→补水面膜、森田玻尿酸面膜、可复美），作为下游电商平台检索真实商品的搜索种子。
- 这些关键词只用于检索，不参与问卷匹配与打分；方向名本身仍不得出现品牌，品牌只进 searchKeywords。
""".strip()

FEW_SHOT_EXAMPLE = {
    "id": "hand-drip-coffee-starter-set",
    "name": "手冲咖啡入门套装",
    "category": "coffee_tea",
    "target": ["bestie", "partner"],
    "scene": ["birthday", "daily"],
    "budget": ["200_500"],
    "recipientStyle": ["experiential", "quality"],
    "toneFit": ["warm", "playful"],
    "personaTags": ["coffee_tea", "homebody"],
    "gender": [],
    "commerceType": "ecommerce",
    "riskLevel": "low",
    "riskTags": ["看口味偏好"],
    "requiresKnownPreference": False,
    "tags": ["有仪式感", "上手简单"],
    "pairingTags": ["挂耳咖啡", "手写卡片"],
    "searchKeywords": ["手冲咖啡套装", "Hario V60 套装", "手冲壶礼盒", "泰摩栗子c2"],
    "specificOccasions": [],
    "seasons": [],
    "recommendReason": "把日常一杯咖啡变成有仪式感的小爱好，适合想被好好对待的人。",
}

# Each call focuses on ONE category × ONE budget tier ("cell") so the model stays
# specific, gets a price anchor, and each cell keeps an independent dedup quota +
# avoid-list. `budgets` lists the tiers worth generating for that category.
CATEGORY_PROFILES = [
    {"category": "beauty_personal_care", "title": "美妆个护", "temperature": 0.8, "top_p": 0.9,
     "budgets": ["under_200", "200_500", "500_1000"],
     "directions": "口红/彩妆礼盒、护手霜礼盒、身体护理礼盒、化妆刷套装、抗老护肤礼盒、头发护理套装",
     "notes": "可写专柜/正品渠道；风险关注色号、肤质、正品渠道。品牌/爆品放进 searchKeywords。"},
    {"category": "fragrance", "title": "香水香氛", "temperature": 0.82, "top_p": 0.92,
     "budgets": ["200_500", "500_1000", "1000_2000"],
     "directions": "香水试香套装、旅行装香水、无火香薰、香薰蜡烛礼盒、车载香氛、衣物香氛",
     "notes": "风险关注气味偏好、可能晕香；试香套装是低风险首选。"},
    {"category": "bags_accessories", "title": "包袋配饰", "temperature": 0.78, "top_p": 0.9,
     "budgets": ["200_500", "500_1000", "1000_2000"],
     "directions": "通勤托特包、卡包钱包、银饰项链手链、围巾披肩、真丝发饰、证件包",
     "notes": "强调质感与日常使用频率；风险关注风格、材质。"},
    {"category": "digital_accessories", "title": "数码配件", "temperature": 0.76, "top_p": 0.88,
     "budgets": ["200_500", "500_1000", "1000_2000"],
     "directions": "降噪耳机、桌面充电站、移动电源、拍摄补光灯、平板支架、键盘成品（非客制套件）",
     "notes": "要像礼物不像办公采购；风险关注兼容、已有设备。"},
    {"category": "desk_office", "title": "桌面办公", "temperature": 0.78, "top_p": 0.9,
     "budgets": ["under_200", "200_500", "500_1000"],
     "directions": "品质钢笔、桌面氛围灯、显示器支架、理线套装、设计感笔记本、护眼台灯",
     "notes": "避免普通文具批发感；强调质感与长期使用。"},
    {"category": "coffee_tea", "title": "咖啡茶饮", "temperature": 0.8, "top_p": 0.9,
     "budgets": ["under_200", "200_500", "500_1000"],
     "directions": "手冲咖啡套装、精品咖啡豆礼盒、冷萃壶、茶具入门套装、茶叶品鉴礼盒、便携咖啡杯",
     "notes": "风险关注口味偏好、使用门槛。"},
    {"category": "food_dessert", "title": "食品甜品", "temperature": 0.82, "top_p": 0.9,
     "budgets": ["under_200", "200_500"],
     "directions": "手工甜品礼盒、精品巧克力礼盒、低糖点心礼盒、节日糕点礼盒、地方风味礼盒",
     "notes": "可做主礼或搭配礼；风险关注忌口、保质期、冷链。"},
    {"category": "home_appliance", "title": "居家小家电", "temperature": 0.76, "top_p": 0.88,
     "budgets": ["200_500", "500_1000", "1000_2000"],
     "directions": "胶囊咖啡机、早餐机、桌面加湿器、小型投影、香薰机、便携熨烫机",
     "notes": "要有品质升级感而非家庭采购；风险关注空间、噪音、维护。"},
    {"category": "nutrition_wellness", "title": "营养滋补（父母向）", "temperature": 0.72, "top_p": 0.88,
     "budgets": ["200_500", "500_1000", "1000_2000"],
     "directions": "蛋白粉礼盒、钙片维生素礼盒、低糖滋补礼盒、花胶燕窝礼盒、护眼/护嗓礼盒",
     "notes": "只表达健康关心，不写功效；优先正规渠道，风险写看适宜人群、按说明食用。"},
    {"category": "travel_commute", "title": "旅行通勤", "temperature": 0.78, "top_p": 0.9,
     "budgets": ["under_200", "200_500", "500_1000"],
     "directions": "旅行收纳系统、降噪睡眠眼罩、通勤背包、护照证件包、便携洗漱包、颈枕升级款",
     "notes": "强调使用场景与品质升级；风险关注尺寸、出行频率。"},
    {"category": "sports_outdoor", "title": "运动户外", "temperature": 0.8, "top_p": 0.92,
     "budgets": ["under_200", "200_500", "500_1000"],
     "directions": "运动训练包、筋膜放松套装、保温运动水壶、露营灯具、野餐垫、跑步腰包",
     "notes": "不宣称疗效；风险关注运动习惯、是否已有装备。"},
    {"category": "fandom_ip", "title": "追星/IP/潮玩", "temperature": 0.84, "top_p": 0.93,
     "budgets": ["under_200", "200_500"],
     "directions": "专辑收纳册、票根收藏册、小卡收纳套装、周边展示架、应援灯收纳、海报收纳筒",
     "notes": "不写具体明星/IP；风险关注对方是否已有同类周边。"},
    {"category": "books_music_video", "title": "书影音", "temperature": 0.82, "top_p": 0.92,
     "budgets": ["under_200", "200_500", "500_1000"],
     "directions": "黑胶唱片机入门、阅读灯、书立摆件、电影蓝光收藏、播客麦克风入门套件",
     "notes": "具体到兴趣场景；风险关注口味、版本、是否重复。"},
    {"category": "pet_lifestyle", "title": "宠物友好生活", "temperature": 0.82, "top_p": 0.92,
     "budgets": ["under_200", "200_500", "500_1000"],
     "directions": "宠物肖像定制、宠物收纳、智能饮水机、宠物友好家居、出行包",
     "notes": "送给铲屎官本人或宠物友好生活；不默认送宠物食品。"},
    {"category": "o2o_experience", "title": "本地体验", "temperature": 0.8, "top_p": 0.9,
     "budgets": ["200_500", "500_1000", "1000_2000"],
     "directions": "写真套餐、调香体验、烘焙课程、陶艺体验、皮具手作课、展览年卡",
     "notes": "必须可线上预约/购买；commerceType 用 o2o；风险关注时间、地点、需预约。"},
    {"category": "custom_craft", "title": "定制手作", "temperature": 0.8, "top_p": 0.92,
     "budgets": ["200_500", "500_1000"],
     "directions": "定制银饰、刻字礼物、手作香薰、定制帆布包、姓名印章礼盒",
     "notes": "周期与审美有风险；不要相册/照片书；风险写需提前、确认风格。"},
]


def build_cells() -> list[dict[str, Any]]:
    """Expand category profiles into category × budget-tier cells."""
    cells: list[dict[str, Any]] = []
    for profile in CATEGORY_PROFILES:
        for budget in profile["budgets"]:
            cells.append({
                "category": profile["category"],
                "title": profile["title"],
                "directions": profile["directions"],
                "notes": profile["notes"],
                "temperature": profile["temperature"],
                "top_p": profile["top_p"],
                "budget": budget,
                "budget_label": LABELS["budget"][budget],
                "cell_key": f'{profile["category"]}|{budget}',
            })
    return cells


def main() -> int:
    args = parse_args()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    existing = load_existing(include_generated=not args.no_cross_run)
    print(
        f"Loaded {len(existing['name_keys'])} existing gift names "
        f"({'runtime + prior generated' if not args.no_cross_run else 'runtime only'}).",
        flush=True,
    )

    timestamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    paths = {
        "prompts": OUTPUT_DIR / f"gift-generation-prompts-deepseek-{timestamp}.jsonl",
        "raw": OUTPUT_DIR / f"generated-gifts-deepseek-{timestamp}.raw.jsonl",
        "gifts": OUTPUT_DIR / f"generated-gifts-deepseek-{timestamp}.gifts.jsonl",
        "errors": OUTPUT_DIR / f"generated-gifts-deepseek-{timestamp}.errors.jsonl",
        "json": OUTPUT_DIR / f"generated-gifts-deepseek-{timestamp}.json",
    }

    if args.prompts_only:
        write_sample_prompts(paths["prompts"], existing, args)
        print(f"Wrote sample prompts to {paths['prompts'].relative_to(ROOT)} (no API spend).")
        return 0

    token = read_token(args.token_file)
    stats = run_generation(args, token, existing, paths)

    print(
        f"\nAccepted {stats['accepted']}/{args.count} gifts from {stats['calls']} DeepSeek calls.",
        flush=True,
    )
    print(f"Dropped: {dict(stats['dropped'])}")
    cache_total = stats["cache_hit"] + stats["cache_miss"]
    cache_rate = (stats["cache_hit"] / cache_total * 100) if cache_total else 0.0
    print(f"Prompt cache: {stats['cache_hit']} hit / {stats['cache_miss']} miss tokens "
          f"({cache_rate:.1f}% hit).")
    print(f"Wrote {paths['gifts'].relative_to(ROOT)}")
    print(f"Wrote {paths['json'].relative_to(ROOT)}")
    if stats["truncated"]:
        print(f"{stats['truncated']} responses hit max_tokens (salvaged what completed).")
    if stats["accepted"] < args.count:
        print("Stopped before target: hit max-calls or consecutive-empty cap. "
              "Try raising --max-calls / --max-empty, or lower --count.")
    return 0


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Generate v3 gift directions with DeepSeek.")
    p.add_argument("count", nargs="?", type=positive_int, default=DEFAULT_COUNT,
                   help="number of cleaned gift candidates to keep")
    p.add_argument("--model", default=DEEPSEEK_MODEL)
    p.add_argument("--base-url", default=DEEPSEEK_BASE_URL)
    p.add_argument("--token-file", type=Path, default=TOKEN_PATH)
    p.add_argument("--batch-size", type=positive_int, default=DEFAULT_BATCH_SIZE,
                   help="gifts requested per call")
    p.add_argument("--per-cell", type=positive_int, default=None,
                   help="target accepted gifts per category×budget cell (default: batch-size)")
    p.add_argument("--max-calls", type=positive_int, default=None,
                   help="hard cap on API calls (default: ceil(count/batch)*4 + 10)")
    p.add_argument("--max-empty", type=positive_int, default=DEFAULT_MAX_EMPTY,
                   help="stop after this many consecutive batches that yield 0 new gifts")
    p.add_argument("--max-tokens", type=positive_int, default=DEFAULT_MAX_TOKENS)
    p.add_argument("--timeout", type=positive_int, default=DEFAULT_TIMEOUT_SECONDS)
    p.add_argument("--retries", type=non_negative_int, default=DEFAULT_RETRIES)
    p.add_argument("--pause", type=non_negative_float, default=DEFAULT_PAUSE_SECONDS)
    p.add_argument("--no-cross-run", action="store_true",
                   help="do not load prior generated files as existing names")
    p.add_argument("--prompts-only", action="store_true",
                   help="write one sample prompt per category and exit (no API spend)")
    return p.parse_args()


def positive_int(value: str) -> int:
    n = int(value)
    if n < 1:
        raise argparse.ArgumentTypeError("must be > 0")
    return n


def non_negative_int(value: str) -> int:
    n = int(value)
    if n < 0:
        raise argparse.ArgumentTypeError("must be >= 0")
    return n


def non_negative_float(value: str) -> float:
    n = float(value)
    if n < 0:
        raise argparse.ArgumentTypeError("must be >= 0")
    return n


# ---- existing-name loading (cross-run + semantic dedup) ---------------------

def load_existing(include_generated: bool = True) -> dict[str, Any]:
    ids: set[str] = set()
    name_keys: set[str] = set()
    names_order: list[str] = []

    def add(name: Any, gid: Any = None) -> None:
        name = str(name or "").strip()
        if name:
            key = name_key(name)
            if key not in name_keys:
                name_keys.add(key)
                names_order.append(name)
        if gid:
            ids.add(str(gid).strip())

    if RUNTIME_GIFTS_PATH.exists():
        text = RUNTIME_GIFTS_PATH.read_text(encoding="utf-8")
        for name in re.findall(r'name:\s*"([^"]+)"', text):
            add(name)
        for gid in re.findall(r'id:\s*"([^"]+)"', text):
            ids.add(gid)

    if include_generated:
        for path in sorted(OUTPUT_DIR.glob("generated-gifts-*.gifts.jsonl")):
            for line in read_lines(path):
                rec = try_json(line)
                gift = (rec or {}).get("gift", rec) if isinstance(rec, dict) else None
                if isinstance(gift, dict):
                    add(gift.get("name"), gift.get("id"))
        for path in sorted(OUTPUT_DIR.glob("generated-gifts-*.json")):
            data = try_json(path.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                for gift in data.get("gifts", []):
                    if isinstance(gift, dict):
                        add(gift.get("name"), gift.get("id"))

    # names_by_cell is filled DURING a run (prior files carry no cell info, so a
    # cell with no history degrades to the global most-recent names).
    return {"ids": ids, "name_keys": name_keys, "names_order": names_order,
            "names_by_cell": {}}


def name_key(name: str) -> str:
    """Normalize a gift name for semantic dedup: drop packaging/qualifier suffixes
    so '专柜口红礼盒' and '专柜口红礼盒套装' collapse to the same key."""
    key = name.lower().strip()
    key = re.sub(r"[\s,，。.、!！?？·\-—_/()（）]+", "", key)
    key = re.sub(r"(套装|套组|套盒|礼盒|礼包|组合|系列|升级款|入门款|定制款|款式|款|版本|版)", "", key)
    return key


# ---- generation loop --------------------------------------------------------

def run_generation(
    args: argparse.Namespace,
    token: str,
    existing: dict[str, Any],
    paths: dict[str, Path],
) -> dict[str, Any]:
    cells = build_cells()
    per_cell = args.per_cell or args.batch_size
    max_calls = args.max_calls or (((args.count + args.batch_size - 1) // args.batch_size) * 4 + 10)
    stats: dict[str, Any] = {
        "accepted": 0, "calls": 0, "truncated": 0,
        "dropped": _counter(), "dedup": 0,
        "cache_hit": 0, "cache_miss": 0,
    }
    accepted_in_cell = {c["cell_key"]: 0 for c in cells}
    empty_in_cell = {c["cell_key"]: 0 for c in cells}
    cell_index = 0
    print(f"Cells: {len(cells)} (category × budget); per-cell quota {per_cell}; "
          f"max_calls {max_calls}.", flush=True)

    with (
        JsonlWriter(paths["raw"]) as raw_writer,
        JsonlWriter(paths["gifts"]) as gift_writer,
        JsonlWriter(paths["errors"]) as error_writer,
        StreamingGiftJsonWriter(paths["json"], args.model) as json_writer,
    ):
        try:
            # Coverage drives stopping: keep cycling cells that are neither full
            # (quota) nor exhausted (consecutive-empty cap). args.count is only an
            # overall ceiling (keeps the smoke test small).
            while stats["accepted"] < args.count and stats["calls"] < max_calls:
                active = [c for c in cells
                          if accepted_in_cell[c["cell_key"]] < per_cell
                          and empty_in_cell[c["cell_key"]] < args.max_empty]
                if not active:
                    break
                cell = active[cell_index % len(active)]
                cell_index += 1
                key = cell["cell_key"]
                want = min(args.batch_size, per_cell - accepted_in_cell[key],
                           args.count - stats["accepted"])
                job = {**cell, "count": want}
                prompt = build_job_prompt(job, existing)
                print(
                    f"Call {stats['calls'] + 1} [{key}] want {want}; "
                    f"accepted {stats['accepted']}/{args.count}",
                    flush=True,
                )

                try:
                    result = call_with_retries(args, token, prompt, job)
                except Exception as error:
                    error_writer.write(error_record(job, "deepseek", error))
                    empty_in_cell[key] += 1
                    sleep(args.pause)
                    continue

                stats["calls"] += 1
                usage = result.get("usage") or {}
                hit = usage.get("prompt_cache_hit_tokens")
                miss = usage.get("prompt_cache_miss_tokens")
                stats["cache_hit"] += hit or 0
                stats["cache_miss"] += miss or 0
                raw_writer.write({"time": now_iso(), "category": job["category"],
                                  "cell": key, "finish": result["finish_reason"],
                                  "usage": usage, "response": result["response"]})
                if result["finish_reason"] == "length":
                    stats["truncated"] += 1

                gifts = parse_gifts(result["content"])
                new_in_batch = 0
                for raw in gifts:
                    if stats["accepted"] >= args.count or accepted_in_cell[key] >= per_cell:
                        break
                    gift, reason = clean_gift_v3(raw, job, existing)
                    if gift is None:
                        stats["dropped"][reason] += 1
                        if reason == "dup":
                            stats["dedup"] += 1
                            error_writer.write({"time": now_iso(), "stage": "dedup",
                                                "category": job["category"], "name": raw.get("name")})
                        else:
                            error_writer.write({"time": now_iso(), "stage": "clean",
                                                "category": job["category"], "reason": reason,
                                                "name": raw.get("name")})
                        continue
                    gift_writer.write({"time": now_iso(), "category": job["category"],
                                       "cell": key, "gift": gift})
                    json_writer.write_gift(gift)
                    existing["ids"].add(gift["id"])
                    existing["name_keys"].add(name_key(gift["name"]))
                    existing["names_order"].append(gift["name"])
                    existing["names_by_cell"].setdefault(key, []).append(gift["name"])
                    stats["accepted"] += 1
                    accepted_in_cell[key] += 1
                    new_in_batch += 1

                empty_in_cell[key] = 0 if new_in_batch else empty_in_cell[key] + 1
                print(f"  +{new_in_batch} new (cell {accepted_in_cell[key]}/{per_cell}, "
                      f"cache hit {hit}/miss {miss}, dedup {stats['dedup']}, "
                      f"empty_streak {empty_in_cell[key]})", flush=True)
                sleep(args.pause)
        except KeyboardInterrupt:
            error_writer.write({"time": now_iso(), "stage": "interrupted",
                                "error": "KeyboardInterrupt; partial files closed cleanly."})
            print("Interrupted; partial files closed cleanly.", flush=True)

    return stats


# ---- prompt building --------------------------------------------------------

def build_common_prefix() -> str:
    # 100% STATIC and byte-identical on every call — this is the cacheable prefix.
    # The per-cell avoid-list is NOT here; it lives at the tail of build_job_prompt
    # so a changing avoid-list never invalidates DeepSeek's prefix cache.
    return f"""
{GIFT_PRINCIPLES_PROMPT}

基础安全规则：
1. 不要性别刻板印象，不要写“女生一定喜欢”“爸妈都需要”。
2. 不要奢侈品炫耀、投资理财、烟酒。
3. 不要“爆款”“必买”“闭眼入”“全网最”这类营销话术（searchKeywords 里的真实品牌/爆品名不在此限）。

枚举（数组里只能填等号左侧的英文 value）：
- target: {fmt_enum("target", TARGETS)}
- scene: {fmt_enum("scene", SCENES)}
- budget: {fmt_enum("budget", BUDGETS)}
- recipientStyle: {fmt_enum("recipientStyle", RECIPIENT_STYLES)}
- toneFit: {fmt_enum("toneFit", TONE_FITS)}
- personaTags: {fmt_enum("personaTags", PERSONA_TAGS)}
- gender: female=女生, male=男生（可留空数组表示通用）
- riskLevel: low / medium / high
- commerceType: ecommerce / o2o

字段规则：
- 标了 toneFit 含 "romantic" 的礼物，scene 不要包含 "apology"（道歉不送暧昧礼物）。
- gender 只在品类有明显性别倾向时填，否则留空。
- budget 由商品方向自然决定，可给 1-3 个相邻区间。

只输出 JSON 对象，结构必须是 {{ "gifts": [...] }}，不要 Markdown、不要解释。
每个 gift 字段：
  id(英文kebab-case,唯一), name(4-12汉字,可搜索购买的具体方向), category(=本次品类),
  target[1-3], scene[1-3], budget[1-3], recipientStyle[1-3], toneFit[1-3], personaTags[1-4],
  gender[0-2], commerceType, riskLevel, riskTags[0-2,每个≤8字], requiresKnownPreference(true/false),
  tags[2-3,每个≤6字], pairingTags[1-3,每个≤6字], searchKeywords[3-8,每个2-20字,真实爆品/经典款/品牌名,可含品牌],
  recommendReason(一句话,≤32字,说明为什么适合作为礼物)

字段与值的示例（仅示意格式，请勿照抄内容或名称）：
{json.dumps(FEW_SHOT_EXAMPLE, ensure_ascii=False)}
""".strip()


def build_job_prompt(job: dict[str, Any], existing: dict[str, Any]) -> str:
    # Tail-only, cell-scoped avoid-list (~30 names). A cell with no history yet
    # degrades to the global most-recent 30. Keeping it small + at the END means
    # it barely perturbs the request and never invalidates the static prefix cache.
    cell_names = existing.get("names_by_cell", {}).get(job["cell_key"]) or existing["names_order"]
    recent = cell_names[-30:]
    avoid = "、".join(recent) if recent else "暂无"
    return f"""
{build_common_prefix()}

本次只生成「{job['title']}」品类（category 必须等于 "{job['category']}"）的礼物 {job['count']} 个。
本次预算档：{job['budget_label']}（budget 数组请包含 "{job['budget']}"，可再加 1-2 个相邻区间）。
允许的方向：{job['directions']}
本品类补充规则：{job['notes']}
请确保 {job['count']} 个礼物彼此方向不同、价位贴合该预算档；方向名简洁可搜索且不含品牌，品牌/爆品放进 searchKeywords。
请避免与下列同档已有礼物重名或近义改写：{avoid}
""".strip()


def fmt_enum(key: str, values: list[str]) -> str:
    labels = LABELS.get(key, {})
    return ", ".join(f"{v}={labels[v]}" if v in labels else v for v in values)


def write_sample_prompts(path: Path, existing: dict[str, Any], args: argparse.Namespace) -> None:
    # One sample per category (its first budget cell) — enough to diff the static
    # prefix across categories without dumping every cell.
    with path.open("w", encoding="utf-8") as file:
        for profile in CATEGORY_PROFILES:
            budget = profile["budgets"][0]
            job = {
                "category": profile["category"], "title": profile["title"],
                "directions": profile["directions"], "notes": profile["notes"],
                "budget": budget, "budget_label": LABELS["budget"][budget],
                "cell_key": f'{profile["category"]}|{budget}',
                "count": args.batch_size,
            }
            record = {"category": job["category"], "cell": job["cell_key"],
                      "prompt": build_job_prompt(job, existing)}
            file.write(json.dumps(record, ensure_ascii=False) + "\n")


# ---- DeepSeek call ----------------------------------------------------------

def call_with_retries(args: argparse.Namespace, token: str, prompt: str, job: dict[str, Any]) -> dict[str, Any]:
    last_error: Exception | None = None
    for attempt in range(args.retries + 1):
        try:
            return call_deepseek(args, token, prompt, job)
        except urllib.error.HTTPError as error:
            last_error = error
            wait = retry_after_seconds(error) if error.code == 429 else min(10.0, 1.5 * (attempt + 1))
            if attempt < args.retries:
                time.sleep(wait)
        except Exception as error:
            last_error = error
            if attempt < args.retries:
                time.sleep(min(10.0, 1.5 * (attempt + 1)))
    assert last_error is not None
    raise last_error


def call_deepseek(args: argparse.Namespace, token: str, prompt: str, job: dict[str, Any]) -> dict[str, Any]:
    body = {
        "model": args.model,
        "messages": [
            {"role": "system", "content": "你只输出有效 JSON。不要 Markdown，不要解释，不要在 JSON 外添加任何文字。"},
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"},
        "temperature": job.get("temperature", 0.8),
        "top_p": job.get("top_p", 0.9),
        "stream": False,
    }
    request = urllib.request.Request(
        f'{args.base_url.rstrip("/")}/chat/completions',
        data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=args.timeout) as response:
        payload = json.loads(response.read().decode("utf-8"))
    choice = (payload.get("choices") or [{}])[0]
    return {
        "response": payload,
        "content": (choice.get("message") or {}).get("content") or "",
        "finish_reason": choice.get("finish_reason"),
        "usage": payload.get("usage") or {},
    }


def retry_after_seconds(error: urllib.error.HTTPError) -> float:
    header = error.headers.get("Retry-After") if error.headers else None
    try:
        return min(60.0, float(header)) if header else 20.0
    except (TypeError, ValueError):
        return 20.0


# ---- parsing (tolerant + truncation salvage) --------------------------------

def parse_gifts(content: str) -> list[dict[str, Any]]:
    content = strip_code_fence(content.strip())
    if not content:
        return []
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        return salvage_objects(content)
    if isinstance(parsed, list):
        return [g for g in parsed if isinstance(g, dict)]
    gifts = parsed.get("gifts", []) if isinstance(parsed, dict) else []
    return [g for g in gifts if isinstance(g, dict)]


def strip_code_fence(text: str) -> str:
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text


def salvage_objects(content: str) -> list[dict[str, Any]]:
    """Recover complete gift objects from a truncated/malformed gifts array.
    A cut-off final object never closes its brace and is skipped, so a truncated
    batch loses only its last item instead of all of it."""
    marker = content.find('"gifts"')
    array_start = content.find("[", marker if marker != -1 else 0)
    if array_start == -1:
        return []
    results: list[dict[str, Any]] = []
    depth = 0
    start: int | None = None
    for i in range(array_start + 1, len(content)):
        ch = content[i]
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start is not None:
                obj = try_json(content[start:i + 1])
                if isinstance(obj, dict):
                    results.append(obj)
                start = None
    return results


# ---- cleaning / validation (v3) ---------------------------------------------

def clean_gift_v3(raw: dict[str, Any], job: dict[str, Any], existing: dict[str, Any]) -> tuple[dict[str, Any] | None, str]:
    name = norm_text(raw.get("name"))
    if not name or not (2 <= len(name) <= 24):
        return None, "missing_name"
    if name_key(name) in existing["name_keys"]:
        return None, "dup"

    target = clean_enum_array(raw.get("target"), TARGETS)
    if not target:
        return None, "missing_target"
    budget = clean_enum_array(raw.get("budget"), BUDGETS)
    if not budget:
        return None, "missing_budget"
    scene = clean_enum_array(raw.get("scene"), SCENES)
    if not scene:
        return None, "missing_scene"
    reason = norm_text(raw.get("recommendReason"))
    if len(reason) < 6:
        return None, "missing_reason"
    reason = reason[:40]

    tone_fit = clean_enum_array(raw.get("toneFit"), TONE_FITS)
    # Safety: romantic gifts must not target the apology scene.
    if "romantic" in tone_fit and "apology" in scene:
        pruned = [s for s in scene if s != "apology"]
        if pruned:
            scene = pruned
        else:
            tone_fit = [t for t in tone_fit if t != "romantic"]

    category = norm_text(raw.get("category"))
    if category not in CATEGORIES:
        category = job["category"]

    gift_id = norm_id(raw.get("id"), name)
    while gift_id in existing["ids"]:
        gift_id = f"{gift_id}-{len(existing['ids']) + 1}"

    commerce = raw.get("commerceType")
    risk = raw.get("riskLevel")
    gift = {
        "id": gift_id,
        "name": name,
        "category": category,
        "target": target,
        "scene": scene,
        "budget": budget,
        "recipientStyle": clean_enum_array(raw.get("recipientStyle"), RECIPIENT_STYLES),
        "toneFit": tone_fit,
        "personaTags": clean_enum_array(raw.get("personaTags"), PERSONA_TAGS),
        "gender": clean_enum_array(raw.get("gender"), GENDERS),
        "commerceType": commerce if commerce in COMMERCE_TYPES else "ecommerce",
        "riskLevel": risk if risk in RISK_LEVELS else "low",
        "riskTags": clean_text_array(raw.get("riskTags"), limit=2, max_len=10),
        "requiresKnownPreference": bool(raw.get("requiresKnownPreference", False)),
        "tags": clean_text_array(raw.get("tags"), limit=3, max_len=8),
        "pairingTags": clean_text_array(raw.get("pairingTags"), limit=3, max_len=8),
        # Soft field: brand/hot-item search seeds. Missing = empty, never required.
        "searchKeywords": clean_text_array(raw.get("searchKeywords"), limit=8, max_len=20, min_len=2),
        "specificOccasions": clean_enum_array(raw.get("specificOccasions"), SPECIFIC_OCCASIONS),
        "seasons": clean_enum_array(raw.get("seasons"), SEASONS),
        "recommendReason": reason,
    }
    return gift, ""


def norm_text(value: Any) -> str:
    return str(value or "").strip()


def norm_id(value: Any, name: str) -> str:
    raw = re.sub(r"[^a-z0-9-]+", "-", norm_text(value).lower())
    raw = re.sub(r"-{2,}", "-", raw).strip("-")
    if raw:
        return raw
    return "gift-" + hashlib.sha1(name.encode("utf-8")).hexdigest()[:8]


def clean_enum_array(value: Any, allowed: list[str]) -> list[str]:
    values = value if isinstance(value, list) else ([] if value in (None, "") else [value])
    allowed_set = set(allowed)
    result: list[str] = []
    for item in values:
        text = norm_text(item)
        if "=" in text:
            text = text.split("=", 1)[0].strip()
        if ":" in text:
            text = text.split(":", 1)[0].strip()
        if text in allowed_set and text not in result:
            result.append(text)
    return result


def clean_text_array(value: Any, limit: int, max_len: int, min_len: int = 0) -> list[str]:
    values = value if isinstance(value, list) else ([] if value in (None, "") else [value])
    result: list[str] = []
    for item in values:
        text = norm_text(item)
        if not text or len(text) < min_len or text in result:
            continue
        result.append(text[:max_len])
        if len(result) >= limit:
            break
    return result


# ---- IO helpers -------------------------------------------------------------

def read_token(path: Path) -> str:
    if not path.exists():
        raise SystemExit(
            f"Missing DeepSeek API key file: {path}\n"
            "Create it and put only the API key on the first line."
        )
    token = path.read_text(encoding="utf-8").strip().splitlines()[0].strip()
    if not token:
        raise SystemExit(f"DeepSeek API key file is empty: {path}")
    return token


def read_lines(path: Path) -> list[str]:
    return [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def try_json(text: str) -> Any:
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return None


def _counter() -> dict[str, int]:
    return {
        "missing_name": 0, "dup": 0, "missing_target": 0,
        "missing_budget": 0, "missing_scene": 0, "missing_reason": 0,
    }


class JsonlWriter:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.file: Any = None

    def __enter__(self) -> "JsonlWriter":
        self.file = self.path.open("a", encoding="utf-8")
        return self

    def __exit__(self, *_: Any) -> None:
        if self.file:
            self.file.close()

    def write(self, record: dict[str, Any]) -> None:
        self.file.write(json.dumps(record, ensure_ascii=False) + "\n")
        self.file.flush()


class StreamingGiftJsonWriter:
    def __init__(self, path: Path, model: str) -> None:
        self.path = path
        self.model = model
        self.file: Any = None
        self.count = 0

    def __enter__(self) -> "StreamingGiftJsonWriter":
        self.file = self.path.open("w", encoding="utf-8")
        header = json.dumps(
            {"model": self.model, "createdAt": now_iso(),
             "schemaVersion": "gift-v3", "source": "scripts/generate-gifts-deepseek.py"},
            ensure_ascii=False, indent=2,
        )[:-2]
        self.file.write(header)
        self.file.write(',\n  "gifts": [\n')
        self.file.flush()
        return self

    def __exit__(self, *_: Any) -> None:
        if self.file:
            self.file.write("\n  ]\n}\n")
            self.file.close()

    def write_gift(self, gift: dict[str, Any]) -> None:
        if self.count:
            self.file.write(",\n")
        self.file.write("    " + json.dumps(gift, ensure_ascii=False))
        self.file.flush()
        self.count += 1


def error_record(job: dict[str, Any], stage: str, error: Exception) -> dict[str, Any]:
    return {
        "time": now_iso(), "category": job.get("category"), "stage": stage,
        "errorType": type(error).__name__, "error": normalize_error(error),
    }


def normalize_error(error: Exception) -> str:
    if isinstance(error, urllib.error.HTTPError):
        try:
            body = error.read().decode("utf-8")
        except Exception:
            body = ""
        return f"HTTP {error.code}: {error.reason} {body[:500]}".strip()
    if isinstance(error, urllib.error.URLError):
        return f"URL error: {error.reason}"
    if isinstance(error, (TimeoutError, socket.timeout)):
        return "Timed out while waiting for DeepSeek."
    return str(error)


def now_iso() -> str:
    return dt.datetime.now().astimezone().isoformat(timespec="seconds")


def sleep(seconds: float) -> None:
    if seconds > 0:
        time.sleep(seconds)


if __name__ == "__main__":
    raise SystemExit(main())
