"use strict";

/**
 * 导入 data/generated-gifts-*.json（AI 生成产物）进 catalog。
 *
 * - 落库标记 _source=deepseek、_status=pending。
 * - 去重：按 id 优先，其次按 name（name_key）。catalog 已存在的不重复入库。
 * - 同一批内部也去重（同名/同 id 只取第一条）。
 * - 纯函数 mergeImport 便于测试；importFromFile 负责读文件 + 落盘。
 */

const fs = require("fs");
const { STATUS, SOURCE } = require("./store");

/** 从生成文件里取出 gifts 数组（兼容裸数组 / {gifts} / {directions} / {data}） */
function extractGifts(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.gifts)) return parsed.gifts;
  if (parsed && Array.isArray(parsed.directions)) return parsed.directions;
  if (parsed && Array.isArray(parsed.data)) return parsed.data;
  throw new Error("无法在文件中找到 gifts 数组（支持 [] / {gifts} / {directions} / {data}）");
}

const nameKey = (g) => (g.name || "").trim().toLowerCase();

/**
 * 把 incoming 合并进 existing。返回 { merged, added, skipped }。
 * 不修改入参。
 * @param {object[]} existing 现有 catalog（带 _* 元字段）
 * @param {object[]} incoming 待导入的纯 v3 对象
 * @param {string} now ISO 时间戳
 */
function mergeImport(existing, incoming, now = new Date().toISOString()) {
  const seenId = new Set(existing.map((g) => g.id).filter(Boolean));
  const seenName = new Set(existing.map(nameKey).filter(Boolean));
  const merged = existing.slice();
  let added = 0;
  let skipped = 0;

  for (const raw of incoming) {
    const id = raw.id;
    const nk = nameKey(raw);
    if ((id && seenId.has(id)) || (nk && seenName.has(nk))) {
      skipped += 1;
      continue;
    }
    if (id) seenId.add(id);
    if (nk) seenName.add(nk);
    merged.push({
      _status: STATUS.PENDING,
      _source: SOURCE.DEEPSEEK,
      _note: "",
      ...raw,
      _updatedAt: now,
    });
    added += 1;
  }
  return { merged, added, skipped };
}

/**
 * 从文件导入到 store。
 * @param {import('./store').Store} store
 * @param {string} filePath 生成文件路径
 * @param {string} [now]
 * @returns {{ added: number, skipped: number, total: number }}
 */
function importFromFile(store, filePath, now = new Date().toISOString()) {
  if (!fs.existsSync(filePath)) throw new Error(`导入文件不存在：${filePath}`);
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const gifts = extractGifts(parsed);
  const existing = store.list();
  const { merged, added, skipped } = mergeImport(existing, gifts, now);
  store.replaceAll(merged);
  return { added, skipped, total: merged.length };
}

module.exports = { extractGifts, mergeImport, importFromFile, nameKey };
