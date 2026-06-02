# 执行简报 · 重写 DeepSeek 礼物生成脚本

> **读者：执行这件事的 agent。** 这是一份可直接执行的任务简报，不是泛泛的项目文档。
> 目标文件：`scripts/generate-gifts-deepseek.py`（已存在，需改写，非重建）。
> 背景与全局：`docs/dev-plan-2026-06.md` 阶段 1；数据契约：`docs/gift-protocol-v3.md` + `schemas/gift-direction.schema.json`。

---

## 0. 先读这些（动手前必看）

- `scripts/generate-gifts-deepseek.py` 全文。重点函数：`build_common_prefix`(L434)、`build_job_prompt`(L476)、`run_generation`(L336)、`clean_gift_v3`(L612)、`call_deepseek`(L524)、常量 `GIFT_PRINCIPLES_PROMPT`(L101)、`FEW_SHOT_EXAMPLE`(L120)、`CATEGORY_PROFILES`(L144)。
- `schemas/gift-direction.schema.json`（含新字段 `searchKeywords`）。
- 上一轮产物 `data/generated-gifts-deepseek-20260601-105159.json`（80 条，看名字塌缩成「X礼盒/X套装」的现象）。

## 1. 锁定的决定（不要重新讨论）

- 模型名 `deepseek-v4-flash` **正确，别改**（`deepseek-v4-pro` 是另一档）。API key 在 `.secrets/deepseek-api-key.txt` 第一行。
- 推荐品**单层**，颗粒度到方向（如"面膜"）。**不**做商品两层模型。
- 方向名**不写具体品牌/型号/明星/IP**；品牌/爆品只进新字段 `searchKeywords`。
- `response_format: json_object` 保留；`preparationTime` 字段在 v3 已删，本脚本不涉及。
- **不要擅自跑大额计费生成**。验证只用 `--prompts-only` 和一次 ≤12 条的小冒烟。

## 2. 要解决的三个问题（带根因）

### 2.1 前缀缓存命中率低 → 成本高
**根因**：`build_common_prefix` 把"避免重名"清单（`existing["names_order"][-140:]`）放进了**前缀靠前处**（安全规则第 4 条），而清单每次调用都在变 → DeepSeek 按"最长相同前缀"命中，清单一变，它后面最贵的静态内容（枚举 / 字段规则 / few-shot）**全部 miss**。

**改法**：
1. `build_common_prefix()` 改成**无参、100% 静态**：履约原则 + 安全规则（**去掉**第 4 条避重清单）+ 枚举 + 字段规则 + few-shot。逐字节不变。
2. 把避重清单挪到 `build_job_prompt` 拼接的**最末尾**，且**只放当前品类/格子最近 ~30 个名字**（小、且只影响尾部）。为此在 `existing` 里维护 `names_by_cell`（按生成格子归类），没有就退化为全局最近 30。
3. `call_deepseek` 系统消息保持逐字节不变（已是固定串，确认即可）。
4. **可观测**：在 `call_deepseek` 读取响应 `usage` 里的 `prompt_cache_hit_tokens` / `prompt_cache_miss_tokens`，逐调用打印，并在结束时汇总命中率。这是本问题的验收凭据。

### 2.2 结果太少 + 重复多
**重新定位**：方向数量本不需多（覆盖到位约 80~150 条即可），丰富度靠 `searchKeywords` 下游扩展。所以**不靠堆方向数**，要治的是重复与覆盖。
**改法**：
1. 生成空间从"按 14 品类轮询"改为按 **`品类 × 预算档`**（或 `品类 × persona`）**切格子**，每格独立配额、独立避重清单；遍历格子而非纯轮询品类。
2. 把"具体性"引导进 `searchKeywords`，方向名保持简洁可匹配（缓解「X礼盒」塌缩）。
3. 语义去重沿用 `name_key`；停止条件改为**按格子覆盖度 + max_calls**，不再用绝对 count 硬卡。

### 2.3 让模型顺带产出爆品/品牌关键词
**改法**：
1. `GIFT_PRINCIPLES_PROMPT` 里**当前那句"不编造具体品牌"要拆**：方向名仍不写品牌；但**新增**要求——为每条方向给 3~8 个 `searchKeywords`，**可以且应当**是真实爆品/经典款/品牌名（如 面膜→`补水面膜`/`森田玻尿酸面膜`/`可复美`），作为下游电商搜索种子。明确这些词不参与匹配、只为检索。
2. `FEW_SHOT_EXAMPLE` 加 `searchKeywords` 示例。
3. `build_common_prefix` 的字段清单（L465-469 那段）加 `searchKeywords[3-8,每个2-20字,可含品牌]`。
4. `clean_gift_v3` 用 `clean_text_array(raw.get("searchKeywords"), limit=8, max_len=20)` 收进结果对象；**不作硬必填**（缺失=空数组）。

## 3. 不要动的东西
salvage 解析、`name_key` 语义去重、跨运行 dedup、429/重试、流式落盘（`StreamingGiftJsonWriter`）、6 个硬必填判定逻辑。

## 4. 验收标准（逐条可检验）

1. `python3 scripts/generate-gifts-deepseek.py --prompts-only` 成功；把任意两个品类的 prompt 取出，**静态前缀部分逐字节相同**（避重清单只在末尾、且只含当前格子名字）。
2. prompt 字段说明与 few-shot 都含 `searchKeywords`，且明确"方向名不含品牌、关键词可含品牌"。
3. 小冒烟：`... 12 --batch-size 6`（≤12 条，单次小额）后，产出每条都带 `searchKeywords`（≥1 个），方向名不含品牌词，关键词里出现真实爆品/品牌。
4. 取冒烟产物若干条用 `schemas/gift-direction.schema.json` 校验**全过**（python `jsonschema` 或 node `ajv`）。
5. 冒烟运行日志打印每次调用的 `prompt_cache_hit_tokens`：**第 2 次调用起命中 > 0**（证明前缀缓存生效）。
6. 同品类重复名比例较旧产物下降（人工抽看 `name_key` 冲突明显减少）。

## 5. 如何验证（命令）
```sh
# 0 花费：只看 prompt 结构与缓存前缀是否稳定
python3 scripts/generate-gifts-deepseek.py --prompts-only
# 小额冒烟（确认字段/缓存/关键词），不要放大 count
python3 scripts/generate-gifts-deepseek.py 12 --batch-size 6
# 校验产物（示意，用仓库已有校验或临时脚本）
python3 - <<'PY'
import json, glob, jsonschema
schema = json.load(open("schemas/gift-direction.schema.json"))
data = json.load(open(sorted(glob.glob("data/generated-gifts-deepseek-*.json"))[-1]))
for g in data["gifts"][:10]:
    jsonschema.validate(g, schema)
print("ok", len(data["gifts"]))
PY
```
跑完把"缓存命中率、产出条数、searchKeywords 覆盖率、重复下降"写一句结论回报，**不要**自行放大到上百条计费生成。
