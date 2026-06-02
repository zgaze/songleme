const { GIFT_DIRECTIONS } = require("./giftDirections");

const RESULT_LIMIT = 24;

const ANSWER_OPTIONS = {
  target: ["partner", "parents", "bestie"],
  gender: ["female", "male"],
  scene: ["birthday", "anniversary", "festival", "apology", "daily"],
  occupation: ["office", "tech", "creative", "medical_education", "student", "freelance", "homemaker"],
  recipientStyle: ["practical", "aesthetic", "experiential", "quality"],
  budget: ["under_200", "200_500", "500_1000", "1000_2000", "2000_plus"],
  preparationTime: ["today", "tomorrow", "within_3_days", "within_7_days", "after_7_days"],
  emotionalTags: ["romantic", "company", "care", "surprise", "memory"],
  visualStyle: ["minimal", "warm", "delicate", "tech", "classic"],
};

const VALUE_ALIASES = {
  budget: {
    under_100: ["under_200"],
    "100_300": ["under_200", "200_500"],
    "300_800": ["200_500", "500_1000"],
    "800_plus": ["500_1000", "1000_2000", "2000_plus"],
  },
};

const TARGET_LABELS = {
  partner: "恋人",
  parents: "父母",
  bestie: "闺蜜",
};

const SCENE_TONES = {
  birthday: "有仪式感但不夸张",
  anniversary: "带一点回忆和陪伴感",
  festival: "体面、好送达、不过度冒险",
  apology: "真诚、低压力、不会显得用力过猛",
  daily: "低压力、能落到日常使用",
};

const TIME_TONES = {
  today: "今天也能安排",
  tomorrow: "明天能稳妥送到",
  within_3_days: "三天内比较好落地",
  within_7_days: "一周内有准备空间",
  after_7_days: "可以提前做一点定制或组合",
};

const TAG_BY_TARGET = {
  partner: "适合恋人",
  parents: "适合父母",
  bestie: "适合朋友",
};

const TAG_BY_STYLE = {
  practical: "实用稳妥",
  aesthetic: "颜值友好",
  experiential: "体验感",
  quality: "质感高级",
  minimal: "简洁耐看",
  warm: "温柔治愈",
  delicate: "包装精美",
  tech: "科技感",
  classic: "质感高级",
};

const TAG_BY_EMOTION = {
  romantic: "浪漫表达",
  company: "陪伴感",
  care: "贴心实用",
  surprise: "有惊喜",
  memory: "纪念感",
};

function normalizeAnswers(rawAnswers) {
  const source = rawAnswers && typeof rawAnswers === "object" && !Array.isArray(rawAnswers)
    ? rawAnswers
    : {};

  return Object.keys(ANSWER_OPTIONS).reduce((answers, field) => {
    const values = normalizeValues(field, source[field]);
    if (values.length) {
      answers[field] = values;
    }
    return answers;
  }, {});
}

function normalizeValues(field, value) {
  const allowed = new Set(ANSWER_OPTIONS[field] || []);
  const aliases = VALUE_ALIASES[field] || {};
  const values = [];

  toArray(value).forEach((item) => {
    const mapped = aliases[item] || item;
    toArray(mapped).forEach((nextValue) => {
      if ((!allowed.size || allowed.has(nextValue)) && values.indexOf(nextValue) < 0) {
        values.push(nextValue);
      }
    });
  });

  return values;
}

function toArray(value) {
  if (Array.isArray(value)) return value.filter((item) => item !== undefined && item !== null);
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function includesAny(list, values) {
  if (!Array.isArray(list) || !list.length) return false;
  const normalized = toArray(values);
  return normalized.some((value) => list.indexOf(value) >= 0);
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function getGiftFieldValues(gift, field) {
  if (field === "budget") {
    return normalizeValues("budget", gift.budget || []);
  }
  if (field === "target") {
    return deriveTargets(gift);
  }
  if (field === "scene") {
    return deriveScenes(gift);
  }
  if (field === "recipientStyle") {
    return deriveRecipientStyles(gift);
  }
  if (field === "occupation") {
    return deriveOccupations(gift);
  }
  return toArray(gift[field]);
}

function deriveTargets(gift) {
  const targets = toArray(gift.target);
  const emotions = toArray(gift.emotionalTags);
  const name = gift.name || "";
  const friendSafe = targets.indexOf("partner") >= 0
    && emotions.indexOf("romantic") < 0
    && name.indexOf("情侣") < 0;

  return unique(friendSafe ? targets.concat("bestie") : targets);
}

function deriveScenes(gift) {
  const scenes = toArray(gift.scene);
  const emotions = toArray(gift.emotionalTags);
  const apologySafe = emotions.some((tag) => ["care", "company", "memory"].indexOf(tag) >= 0)
    && emotions.indexOf("romantic") < 0;

  return unique(apologySafe ? scenes.concat("apology") : scenes);
}

function deriveRecipientStyles(gift) {
  const styles = [];
  const name = gift.name || "";
  const visualStyle = toArray(gift.visualStyle);
  const emotions = toArray(gift.emotionalTags);
  const budget = normalizeValues("budget", gift.budget || []);

  if (emotions.indexOf("care") >= 0 || includesAny(visualStyle, ["minimal", "tech"])) {
    styles.push("practical");
  }
  if (includesAny(visualStyle, ["warm", "delicate", "classic"])) {
    styles.push("aesthetic");
  }
  if (name.indexOf("体验") >= 0 || name.indexOf("餐厅") >= 0 || name.indexOf("拍立得") >= 0) {
    styles.push("experiential");
  }
  if (includesAny(visualStyle, ["classic", "delicate", "tech"]) || includesAny(budget, ["500_1000", "1000_2000", "2000_plus"])) {
    styles.push("quality");
  }

  return unique(styles);
}

function deriveOccupations(gift) {
  const occupations = [];
  const name = gift.name || "";
  const visualStyle = toArray(gift.visualStyle);
  const targets = toArray(gift.target);
  const styles = deriveRecipientStyles(gift);

  if (visualStyle.indexOf("tech") >= 0 || /数字|智能|电子|相机/.test(name)) {
    occupations.push("tech");
  }
  if (/咖啡|桌面|按摩|眼罩|钢笔|收纳/.test(name) || styles.indexOf("practical") >= 0) {
    occupations.push("office");
  }
  if (/照片|手作|装饰|香氛|香水|拍立得|画/.test(name) || styles.indexOf("aesthetic") >= 0) {
    occupations.push("creative");
  }
  if (styles.indexOf("practical") >= 0 && targets.indexOf("parents") >= 0) {
    occupations.push("medical_education", "homemaker");
  }
  if (includesAny(normalizeValues("budget", gift.budget || []), ["under_200", "200_500"])) {
    occupations.push("student");
  }
  if (styles.indexOf("experiential") >= 0 || styles.indexOf("quality") >= 0) {
    occupations.push("freelance");
  }

  return unique(occupations);
}

function scoreGift(gift, answers) {
  let score = 0;

  if (includesAny(getGiftFieldValues(gift, "target"), answers.target)) score += 22;
  if (includesAny(getGiftFieldValues(gift, "budget"), answers.budget)) score += 18;
  if (includesAny(getGiftFieldValues(gift, "scene"), answers.scene)) score += 16;
  if (includesAny(getGiftFieldValues(gift, "recipientStyle"), answers.recipientStyle)) score += 12;
  if (includesAny(getGiftFieldValues(gift, "emotionalTags"), answers.emotionalTags)) score += 10;
  if (includesAny(getGiftFieldValues(gift, "visualStyle"), answers.visualStyle)) score += 8;
  if (includesAny(getGiftFieldValues(gift, "preparationTime"), answers.preparationTime)) score += 8;
  if (includesAny(getGiftFieldValues(gift, "occupation"), answers.occupation)) score += 6;
  if (includesAny(getGiftFieldValues(gift, "gender"), answers.gender)) score += 3;

  return score;
}

function mergeCandidates(primary, fallback, limit) {
  const seen = {};
  const merged = [];

  primary.concat(fallback).forEach((gift) => {
    if (seen[gift.id]) return;
    seen[gift.id] = true;
    merged.push(gift);
  });

  return merged.slice(0, limit);
}

function firstAnswer(value) {
  return Array.isArray(value) ? value[0] : value;
}

function buildSummary(answers = {}) {
  const target = TARGET_LABELS[firstAnswer(answers.target)] || "对方";
  const sceneTone = SCENE_TONES[firstAnswer(answers.scene)] || "有心意、好理解";
  const timeTone = TIME_TONES[firstAnswer(answers.preparationTime)] || "送达节奏也比较稳";

  return `给${target}的这次礼物，更适合选${sceneTone}、${timeTone}的方向。`;
}

function buildBoundaryNote(answers = {}) {
  const notes = [];

  if (answers.budget) notes.push("预算跨度");
  if (answers.target) notes.push("关系边界");
  if (answers.preparationTime) notes.push("准备周期");

  if (!notes.length) return "";
  return `已优先避开${notes.join("、")}不匹配的选择。`;
}

function buildPairings(answers = {}, candidates = []) {
  const pairings = [];
  const target = firstAnswer(answers.target);
  const scene = firstAnswer(answers.scene);

  if (target === "partner") pairings.push("鲜花", "手写卡片");
  if (target === "parents") pairings.push("祝福卡片", "水果");
  if (target === "bestie") pairings.push("小卡片", "甜品");
  if (scene === "birthday" || scene === "anniversary") pairings.push("照片", "晚餐");
  if (scene === "apology") pairings.push("真诚道歉卡片", "轻量甜品");

  candidates.forEach((gift) => {
    (gift.pairingTags || []).forEach((tag) => pairings.push(tag));
  });

  return Array.from(new Set(pairings)).slice(0, 3);
}

function buildGiftTags(gift, answers = {}) {
  const tags = [];
  const target = firstAnswer(answers.target);
  const recipientStyle = firstAnswer(answers.recipientStyle);
  const visualStyle = firstAnswer(answers.visualStyle);

  if (TAG_BY_TARGET[target] && includesAny(getGiftFieldValues(gift, "target"), target)) {
    tags.push(TAG_BY_TARGET[target]);
  }
  if (TAG_BY_STYLE[recipientStyle] && includesAny(getGiftFieldValues(gift, "recipientStyle"), recipientStyle)) {
    tags.push(TAG_BY_STYLE[recipientStyle]);
  }
  if (TAG_BY_STYLE[visualStyle] && includesAny(getGiftFieldValues(gift, "visualStyle"), visualStyle)) {
    tags.push(TAG_BY_STYLE[visualStyle]);
  }

  toArray(answers.emotionalTags).forEach((tag) => {
    if (TAG_BY_EMOTION[tag] && includesAny(getGiftFieldValues(gift, "emotionalTags"), tag)) {
      tags.push(TAG_BY_EMOTION[tag]);
    }
  });
  (gift.highlights || []).forEach((tag) => tags.push(tag));

  return Array.from(new Set(tags)).slice(0, 3);
}

function hardFilter(gift, answers) {
  if (answers.target && !includesAny(getGiftFieldValues(gift, "target"), answers.target)) return false;
  if (answers.budget && !includesAny(getGiftFieldValues(gift, "budget"), answers.budget)) return false;
  if (answers.preparationTime && !includesAny(getGiftFieldValues(gift, "preparationTime"), answers.preparationTime)) return false;
  return true;
}

function rankGifts(gifts, answers) {
  return gifts
    .map((gift, index) => ({
      ...gift,
      score: scoreGift(gift, answers),
      _rankIndex: index,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a._rankIndex - b._rankIndex;
    });
}

function stripInternalFields(gift) {
  const { _rankIndex, ...publicGift } = gift;
  return publicGift;
}

function recommendLocally(rawAnswers) {
  const answers = normalizeAnswers(rawAnswers);
  const ranked = rankGifts(GIFT_DIRECTIONS, answers);
  const matched = rankGifts(GIFT_DIRECTIONS.filter((gift) => hardFilter(gift, answers)), answers);
  const candidates = mergeCandidates(matched, ranked, RESULT_LIMIT).map((gift) => ({
    ...stripInternalFields(gift),
    tags: buildGiftTags(gift, answers),
  }));

  return {
    summary: buildSummary(answers),
    boundaryNote: buildBoundaryNote(answers),
    candidates,
    pairings: buildPairings(answers, candidates),
  };
}

module.exports = {
  recommendLocally,
  normalizeAnswers,
};
