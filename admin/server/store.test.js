"use strict";

const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { Store, STATUS, SOURCE } = require("./store");

let tmpDir;
let store;
const NOW = "2026-06-03T00:00:00.000Z";

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "songleme-store-"));
  store = new Store(path.join(tmpDir, "directions.json"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function gift(id, extra = {}) {
  return {
    id,
    name: "测试礼物",
    category: "beauty_personal_care",
    target: ["partner"],
    scene: ["birthday"],
    budget: ["200_500"],
    recommendReason: "用于单元测试的合法方向。",
    ...extra,
  };
}

test("空 catalog 起步：count=0, list=[]", () => {
  assert.equal(store.count(), 0);
  assert.deepEqual(store.list(), []);
});

test("create 落盘 + 默认元字段", () => {
  const rec = store.create(gift("a-gift"), NOW);
  assert.equal(rec._status, STATUS.PENDING);
  assert.equal(rec._source, SOURCE.MANUAL);
  assert.equal(rec._updatedAt, NOW);
  assert.equal(store.count(), 1);
  // 真的写进文件了
  const onDisk = JSON.parse(fs.readFileSync(store.filePath, "utf8"));
  assert.equal(onDisk[0].id, "a-gift");
});

test("create 重复 id 抛错", () => {
  store.create(gift("dup"), NOW);
  assert.throws(() => store.create(gift("dup"), NOW), /已存在/);
});

test("update 合并字段并刷新 _updatedAt，不可改 id", () => {
  store.create(gift("x"), NOW);
  const updated = store.update("x", { name: "改了名", id: "hacked" }, "2026-06-04T00:00:00.000Z");
  assert.equal(updated.name, "改了名");
  assert.equal(updated.id, "x", "id 不可被 patch 改写");
  assert.equal(updated._updatedAt, "2026-06-04T00:00:00.000Z");
  assert.equal(store.get("x").name, "改了名");
});

test("update 不存在的 id 抛错", () => {
  assert.throws(() => store.update("nope", { name: "y" }), /未找到/);
});

test("setStatus: approve / reject + note", () => {
  store.create(gift("s"), NOW);
  store.setStatus("s", STATUS.APPROVED, "审核通过", NOW);
  assert.equal(store.get("s")._status, STATUS.APPROVED);
  assert.equal(store.get("s")._note, "审核通过");
  store.setStatus("s", STATUS.REJECTED, undefined, NOW);
  assert.equal(store.get("s")._status, STATUS.REJECTED);
  assert.equal(store.get("s")._note, "审核通过", "未传 note 时保留原备注");
});

test("setStatus 非法状态抛错", () => {
  store.create(gift("s2"), NOW);
  assert.throws(() => store.setStatus("s2", "weird", undefined, NOW), /非法状态/);
});

test("remove 删除后 count 减少", () => {
  store.create(gift("r"), NOW);
  assert.equal(store.remove("r"), true);
  assert.equal(store.count(), 0);
  assert.equal(store.remove("r"), false, "再删返回 false");
});

test("list 筛选：category / _status / target / scene / q", () => {
  store.create(gift("g1", { name: "口红礼盒", category: "beauty_personal_care", target: ["partner"], scene: ["birthday"] }), NOW);
  store.create(gift("g2", { name: "机械键盘", category: "digital_accessories", target: ["bestie"], scene: ["daily"] }), NOW);
  store.setStatus("g1", STATUS.APPROVED, undefined, NOW);

  assert.equal(store.list({ category: "digital_accessories" }).length, 1);
  assert.equal(store.list({ _status: STATUS.APPROVED }).length, 1);
  assert.equal(store.list({ _status: STATUS.APPROVED })[0].id, "g1");
  assert.equal(store.list({ target: "bestie" }).length, 1);
  assert.equal(store.list({ scene: "daily" })[0].id, "g2");
  assert.equal(store.list({ q: "键盘" }).length, 1);
  assert.equal(store.list({ q: "礼盒" })[0].id, "g1");
  // 组合筛选
  assert.equal(store.list({ category: "beauty_personal_care", _status: STATUS.APPROVED }).length, 1);
  assert.equal(store.list({ category: "beauty_personal_care", _status: STATUS.PENDING }).length, 0);
});

test("replaceAll 整表覆写", () => {
  store.replaceAll([gift("a"), gift("b")].map((g) => ({ ...g, _status: STATUS.PENDING })));
  assert.equal(store.count(), 2);
});
