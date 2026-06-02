"use strict";

const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { STATUS, SOURCE } = require("./store");
const { buildExport, writeExport, previewExport, renderRuntime } = require("./export");

const NOW = "2026-06-03T00:00:00.000Z";

function rec(id, status, extra = {}) {
  return {
    _status: status,
    _source: SOURCE.DEEPSEEK,
    _note: "n",
    _updatedAt: NOW,
    id,
    name: "测试礼物",
    category: "beauty_personal_care",
    target: ["partner"],
    scene: ["birthday"],
    budget: ["200_500"],
    recommendReason: "用于导出测试的合法推荐理由文案。",
    ...extra,
  };
}

let tmpDir;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "songleme-export-"));
});
afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

test("只导出 approved；pending/rejected 不进", () => {
  const all = [
    rec("a", STATUS.APPROVED),
    rec("b", STATUS.PENDING),
    rec("c", STATUS.REJECTED),
    rec("d", STATUS.APPROVED),
  ];
  const { approved, source } = buildExport(all);
  assert.equal(approved.length, 2);
  assert.ok(source.includes('"a"'));
  assert.ok(source.includes('"d"'));
  assert.ok(!source.includes('"b"'));
  assert.ok(!source.includes('"c"'));
});

test("导出剥离所有 _* 元字段", () => {
  const res = writeExport([rec("a", STATUS.APPROVED)], tmpDir);
  delete require.cache[require.resolve(res.clientPath)];
  const { GIFT_DIRECTIONS } = require(res.clientPath);
  for (const d of GIFT_DIRECTIONS) {
    assert.ok(
      Object.keys(d).every((k) => !k.startsWith("_")),
      `导出记录不应含 _* 字段：${Object.keys(d)}`
    );
  }
});

test("client / server 两份逐字节一致", () => {
  const all = [rec("a", STATUS.APPROVED), rec("d", STATUS.APPROVED)];
  const res = writeExport(all, tmpDir);
  const client = fs.readFileSync(res.clientPath);
  const server = fs.readFileSync(res.serverPath);
  assert.ok(client.equals(server), "两份产物应逐字节一致");
  assert.equal(res.count, 2);
});

test("导出产物是合法的可 require 的 JS，含 GIFT_DIRECTIONS", () => {
  const all = [rec("a", STATUS.APPROVED)];
  const res = writeExport(all, tmpDir);
  delete require.cache[require.resolve(res.clientPath)];
  const mod = require(res.clientPath);
  assert.ok(Array.isArray(mod.GIFT_DIRECTIONS));
  assert.equal(mod.GIFT_DIRECTIONS[0].id, "a");
  assert.equal(mod.GIFT_DIRECTIONS[0]._status, undefined);
});

test("approved 但不合法（旧 budget 枚举）→ 默认拒绝导出", () => {
  const all = [rec("bad", STATUS.APPROVED, { budget: ["100_300"] })];
  assert.throws(() => writeExport(all, tmpDir), /未通过 schema 校验/);
});

test("previewExport 首次无旧文件 → changed=true；写后再 preview → changed=false", () => {
  const all = [rec("a", STATUS.APPROVED)];
  assert.equal(previewExport(all, tmpDir).changed, true);
  writeExport(all, tmpDir);
  assert.equal(previewExport(all, tmpDir).changed, false);
});

test("renderRuntime 输出稳定（同输入同字节）", () => {
  const all = [rec("a", STATUS.APPROVED), rec("d", STATUS.APPROVED)];
  assert.equal(renderRuntime(all), renderRuntime(all));
});
