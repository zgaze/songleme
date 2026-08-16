const https = require("https");

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-flash";
const CANDIDATE_LIMIT = 8;
const MAX_TEXT_LENGTH = 80;

function cleanText(value, maxLength = MAX_TEXT_LENGTH) {
  return String(value || "")
    .trim()
    .slice(0, maxLength);
}

function toArray(value) {
  if (Array.isArray(value)) return value.filter((item) => item !== undefined && item !== null);
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function compactGift(gift) {
  return {
    id: cleanText(gift.id, 60),
    name: cleanText(gift.name, 40),
    tags: toArray(gift.tags || gift.highlights).map((tag) => cleanText(tag, 12)).filter(Boolean),
    riskTags: toArray(gift.riskTags).map((tag) => cleanText(tag, 12)).filter(Boolean),
    pairingTags: toArray(gift.pairingTags).map((tag) => cleanText(tag, 12)).filter(Boolean),
    recommendReason: cleanText(gift.recommendReason, 80),
    score: Number(gift.score || 0),
  };
}

function buildFallbackPick(result, reason) {
  const gift = ((result && result.candidates) || [])[0] || {};
  return {
    source: "local_fallback",
    giftId: cleanText(gift.id, 60),
    giftName: cleanText(gift.name, 40) || "这款礼物",
    headline: "先选这款更稳",
    reason: reason || cleanText(gift.recommendReason, 80) || "它和当前答案匹配度最高，送礼风险也相对可控。",
    pairingText: cleanText(toArray(gift.pairingTags)[0] || toArray(result && result.pairings)[0], 40),
    tips: ["确认偏好", "看配送时间"],
  };
}

function buildPromptPayload(answers, result) {
  return {
    answers: sanitizeAnswers(answers),
    candidates: ((result && result.candidates) || [])
      .slice(0, CANDIDATE_LIMIT)
      .map(compactGift),
  };
}

function sanitizeAnswers(answers) {
  const source = answers && typeof answers === "object" && !Array.isArray(answers) ? answers : {};
  return Object.keys(source).reduce((result, key) => {
    if (key === "_custom") return result;
    const value = source[key];
    if (Array.isArray(value)) {
      result[key] = value.map((item) => cleanText(item, 40)).filter(Boolean).slice(0, 4);
    } else {
      const text = cleanText(value, 40);
      if (text) result[key] = text;
    }
    return result;
  }, {});
}

function buildMessages(payload) {
  return [
    {
      role: "system",
      content:
        "你是一个谨慎的送礼决策助手。只能从候选礼物中挑 1 个，不要编造新礼物。必须输出 JSON 对象，字段为 giftId、headline、reason、pairingText、tips。tips 是 1 到 3 个短中文字符串。",
    },
    {
      role: "user",
      content: JSON.stringify(payload),
    },
  ];
}

function parseModelPick(content) {
  const text = cleanText(String(content || "").replace(/^```json\s*|\s*```$/g, ""), 2000);
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    return {};
  }
}

function normalizeModelPick(rawPick, result) {
  const candidates = (result && result.candidates) || [];
  const candidateIds = new Set(candidates.map((gift) => String(gift.id)));
  const giftId = cleanText(rawPick.giftId || rawPick.id, 60);
  if (!giftId || !candidateIds.has(giftId)) {
    return buildFallbackPick(result, "AI 返回的选择不在候选里，已先保留当前最稳的一款。");
  }

  const gift = candidates.find((item) => String(item.id) === giftId) || {};
  return {
    source: "deepseek",
    giftId,
    giftName: cleanText(gift.name, 40),
    headline: cleanText(rawPick.headline, 30) || "AI更推荐这款",
    reason: cleanText(rawPick.reason, 120) || cleanText(gift.recommendReason, 80),
    pairingText: cleanText(rawPick.pairingText, 40),
    tips: toArray(rawPick.tips).map((tip) => cleanText(tip, 12)).filter(Boolean).slice(0, 3),
  };
}

async function pickGiftWithAI({ answers, result }) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return buildFallbackPick(result, "DeepSeek API Key 还没有配置，先按当前匹配结果帮你挑一款。");
  }

  try {
    const model = process.env.DEEPSEEK_MODEL || DEFAULT_MODEL;
    const payload = buildPromptPayload(answers, result);
    const response = await requestDeepSeek({
      apiKey,
      baseUrl: process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL,
      body: {
        model,
        messages: buildMessages(payload),
        response_format: { type: "json_object" },
        thinking: { type: "disabled" },
        temperature: 0.3,
        max_tokens: 500,
        stream: false,
      },
    });
    const content = response && response.choices && response.choices[0]
      && response.choices[0].message
      && response.choices[0].message.content;
    return normalizeModelPick(parseModelPick(content), result);
  } catch (error) {
    console.error("DeepSeek aiPick failed", {
      message: error && error.message,
      statusCode: error && error.statusCode,
    });
    return buildFallbackPick(result, "AI 服务暂时没有返回，先按当前匹配结果帮你挑一款。");
  }
}

function requestDeepSeek({ apiKey, baseUrl, body }) {
  return new Promise((resolve, reject) => {
    const url = new URL("/chat/completions", baseUrl);
    const data = JSON.stringify(body);
    const req = https.request(
      {
        method: "POST",
        hostname: url.hostname,
        path: url.pathname,
        protocol: url.protocol,
        port: url.port || 443,
        timeout: Number(process.env.DEEPSEEK_TIMEOUT_MS || 10000),
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
          Authorization: `Bearer ${apiKey}`,
        },
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          let parsed = {};
          try {
            parsed = raw ? JSON.parse(raw) : {};
          } catch (error) {
            parsed = {};
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            const err = new Error("DeepSeek request failed");
            err.statusCode = res.statusCode;
            err.response = parsed;
            reject(err);
            return;
          }
          resolve(parsed);
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("DeepSeek request timed out"));
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

module.exports = {
  buildFallbackPick,
  pickGiftWithAI,
};
