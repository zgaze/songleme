#!/usr/bin/env node
/**
 * 礼物方向批量生成脚本
 *
 * 用法:
 *   # 用 DeepSeek
 *   LLM_BASE_URL=https://api.deepseek.com LLM_API_KEY=sk-xxx LLM_MODEL=deepseek-chat \
 *     node scripts/generate-gifts.js
 *
 *   # 用 OpenAI
 *   LLM_API_KEY=sk-xxx \
 *     node scripts/generate-gifts.js
 *
 *   # 指定生成类别
 *   TARGET=parents SCENE=festival BUDGET=300_800 \
 *     node scripts/generate-gifts.js
 *
 *   # 只预览不写入
 *   DRY_RUN=1 node scripts/generate-gifts.js
 *
 * 环境变量:
 *   LLM_BASE_URL  — OpenAI 兼容 API 地址（默认 https://api.openai.com）
 *   LLM_API_KEY   — API Key（必填）
 *   LLM_MODEL     — 模型名（默认 gpt-4o-mini）
 *   TARGET        — 生成目标人群: partner / parents / 留空=两者都生成
 *   SCENE         — 生成场景: birthday / anniversary / festival / daily / 留空=全部
 *   BUDGET        — 生成预算档: under_100 / 100_300 / 300_800 / 800_plus / 留空=全部
 *   COUNT         — 每个组合生成多少条（默认 3）
 *   DRY_RUN       — 设为 1 则只打印不写入文件
 */

const fs = require("fs");
const path = require("path");

// ─── 配置 ───────────────────────────────────────────────────────────────────

const LLM_BASE_URL = process.env.LLM_BASE_URL || "https://api.openai.com";
const LLM_API_KEY = process.env.LLM_API_KEY;
const LLM_MODEL = process.env.LLM_MODEL || "gpt-4o-mini";

const TARGET_FILTER = process.env.TARGET || "";
const SCENE_FILTER = process.env.SCENE || "";
const BUDGET_FILTER = process.env.BUDGET || "";
const COUNT = parseInt(process.env.COUNT || "10", 10);
const DRY_RUN = process.env.DRY_RUN === "1";

// ─── 枚举值 ─────────────────────────────────────────────────────────────────

const TARGETS = ["partner", "parents"];
const SCENES = ["birthday", "anniversary", "festival", "daily"];
const BUDGETS = ["under_100", "100_300", "300_800", "800_plus"];
const EMOTIONAL_TAGS = ["romantic", "company", "care", "surprise", "memory"];
const VISUAL_STYLES = ["minimal", "warm", "delicate", "tech", "classic"];

// ─── Prompt 模板（修改这里来调整生成策略）────────────────────────────────────

function buildPrompt({ target, scene, budget, existingNames }) {
  const targetLabel = target === "partner" ? "伴侣/恋人" : "父母/长辈";
  const sceneLabels = {
    birthday: "生日",
    anniversary: "纪念日",
    festival: "节日（春节/中秋/母亲节等）",
    daily: "日常关心",
  };
  const budgetLabels = {
    under_100: "100元以下",
    "100_300": "100-300元",
    "300_800": "300-800元",
    "800_plus": "800元以上",
  };

  return `你是一个资深礼物买手，熟悉各种价位和场景下人们实际会送什么。请为以下场景生成 ${COUNT} 个礼物方向。

## 场景
- 送礼对象: ${targetLabel}
- 场合: ${sceneLabels[scene]}
- 预算区间: ${budgetLabels[budget]}

## 要求
1. 每个礼物方向是"品类/方向"级别的（如"手工巧克力"），不是某个具体品牌商品
2. 要实际能买到的，不要虚构
3. 品类尽量分散，不要连续出同一类（比如不要 5 个都是吃的）
4. 想想真实送礼场景：大家会送什么、什么价位合适、有什么坑
5. highlights 用大白话，4-8 个字，说清楚这个礼物好在哪
6. recommendReason 像朋友随口推荐，一两句话
7. riskTags 说人话（如"怕踩审美雷""需要知道对方尺码"），没有明显风险就空着
8. pairingTags 适合一起送的小东西，1-2 个

## 参考枚举（不必严格使用，但可以参考来保持一致性）
- emotionalTags 参考: ${EMOTIONAL_TAGS.join(", ")}
- visualStyle 参考: ${VISUAL_STYLES.join(", ")}

${existingNames.length > 0 ? `## 已有方向（避免重复）\n${existingNames.join("、")}\n` : ""}
## 输出格式
严格输出 JSON 对象: { "gifts": [ ... ] }
每个元素:
{
  "id": "英文短横线命名",
  "name": "中文名",
  "target": ["${target}"],
  "scene": ["${scene}"],
  "budget": ["${budget}"],
  "emotionalTags": ["从参考值中选 1-3 个，或自填相近的词"],
  "visualStyle": ["从参考值中选 1-2 个，或自填相近的词"],
  "highlights": ["大白话卖点1", "大白话卖点2"],
  "riskTags": ["风险，没有就留空数组"],
  "pairingTags": ["搭配1"],
  "recommendReason": "朋友推荐语气"
}`;
}

// ─── LLM 调用 ───────────────────────────────────────────────────────────────

async function callLLM(prompt) {
  const url = `${LLM_BASE_URL.replace(/\/+$/, "")}/v1/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        {
          role: "system",
          content:
            "你是礼物推荐数据生成助手。严格输出 JSON 数组，不要有其他文字。",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "[]";

  // 解析：LLM 可能返回 { "gifts": [...] } 或直接 [...]
  const parsed = JSON.parse(content);
  return Array.isArray(parsed) ? parsed : parsed.gifts || parsed.data || [];
}


// ─── 自动修复 ───────────────────────────────────────────────────────────────

function repairGift(gift, combo) {
  // 确保数组字段是数组（不管 LLM 返回啥，先保证结构对）
  if (!Array.isArray(gift.target) || gift.target.length === 0) {
    gift.target = [combo.target];
  }
  if (!Array.isArray(gift.scene) || gift.scene.length === 0) {
    gift.scene = [combo.scene];
  }
  if (!Array.isArray(gift.budget) || gift.budget.length === 0) {
    gift.budget = [combo.budget];
  }
  if (!Array.isArray(gift.emotionalTags) || gift.emotionalTags.length === 0) {
    gift.emotionalTags = ["care"];
  }
  if (!Array.isArray(gift.visualStyle) || gift.visualStyle.length === 0) {
    gift.visualStyle = ["warm"];
  }
  if (!Array.isArray(gift.highlights)) gift.highlights = [];
  if (!Array.isArray(gift.riskTags)) gift.riskTags = [];
  if (!Array.isArray(gift.pairingTags)) gift.pairingTags = [];
}

// ─── 主流程 ─────────────────────────────────────────────────────────────────

async function main() {
  if (!LLM_API_KEY) {
    console.error("错误: 请设置 LLM_API_KEY 环境变量");
    console.error("");
    console.error("示例:");
    console.error(
      '  LLM_BASE_URL=https://api.deepseek.com LLM_API_KEY=sk-xxx LLM_MODEL=deepseek-chat \\'
    );
    console.error("    node scripts/generate-gifts.js");
    process.exit(1);
  }

  // 加载已有礼物
  const existingPath = path.resolve(
    __dirname,
    "../cloudfunctions/recommendGift/data/giftDirections.js"
  );
  const existingContent = fs.readFileSync(existingPath, "utf-8");
  const existingMatch = existingContent.match(
    /const GIFT_DIRECTIONS = ([\s\S]*?);[\s]*module\.exports/
  );
  // giftDirections.js 用的是 JS 对象语法（key 无引号），不能直接 JSON.parse
  const existingGifts = existingMatch
    ? new Function("return " + existingMatch[1])()
    : [];
  const existingNames = existingGifts.map((g) => g.name);

  console.log(`已有 ${existingGifts.length} 个礼物方向`);

  // 确定要生成的组合
  const targets = TARGET_FILTER ? [TARGET_FILTER] : TARGETS;
  const scenes = SCENE_FILTER ? [SCENE_FILTER] : SCENES;
  const budgets = BUDGET_FILTER ? [BUDGET_FILTER] : BUDGETS;

  const combinations = [];
  for (const t of targets) {
    for (const s of scenes) {
      for (const b of budgets) {
        combinations.push({ target: t, scene: s, budget: b });
      }
    }
  }

  console.log(`将生成 ${combinations.length} 个组合，每个 ${COUNT} 条`);
  console.log(
    `目标: targets=${targets.join(",")} scenes=${scenes.join(",")} budgets=${budgets.join(",")}`
  );

  if (DRY_RUN) {
    console.log("");
    console.log("=== DRY RUN: 以下为待生成组合（未调用 LLM）===");
    combinations.forEach((combo, i) => {
      console.log(
        `  ${i + 1}. ${combo.target} / ${combo.scene} / ${combo.budget} → ${COUNT} 条`
      );
    });
    console.log("");
    console.log(`共 ${combinations.length} 个组合，预计生成 ${combinations.length * COUNT} 条`);
    console.log("去掉 DRY_RUN=1 执行实际生成");
    return;
  }

  console.log("");

  // rawResponses: 保存 LLM 返回的原始数据（花钱买的，一条都不丢）
  // cleanedGifts: 经过 repairGift 修复后的数据
  const rawResponses = [];
  const cleanedGifts = [];
  let total = 0;

  for (const combo of combinations) {
    const label = `${combo.target}/${combo.scene}/${combo.budget}`;
    process.stdout.write(`生成 ${label} ... `);

    try {
      const prompt = buildPrompt({
        ...combo,
        existingNames: [...existingNames, ...cleanedGifts.map((g) => g.name)],
      });

      const gifts = await callLLM(prompt);

      // 原始数据全部保存
      rawResponses.push({
        combo,
        prompt,
        raw: gifts,
        timestamp: new Date().toISOString(),
      });

      // 修复后也保存
      for (const gift of gifts) {
        repairGift(gift, combo);
        cleanedGifts.push(gift);
      }

      console.log(`${gifts.length} 条`);
      total += gifts.length;
    } catch (err) {
      // 请求失败也记录
      rawResponses.push({
        combo,
        prompt: null,
        error: err.message,
        timestamp: new Date().toISOString(),
      });
      console.log(`失败: ${err.message}`);
    }

    // 避免速率限制
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("");
  console.log(`生成完成: 共 ${total} 条`);

  // 输出到独立文件，不碰生产代码
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  // 1. 原始 LLM 响应（花钱买的，全量保留）
  const rawPath = path.resolve(__dirname, `../data/raw-gifts-${timestamp}.json`);
  fs.writeFileSync(rawPath, JSON.stringify(rawResponses, null, 2));
  console.log(`原始数据: ${rawPath}`);

  // 2. 修复后的数据（可直接审核使用）
  const cleanedPath = path.resolve(__dirname, `../data/cleaned-gifts-${timestamp}.json`);
  fs.writeFileSync(cleanedPath, JSON.stringify(cleanedGifts, null, 2));
  console.log(`修复后数据: ${cleanedPath} (${cleanedGifts.length} 条)`);
  console.log("");
  console.log("下一步:");
  console.log("  1. 审核 cleaned 文件，删除不满意的条目");
  console.log("  2. 手动合并到 cloudfunctions/recommendGift/data/giftDirections.js");
  console.log("  3. 同步到 miniprogram/shared/giftDirections.js");
  console.log("  4. 如果需要二次修复，用 raw 文件重新跑 repairGift 或让 LLM 补字段");
}

main().catch((err) => {
  console.error("致命错误:", err);
  process.exit(1);
});
