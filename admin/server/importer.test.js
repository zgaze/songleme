"use strict";

const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { Store, STATUS, SOURCE } = require("./store");
const { mergeImport, importFromFile, extractGifts } = require("./importer");

const NOW = "2026-06-03T00:00:00.000Z";
const SEED_PATH = path.resolve(__dirname, "../../data/generated-gifts-deepseek-20260601-105159.json");

let tmpDir;
let store;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "songleme-import-"));
  store = new Store(path.join(tmpDir, "directions.json"));
});
afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

function g(id, name) {
  return { id, name, category: "beauty_personal_care", target: ["partner"], scene: ["birthday"], budget: ["200_500"], recommendReason: "测试理由文案占位。" };
}

test("extractGifts 兼容 {gifts} 包裹", () => {
  assert.equal(extractGifts({ gifts: [g("a", "甲")] }).length, 1);
  assert.equal(extractGifts([g("a", "甲")]).length, 1);
  assert.throws(() => extractGifts({ nope: 1 }), /找到 gifts 数组/);
});

test("mergeImport 标记 _source=deepseek / _status=pending", () => {
  const { merged, added } = mergeImport([], [g("a", "甲")], NOW);
  assert.equal(added, 1);
  assert.equal(merged[0]._source, SOURCE.DEEPSEEK);
  assert.equal(merged[0]._status, STATUS.PENDING);
});

test("去重：同 id 不重复入库", () => {
  const existing = mergeImport([], [g("a", "甲")], NOW).merged;
  const { added, skipped } = mergeImport(existing, [g("a", "另一个名")], NOW);
  assert.equal(added, 0);
  assert.equal(skipped, 1);
});

test("去重：同 name 不重复入库", () => {
  const existing = mergeImport([], [g("a", "口红礼盒")], NOW).merged;
  const { added, skipped } = mergeImport(existing, [g("b", "口红礼盒")], NOW);
  assert.equal(added, 0);
  assert.equal(skipped, 1);
});

test("去重：同一批内部重复只入一条", () => {
  const { merged, added } = mergeImport([], [g("a", "甲"), g("a", "甲再来")], NOW);
  assert.equal(added, 1);
  assert.equal(merged.length, 1);
});

test("importFromFile 导入真实种子 80 条，全部 pending/deepseek", () => {
  const res = importFromFile(store, SEED_PATH, NOW);
  assert.equal(res.added, 80, "种子应为 80 条");
  assert.equal(res.total, 80);
  assert.equal(store.count(), 80);
  const all = store.list();
  assert.ok(all.every((it) => it._status === STATUS.PENDING));
  assert.ok(all.every((it) => it._source === SOURCE.DEEPSEEK));
});

test("importFromFile 二次导入同文件：0 新增（幂等去重）", () => {
  importFromFile(store, SEED_PATH, NOW);
  const res2 = importFromFile(store, SEED_PATH, NOW);
  assert.equal(res2.added, 0);
  assert.equal(res2.skipped, 80);
  assert.equal(store.count(), 80);
});
