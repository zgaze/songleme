/**
 * recipientRepo —— 联系人（收礼人档案）存储抽象层（master C8）
 *
 * 所有联系人读写都经过本模块。对外接口 Promise 化（便于日后换异步云后端，
 * 页面零改动）；本迭代 backend 为本地存储（key `songleme:recipients`，存整数组）。
 * 字段清洗（master C1）在 repo 内完成，页面不重复校验。
 *
 * DB 切换点：上线前换库 = 新增一个实现这 5 个 Promise 方法的 backend 模块
 * （如 recipientRepo.cloud.js，内部可调 manageRecipientProfile 云函数），
 * 把本文件的 module.exports 改成转发到该 backend。pages/contacts /
 * pages/contactEdit / 主页选择器代码零改动。
 */

const STORAGE_KEY = "songleme:recipients";

const ALLOWED_TARGETS = new Set(["partner", "parents", "bestie"]);
const ALLOWED_GENDERS = new Set(["female", "male"]);
const ALLOWED_OCCUPATIONS = new Set([
  "office",
  "tech",
  "creative",
  "medical_education",
  "student",
  "freelance",
  "homemaker",
]);
const ALLOWED_STYLES = new Set([
  "practical",
  "aesthetic",
  "experiential",
  "quality",
]);
const ALLOWED_PERSONA_TAGS = new Set([
  "tech_geek",
  "office_pro",
  "creative",
  "student",
  "night_owl",
  "homebody",
  "outdoorsy",
  "fitness",
  "coffee_tea",
  "foodie",
  "pet_owner",
  "beauty_lover",
  "fandom_gamer",
  "bookish",
]);
const MAX_PERSONA_TAGS = 5;

// ---- 清洗工具（移植自云函数；逻辑等价于 cleanText/cleanEnum/createId）----

function cleanText(value, maxLength) {
  return String(value || "")
    .trim()
    .slice(0, maxLength);
}

function cleanEnum(value, allowed) {
  const text = cleanText(value, 80);
  return allowed.has(text) ? text : "";
}

// personaTags：按枚举过滤、去重、保持传入顺序、截到 maxItems、非数组返回 []
function cleanEnumArray(value, allowed, maxItems) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const result = [];
  for (const raw of value) {
    const text = cleanText(raw, 80);
    if (allowed.has(text) && !seen.has(text)) {
      seen.add(text);
      result.push(text);
      if (result.length >= maxItems) break;
    }
  }
  return result;
}

function createId() {
  const rand = Math.random().toString(36).slice(2, 8);
  return `rp_${Date.now()}_${rand}`;
}

// 返回只含「白名单内、清洗后非空」字段的对象；personaTags 例外见下。
function cleanRecipient(input) {
  const result = {};
  const nickname = cleanText(input.nickname, 30);
  const target = cleanEnum(input.target, ALLOWED_TARGETS);
  const gender = cleanEnum(input.gender, ALLOWED_GENDERS);
  const occupation = cleanEnum(input.occupation, ALLOWED_OCCUPATIONS);
  const recipientStyle = cleanEnum(input.recipientStyle, ALLOWED_STYLES);
  const notes = cleanText(input.notes, 200);

  if (nickname) result.nickname = nickname;
  if (target) result.target = target;
  if (gender) result.gender = gender;
  if (occupation) result.occupation = occupation;
  if (recipientStyle) result.recipientStyle = recipientStyle;
  if (notes) result.notes = notes;

  // personaTags：仅当 input 显式带该 key 时才写入，允许写空数组（用户清空全部 tag）。
  // 未带该 key 时不动（保持 update「只更新传入字段」语义，与既有云函数一致）。
  if (Object.prototype.hasOwnProperty.call(input, "personaTags")) {
    result.personaTags = cleanEnumArray(
      input.personaTags,
      ALLOWED_PERSONA_TAGS,
      MAX_PERSONA_TAGS
    );
  }

  return result;
}

// ---- 本地存储读写底层 ----

function readAll() {
  const raw = wx.getStorageSync(STORAGE_KEY);
  return Array.isArray(raw) ? raw : [];
}

function writeAll(list) {
  wx.setStorageSync(STORAGE_KEY, list);
}

// ---- Promise 化接口（master C8 五个方法）----

// 1) 列表：按 updatedAt 倒序
function listRecipients() {
  try {
    const list = readAll()
      .slice()
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return Promise.resolve(list);
  } catch (err) {
    return Promise.reject(err);
  }
}

// 2) 新建：清洗 → 生成 id/时间戳 → 入数组头 → 落库；返回 { recipientId }
function createRecipient(input) {
  try {
    const now = Date.now();
    const recipient = {
      recipientId: createId(),
      ...cleanRecipient(input || {}),
      createdAt: now,
      updatedAt: now,
    };
    const list = readAll();
    list.unshift(recipient);
    writeAll(list);
    return Promise.resolve({ recipientId: recipient.recipientId });
  } catch (err) {
    return Promise.reject(err);
  }
}

// 3) 更新：清洗 patch → 合并到目标行 → 刷新 updatedAt → 落库；返回 void
function updateRecipient(recipientId, patch) {
  try {
    const id = cleanText(recipientId, 80);
    if (!id) return Promise.reject(new Error("INVALID_RECIPIENT"));
    const list = readAll();
    const idx = list.findIndex((r) => r.recipientId === id);
    if (idx < 0) return Promise.resolve(); // 已被删/不存在：静默成功（语义同云函数 updated:0）
    const update = cleanRecipient(patch || {});
    list[idx] = { ...list[idx], ...update, updatedAt: Date.now() };
    writeAll(list);
    return Promise.resolve();
  } catch (err) {
    return Promise.reject(err);
  }
}

// 4) 删除：按 id 过滤 → 落库；返回 void
function deleteRecipient(recipientId) {
  try {
    const id = cleanText(recipientId, 80);
    if (!id) return Promise.reject(new Error("INVALID_RECIPIENT"));
    const list = readAll().filter((r) => r.recipientId !== id);
    writeAll(list);
    return Promise.resolve();
  } catch (err) {
    return Promise.reject(err);
  }
}

// 5) 取单条（contactEdit 编辑态用）；不存在返回 null
function getRecipient(recipientId) {
  try {
    const id = cleanText(recipientId, 80);
    const found = readAll().find((r) => r.recipientId === id);
    return Promise.resolve(found || null);
  } catch (err) {
    return Promise.reject(err);
  }
}

module.exports = {
  listRecipients,
  createRecipient,
  updateRecipient,
  deleteRecipient,
  getRecipient,
};
