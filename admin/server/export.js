"use strict";

/**
 * 导出：catalog 里 _status=approved 的方向 → 运行时 giftDirections.js（client + server 两份）。
 *
 * 关键约束：
 * - 只导出 approved；pending / rejected 不进。
 * - 剥离所有 _* 管理元字段（schema.stripMeta）。
 * - client / server 两份**逐字节一致**——同一字符串写两处，杜绝漂移。
 * - 字段顺序按 schema 属性顺序归一，保证导出稳定可 diff。
 * - 产物默认写进 admin/dist/{client,server}/giftDirections.js。
 *   （硬约束：不碰 miniprogram 构建；同步到运行时/CloudBase 是事后人工步骤。）
 */

const fs = require("fs");
const path = require("path");
const { validate, stripMeta, loadSchema } = require("./schema");
const { STATUS } = require("./store");

const DEFAULT_OUT_DIR = path.resolve(__dirname, "../dist");

/** 按 schema 中 properties 的声明顺序重排字段，去掉 undefined。稳定输出。 */
function orderFields(obj) {
  const order = Object.keys(loadSchema().properties);
  const out = {};
  for (const key of order) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

/**
 * 把 approved 记录数组渲染成运行时 JS 源码字符串。
 * 形如：const GIFT_DIRECTIONS = [...]; module.exports = { GIFT_DIRECTIONS };
 */
function renderRuntime(approvedRecords) {
  const clean = approvedRecords.map((r) => orderFields(stripMeta(r)));
  const json = JSON.stringify(clean, null, 2);
  return (
    "// 自动生成，请勿手改。由 songleme-admin 导出（catalog 中 _status=approved 的方向）。\n" +
    "// 字段契约：schemas/gift-direction.schema.json（v3）。\n" +
    `const GIFT_DIRECTIONS = ${json};\n\n` +
    "module.exports = {\n  GIFT_DIRECTIONS,\n};\n"
  );
}

/**
 * 计算导出内容 + 对每条做 schema 校验（保险：approved 的也应合法）。
 * @param {object[]} allRecords 整个 catalog
 * @returns {{ source: string, approved: object[], invalid: {id:string, errors:string[]}[] }}
 */
function buildExport(allRecords) {
  const approved = allRecords.filter((r) => r._status === STATUS.APPROVED);
  const invalid = [];
  for (const r of approved) {
    const { valid, errors } = validate(stripMeta(r));
    if (!valid) invalid.push({ id: r.id, errors });
  }
  const source = renderRuntime(approved);
  return { source, approved, invalid };
}

/**
 * 导出前的 diff 预览：对比磁盘上已存在的产物与即将写入的内容。
 * @returns {{ changed: boolean, oldSource: string|null, newSource: string }}
 */
function previewExport(allRecords, outDir = DEFAULT_OUT_DIR) {
  const { source } = buildExport(allRecords);
  const clientPath = path.join(outDir, "client", "giftDirections.js");
  const oldSource = fs.existsSync(clientPath) ? fs.readFileSync(clientPath, "utf8") : null;
  return { changed: oldSource !== source, oldSource, newSource: source };
}

/**
 * 真正落盘：写 client + server 两份逐字节一致的 giftDirections.js。
 * 若有 approved 记录不合法，默认拒绝导出（除非 opts.force）。
 * @returns {{ count:number, clientPath:string, serverPath:string, bytes:number, invalid:object[] }}
 */
function writeExport(allRecords, outDir = DEFAULT_OUT_DIR, opts = {}) {
  const { source, approved, invalid } = buildExport(allRecords);
  if (invalid.length && !opts.force) {
    const err = new Error(`导出中止：${invalid.length} 条 approved 记录未通过 schema 校验`);
    err.invalid = invalid;
    throw err;
  }
  const clientDir = path.join(outDir, "client");
  const serverDir = path.join(outDir, "server");
  fs.mkdirSync(clientDir, { recursive: true });
  fs.mkdirSync(serverDir, { recursive: true });
  const clientPath = path.join(clientDir, "giftDirections.js");
  const serverPath = path.join(serverDir, "giftDirections.js");
  fs.writeFileSync(clientPath, source, "utf8");
  fs.writeFileSync(serverPath, source, "utf8");
  return {
    count: approved.length,
    clientPath,
    serverPath,
    bytes: Buffer.byteLength(source, "utf8"),
    invalid,
  };
}

module.exports = {
  DEFAULT_OUT_DIR,
  renderRuntime,
  orderFields,
  buildExport,
  previewExport,
  writeExport,
};
