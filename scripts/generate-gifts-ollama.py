#!/usr/bin/env python3
"""Generate gift candidates with local Ollama.

Usage:
  python3 scripts/generate-gifts-ollama.py 120

The script is intentionally serial and append-only so it can run for a long
time without keeping generated gifts in memory. Each run writes:
  - data/gift-generation-prompts-*.jsonl
  - data/generated-gifts-ollama-*.raw.jsonl
  - data/generated-gifts-ollama-*.gifts.jsonl
  - data/generated-gifts-ollama-*.errors.jsonl
  - data/generated-gifts-ollama-*.json
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
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
QUESTIONNAIRE_PATH = ROOT / "miniprogram/shared/questionnaire.config.json"
EXISTING_GIFTS_PATH = ROOT / "cloudfunctions/recommendGift/data/giftDirections.js"
OUTPUT_DIR = ROOT / "data"

OLLAMA_URL = "http://127.0.0.1:11434/api/chat"
OLLAMA_MODEL = "gemma4:e2b"
OLLAMA_TIMEOUT_SECONDS = 900
DEFAULT_BATCH_SIZE = 1
DEFAULT_OVERSAMPLE = 2.5
DEFAULT_PAUSE_SECONDS = 1.5
DEFAULT_RETRIES = 2

PREPARATION_TIMES = ["today", "tomorrow", "within_3_days", "within_7_days", "after_7_days"]
EMOTIONAL_TAGS = ["romantic", "company", "care", "surprise", "memory"]
VISUAL_STYLES = ["minimal", "warm", "delicate", "tech", "classic"]


@dataclass(frozen=True)
class FocusProfile:
    name: str
    title: str
    instruction: str
    temperature: float
    top_p: float


FOCUS_PROFILES = [
    FocusProfile(
        "common_safe",
        "常见稳妥款",
        "优先生成多数用户容易购买、容易理解、送错概率低的礼物方向。",
        0.55,
        0.82,
    ),
    FocusProfile(
        "common_upgraded",
        "常见礼物升级款",
        "生成常见礼物的更具体升级方向，不要只写鲜花、杯子、香薰、按摩仪这类大词。",
        0.68,
        0.88,
    ),
    FocusProfile(
        "avoid_common",
        "避开高频礼物",
        "刻意避开鲜花、巧克力、杯子、香薰、围巾、按摩仪、保温杯、护肤品、盲盒、玩偶，寻找仍然好买的替代方向。",
        0.82,
        0.92,
    ),
    FocusProfile(
        "creative",
        "创意类",
        "聚焦设计、摄影、媒体、内容创作、灵感记录、桌面创意工具等创意人群会觉得被理解的礼物。",
        0.86,
        0.94,
    ),
    FocusProfile(
        "craft",
        "工艺品类",
        "聚焦手作、工艺、非遗、材质、器物、收藏展示类礼物，必须仍然像可以买到的商品方向。",
        0.82,
        0.92,
    ),
    FocusProfile(
        "literary_art",
        "文艺品类",
        "聚焦阅读、展览、音乐、电影、书写、独立出版、艺术生活方式，不要写虚泛的精神礼物。",
        0.84,
        0.93,
    ),
    FocusProfile(
        "fandom",
        "追星族类",
        "聚焦演唱会、专辑、周边收纳、应援、拍摄、票根保存、追星日常，不要出现具体明星或品牌。",
        0.84,
        0.93,
    ),
    FocusProfile(
        "niche_hobby",
        "小众爱好类",
        "聚焦拼图、模型、桌游、露营、手帐、香水试香、胶片、宠物友好生活等小众兴趣，但避免需要极强专业判断的商品。",
        0.88,
        0.95,
    ),
    FocusProfile(
        "experience",
        "体验类",
        "聚焦可以预约、可到店、可共同参与的体验礼物，注意要能落到商品或服务方向。",
        0.78,
        0.9,
    ),
    FocusProfile(
        "premium_quality",
        "品质类",
        "聚焦质感、耐用、长期使用、包装体面、预算较高也不显炫耀的礼物方向。",
        0.72,
        0.88,
    ),
]


def main() -> int:
    args = parse_args()
    questionnaire = read_json(QUESTIONNAIRE_PATH)
    enums = get_questionnaire_enums(questionnaire)
    existing = read_existing_gift_refs(EXISTING_GIFTS_PATH)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    paths = {
        "prompts": OUTPUT_DIR / f"gift-generation-prompts-{timestamp}.jsonl",
        "raw": OUTPUT_DIR / f"generated-gifts-ollama-{timestamp}.raw.jsonl",
        "gifts": OUTPUT_DIR / f"generated-gifts-ollama-{timestamp}.gifts.jsonl",
        "errors": OUTPUT_DIR / f"generated-gifts-ollama-{timestamp}.errors.jsonl",
        "json": OUTPUT_DIR / f"generated-gifts-ollama-{timestamp}.json",
    }

    plan = build_prompt_plan(args.count, args.batch_size, args.oversample)
    common_prefix = build_common_prompt_prefix(enums, existing)
    write_prompt_file(paths["prompts"], plan, common_prefix)

    if args.prompts_only:
        print(f"Wrote {paths['prompts'].relative_to(ROOT)}")
        return 0

    stats = run_generation(args, enums, existing, common_prefix, plan, paths)
    print(f"Generated {stats['accepted']} gift candidates from {stats['calls']} Ollama calls.")
    print(f"Wrote {paths['gifts'].relative_to(ROOT)}")
    print(f"Wrote {paths['raw'].relative_to(ROOT)}")
    print(f"Wrote {paths['json'].relative_to(ROOT)}")
    if stats["errors"]:
        print(f"Recorded {stats['errors']} recoverable errors in {paths['errors'].relative_to(ROOT)}")
    if stats["accepted"] < args.count:
        print(f"Stopped after prompt plan was exhausted; requested {args.count}.")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate gift candidates with local Ollama gemma4:e2b.",
    )
    parser.add_argument(
        "count",
        nargs="?",
        type=positive_int,
        default=12,
        help="number of cleaned gift candidates to try to keep",
    )
    parser.add_argument("--model", default=OLLAMA_MODEL, help="Ollama model name")
    parser.add_argument("--url", default=OLLAMA_URL, help="Ollama chat API URL")
    parser.add_argument(
        "--batch-size",
        type=positive_int,
        default=DEFAULT_BATCH_SIZE,
        help="gift candidates requested per Ollama call; 1 is slow but memory-friendly",
    )
    parser.add_argument(
        "--oversample",
        type=positive_float,
        default=DEFAULT_OVERSAMPLE,
        help="prompt plan size multiplier to survive duplicates and invalid responses",
    )
    parser.add_argument(
        "--pause",
        type=non_negative_float,
        default=DEFAULT_PAUSE_SECONDS,
        help="seconds to sleep between calls",
    )
    parser.add_argument("--timeout", type=positive_int, default=OLLAMA_TIMEOUT_SECONDS)
    parser.add_argument("--retries", type=non_negative_int, default=DEFAULT_RETRIES)
    parser.add_argument(
        "--keep-alive",
        default="30m",
        help="Ollama keep_alive value; keeps the small model warm for repeated calls",
    )
    parser.add_argument(
        "--prompts-only",
        action="store_true",
        help="only write the prompt plan file and do not call Ollama",
    )
    return parser.parse_args()


def positive_int(value: str) -> int:
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError("must be greater than 0")
    return number


def non_negative_int(value: str) -> int:
    number = int(value)
    if number < 0:
        raise argparse.ArgumentTypeError("must be greater than or equal to 0")
    return number


def positive_float(value: str) -> float:
    number = float(value)
    if number <= 0:
        raise argparse.ArgumentTypeError("must be greater than 0")
    return number


def non_negative_float(value: str) -> float:
    number = float(value)
    if number < 0:
        raise argparse.ArgumentTypeError("must be greater than or equal to 0")
    return number


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def get_questionnaire_enums(config: dict[str, Any]) -> dict[str, list[str]]:
    by_id = {question["id"]: question for question in config.get("questions", [])}
    enum_ids = ["target", "gender", "scene", "occupation", "recipientStyle", "budget"]

    enums: dict[str, list[str]] = {}
    labels: dict[str, dict[str, str]] = {}
    for enum_id in enum_ids:
        question = by_id.get(enum_id, {})
        options = question.get("options", [])
        enums[enum_id] = [option["value"] for option in options if option.get("value")]
        labels[enum_id] = {
            option["value"]: option.get("label", option["value"])
            for option in options
            if option.get("value")
        }

    enums["preparationTime"] = PREPARATION_TIMES
    enums["emotionalTags"] = EMOTIONAL_TAGS
    enums["visualStyle"] = VISUAL_STYLES
    enums["_labels"] = labels  # type: ignore[assignment]
    return enums


def read_existing_gift_refs(path: Path) -> dict[str, set[str]]:
    text = path.read_text(encoding="utf-8") if path.exists() else ""
    ids = set(re.findall(r'id:\s*"([^"]+)"', text))
    names = set(re.findall(r'name:\s*"([^"]+)"', text))
    return {"ids": ids, "names": names}


def build_prompt_plan(
    count: int,
    batch_size: int,
    oversample: float,
) -> list[dict[str, Any]]:
    planned_candidates = max(count, int(count * oversample + 0.999))
    plan: list[dict[str, Any]] = []
    profile_index = 0
    remaining = planned_candidates

    while remaining > 0:
        profile = FOCUS_PROFILES[profile_index % len(FOCUS_PROFILES)]
        request_count = min(batch_size, remaining)
        plan.append(
            {
                "index": len(plan) + 1,
                "focus": profile.name,
                "focusTitle": profile.title,
                "count": request_count,
                "temperature": profile.temperature,
                "top_p": profile.top_p,
                "focusInstruction": profile.instruction,
            }
        )
        remaining -= request_count
        profile_index += 1

    return plan


def build_common_prompt_prefix(
    enums: dict[str, list[str]],
    existing: dict[str, set[str]],
) -> str:
    labels = enums["_labels"]  # type: ignore[index]
    existing_names = "、".join(sorted(existing["names"])[:160]) or "暂无"

    return f"""
你是“送礼推荐平台”的商品数据策划，不是广告文案写手。
请生成新的礼物候选，帮助用户在小程序里看到可购买、可比较、适合电商商品流展示的礼物方向。

重要原则：
1. 生成的是“礼物品类/商品方向”，不要写具体品牌、店铺、型号、价格。
2. 风格要温柔、具体、像朋友认真帮忙挑，不要喊口号，不要写“爆款”“必买”“高级感满满”这类空话。
3. 不要性别刻板印象，不要写“女生一定喜欢”“爸妈都需要”。
4. 不要医疗功效、投资理财、烟酒、保健品疗效、奢侈品炫耀。
5. 标签要适合前端小胶囊展示，短、具体、有辨识度，例如“质感高级”“包装精美”“适合程序员”“通勤友好”“不易出错”。
6. 避开下面已有礼物名称，不要同义改写凑数：{existing_names}

必须严格使用这些枚举值：
- target: {format_enum(enums, labels, "target")}
- gender: {format_enum(enums, labels, "gender")}
- scene: {format_enum(enums, labels, "scene")}
- occupation: {format_enum(enums, labels, "occupation")}
- recipientStyle: {format_enum(enums, labels, "recipientStyle")}
- budget: {format_enum(enums, labels, "budget")}
- preparationTime: {", ".join(PREPARATION_TIMES)}
- emotionalTags: {", ".join(EMOTIONAL_TAGS)}
- visualStyle: {", ".join(VISUAL_STYLES)}

枚举填写规则：
- 数组里只能写等号左侧的英文 value，例如 "partner"，不要写 "partner=恋人" 或 "恋人"。
- visualStyle 只能从 minimal、warm、delicate、tech、classic 中选，不要写 aesthetic。

输出要求：
- 只输出 JSON 对象，不要 Markdown，不要解释。
- JSON 结构必须是 {{ "gifts": [...] }}。
- gifts 数组长度尽量等于本次要求数量。
- 每个 gift 必须包含以下字段：
  - id: 英文 kebab-case，不能与已有 id 重复
  - name: 中文名，4 到 10 个汉字，像电商商品方向
  - target: 枚举数组，1 到 3 个
  - gender: 枚举数组，1 到 2 个
  - scene: 枚举数组，1 到 3 个
  - occupation: 枚举数组，1 到 3 个
  - recipientStyle: 枚举数组，1 到 3 个
  - budget: 枚举数组，1 到 3 个
  - preparationTime: 枚举数组，1 到 3 个
  - emotionalTags: 枚举数组，1 到 3 个
  - visualStyle: 枚举数组，1 到 2 个
  - highlights: 2 个短卖点，每个 2 到 5 个汉字
  - tags: 2 到 3 个前端展示标签，每个不超过 6 个汉字
  - riskTags: 可以为空数组；如果有，最多 1 个，且不要恐吓
  - pairingTags: 1 到 3 个搭配建议，每个不超过 6 个汉字
  - recommendReason: 一句话，18 到 32 个汉字，具体说明为什么适合

内容多样性：
- 覆盖恋人、爸妈、闺蜜，不要集中在一个人群。
- 覆盖不同预算，不要全是小东西。
- 多生成能在淘宝/京东/小红书电商场景里找到的商品方向。
""".strip()


def write_prompt_file(path: Path, plan: list[dict[str, Any]], common_prefix: str) -> None:
    with path.open("w", encoding="utf-8") as file:
        for job in plan:
            record = {
                **job,
                "prompt": build_prompt_from_job(common_prefix, job),
            }
            file.write(json.dumps(record, ensure_ascii=False) + "\n")


def build_prompt_from_job(common_prefix: str, job: dict[str, Any]) -> str:
    return f"""
{common_prefix}

本次要求数量：{job["count"]}
本次方向：{job["focusTitle"]}
本次额外约束：{job["focusInstruction"]}

请优先给出和前几次方向不一样的礼物，不要为了满足数量输出重复概念。
""".strip()


def format_enum(enums: dict[str, list[str]], labels: dict[str, dict[str, str]], key: str) -> str:
    return ", ".join(f"{value}={labels[key].get(value, value)}" for value in enums.get(key, []))


def run_generation(
    args: argparse.Namespace,
    enums: dict[str, list[str]],
    existing: dict[str, set[str]],
    common_prefix: str,
    plan: list[dict[str, Any]],
    paths: dict[str, Path],
) -> dict[str, int]:
    stats = {"accepted": 0, "calls": 0, "errors": 0}

    with (
        JsonlWriter(paths["raw"]) as raw_writer,
        JsonlWriter(paths["gifts"]) as gift_writer,
        JsonlWriter(paths["errors"]) as error_writer,
        StreamingGiftJsonWriter(paths["json"], args.model) as json_writer,
    ):
        try:
            for job in plan:
                if stats["accepted"] >= args.count:
                    break

                prompt = build_prompt_from_job(common_prefix, job)
                print(
                    f'Call {job["index"]}/{len(plan)} [{job["focus"]}] '
                    f'requesting {job["count"]}; accepted {stats["accepted"]}/{args.count}',
                    flush=True,
                )

                content = call_ollama_with_retries(args, prompt, job, raw_writer, error_writer, stats)
                if not content:
                    sleep_between_calls(args.pause)
                    continue

                try:
                    gifts = parse_gifts(content)
                    batch = clean_gifts(gifts, job["count"], enums, existing)
                except Exception as error:  # Keep overnight runs moving after malformed output.
                    stats["errors"] += 1
                    error_writer.write(error_record(job, "parse_or_clean", error))
                    sleep_between_calls(args.pause)
                    continue

                if not batch:
                    error_writer.write(
                        {
                            "time": now_iso(),
                            "job": slim_job(job),
                            "stage": "clean",
                            "error": "No valid gifts in response.",
                        }
                    )
                    stats["errors"] += 1
                    sleep_between_calls(args.pause)
                    continue

                for gift in batch:
                    if stats["accepted"] >= args.count:
                        break
                    record = {"time": now_iso(), "job": slim_job(job), "gift": gift}
                    gift_writer.write(record)
                    json_writer.write_gift(gift)
                    existing["ids"].add(gift["id"])
                    existing["names"].add(gift["name"])
                    stats["accepted"] += 1

                sleep_between_calls(args.pause)
        except KeyboardInterrupt:
            stats["errors"] += 1
            error_writer.write(
                {
                    "time": now_iso(),
                    "stage": "interrupted",
                    "error": "KeyboardInterrupt; partial files were closed cleanly.",
                }
            )
            print("Interrupted; partial output files were closed cleanly.", flush=True)

    return stats


def call_ollama_with_retries(
    args: argparse.Namespace,
    prompt: str,
    job: dict[str, Any],
    raw_writer: "JsonlWriter",
    error_writer: "JsonlWriter",
    stats: dict[str, int],
) -> str | None:
    for attempt in range(args.retries + 1):
        try:
            response = call_ollama(args, prompt, job)
            stats["calls"] += 1
            raw_writer.write(
                {
                    "time": now_iso(),
                    "job": slim_job(job),
                    "attempt": attempt + 1,
                    "response": response,
                }
            )
            content = response.get("message", {}).get("content")
            if not isinstance(content, str) or not content.strip():
                raise ValueError("Ollama returned an empty response.")
            return content
        except Exception as error:  # Network/model errors are recoverable per prompt.
            stats["errors"] += 1
            error_writer.write(error_record(job, "ollama", error, attempt + 1))
            if attempt < args.retries:
                time.sleep(min(30.0, 2.0 * (attempt + 1)))

    return None


def call_ollama(args: argparse.Namespace, prompt: str, job: dict[str, Any]) -> dict[str, Any]:
    body = {
        "model": args.model,
        "stream": False,
        "format": "json",
        "keep_alive": args.keep_alive,
        "messages": [
            {
                "role": "system",
                "content": "你只输出有效 JSON。不要 Markdown，不要解释，不要在 JSON 外添加任何文字。",
            },
            {"role": "user", "content": prompt},
        ],
        "options": {
            "temperature": job["temperature"],
            "top_p": job["top_p"],
            "num_predict": 900,
        },
    }
    request = urllib.request.Request(
        args.url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(request, timeout=args.timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def parse_gifts(content: str) -> list[dict[str, Any]]:
    content = strip_code_fence(content.strip())
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        parsed = json.loads(extract_json_object(content))

    gifts = parsed if isinstance(parsed, list) else parsed.get("gifts", [])
    if not isinstance(gifts, list):
        raise ValueError('JSON must contain a "gifts" array.')
    return [gift for gift in gifts if isinstance(gift, dict)]


def strip_code_fence(text: str) -> str:
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text


def extract_json_object(text: str) -> str:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("Could not find a JSON object in Ollama response.")
    return text[start : end + 1]


def clean_gifts(
    gifts: list[dict[str, Any]],
    count: int,
    enums: dict[str, list[str]],
    existing: dict[str, set[str]],
) -> list[dict[str, Any]]:
    used_ids = set(existing["ids"])
    used_names = set(existing["names"])
    cleaned: list[dict[str, Any]] = []

    for gift in gifts:
        name = normalize_text(gift.get("name"))
        if not name or name in used_names:
            continue

        gift_id = normalize_id(gift.get("id"), name)
        while gift_id in used_ids:
            gift_id = f"{gift_id}-{len(cleaned) + 1}"

        item = {
            "id": gift_id,
            "name": name,
            "target": clean_enum_array(gift.get("target"), enums["target"]),
            "gender": clean_enum_array(gift.get("gender"), enums["gender"]),
            "scene": clean_enum_array(gift.get("scene"), enums["scene"]),
            "occupation": clean_enum_array(gift.get("occupation"), enums["occupation"]),
            "recipientStyle": clean_enum_array(gift.get("recipientStyle"), enums["recipientStyle"]),
            "budget": clean_enum_array(gift.get("budget"), enums["budget"]),
            "preparationTime": clean_enum_array(gift.get("preparationTime"), PREPARATION_TIMES),
            "emotionalTags": clean_enum_array(gift.get("emotionalTags"), EMOTIONAL_TAGS),
            "visualStyle": clean_enum_array(gift.get("visualStyle"), VISUAL_STYLES),
            "highlights": clean_text_array(gift.get("highlights"), limit=2, max_len=8),
            "tags": clean_text_array(gift.get("tags"), limit=3, max_len=8),
            "riskTags": clean_text_array(gift.get("riskTags"), limit=1, max_len=8),
            "pairingTags": clean_text_array(gift.get("pairingTags"), limit=3, max_len=8),
            "recommendReason": normalize_text(gift.get("recommendReason")),
        }

        if not has_required_arrays(item):
            continue
        if len(item["highlights"]) < 2 or len(item["tags"]) < 2:
            continue
        if not item["recommendReason"]:
            continue

        cleaned.append(item)
        used_ids.add(gift_id)
        used_names.add(name)
        if len(cleaned) >= count:
            break

    return cleaned


def normalize_text(value: Any) -> str:
    return str(value or "").strip()


def normalize_id(value: Any, name: str) -> str:
    raw = normalize_text(value).lower()
    raw = re.sub(r"[^a-z0-9-]+", "-", raw)
    raw = re.sub(r"-{2,}", "-", raw).strip("-")
    if raw:
        return raw
    digest = hashlib.sha1(name.encode("utf-8")).hexdigest()[:8]
    return f"gift-{digest}"


def clean_enum_array(value: Any, allowed: list[str]) -> list[str]:
    values = value if isinstance(value, list) else [value]
    allowed_set = set(allowed)
    result: list[str] = []
    for item in values:
        text = normalize_text(item)
        for candidate in enum_candidates(text):
            if candidate in allowed_set and candidate not in result:
                result.append(candidate)
                break
    return result


def enum_candidates(text: str) -> list[str]:
    candidates = [text]
    if "=" in text:
        candidates.append(text.split("=", 1)[0].strip())
    if ":" in text:
        candidates.append(text.split(":", 1)[0].strip())
    if text == "aesthetic":
        candidates.append("delicate")
    return candidates


def clean_text_array(value: Any, limit: int, max_len: int) -> list[str]:
    values = value if isinstance(value, list) else [value]
    result: list[str] = []
    for item in values:
        text = normalize_text(item)
        if not text or text in result:
            continue
        result.append(text[:max_len])
        if len(result) >= limit:
            break
    return result


def has_required_arrays(item: dict[str, Any]) -> bool:
    for key in [
        "target",
        "gender",
        "scene",
        "occupation",
        "recipientStyle",
        "budget",
        "preparationTime",
        "emotionalTags",
        "visualStyle",
    ]:
        if not item[key]:
            return False
    return True


class JsonlWriter:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.file: Any = None

    def __enter__(self) -> "JsonlWriter":
        self.file = self.path.open("a", encoding="utf-8")
        return self

    def __exit__(self, exc_type: Any, exc: Any, traceback: Any) -> None:
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
        self.file.write(
            json.dumps(
                {
                    "model": self.model,
                    "createdAt": now_iso(),
                    "source": "scripts/generate-gifts-ollama.py",
                },
                ensure_ascii=False,
                indent=2,
            )[:-2]
        )
        self.file.write(',\n  "gifts": [\n')
        self.file.flush()
        return self

    def __exit__(self, exc_type: Any, exc: Any, traceback: Any) -> None:
        if self.file:
            self.file.write("\n  ]\n}\n")
            self.file.close()

    def write_gift(self, gift: dict[str, Any]) -> None:
        if self.count:
            self.file.write(",\n")
        self.file.write("    ")
        self.file.write(json.dumps(gift, ensure_ascii=False))
        self.file.flush()
        self.count += 1


def slim_job(job: dict[str, Any]) -> dict[str, Any]:
    return {
        "index": job["index"],
        "focus": job["focus"],
        "count": job["count"],
        "temperature": job["temperature"],
        "top_p": job["top_p"],
    }


def error_record(
    job: dict[str, Any],
    stage: str,
    error: Exception,
    attempt: int | None = None,
) -> dict[str, Any]:
    record = {
        "time": now_iso(),
        "job": slim_job(job),
        "stage": stage,
        "errorType": type(error).__name__,
        "error": normalize_error(error),
    }
    if attempt is not None:
        record["attempt"] = attempt
    return record


def normalize_error(error: Exception) -> str:
    if isinstance(error, urllib.error.HTTPError):
        return f"HTTP {error.code}: {error.reason}"
    if isinstance(error, urllib.error.URLError):
        return f"URL error: {error.reason}"
    if isinstance(error, (TimeoutError, socket.timeout)):
        return "Timed out while waiting for Ollama."
    return str(error)


def now_iso() -> str:
    return dt.datetime.now().astimezone().isoformat(timespec="seconds")


def sleep_between_calls(seconds: float) -> None:
    if seconds > 0:
        time.sleep(seconds)


if __name__ == "__main__":
    raise SystemExit(main())
