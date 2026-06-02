"use strict";

const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createApp } = require("./app");
const { Store, STATUS } = require("./store");

const SEED_PATH = path.resolve(__dirname, "../../data/generated-gifts-deepseek-20260601-105159.json");

let server;
let base;
let tmpDir;
let store;
let outDir;

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "songleme-api-"));
  store = new Store(path.join(tmpDir, "directions.json"));
  outDir = path.join(tmpDir, "dist");
  server = http.createServer(createApp({ store, outDir, seedFile: SEED_PATH }));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((r) => server.close(r));
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  store.replaceAll([]); // 每个用例从空 catalog 起
});

async function api(method, p, body) {
  const res = await fetch(base + p, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

function legal(id) {
  return {
    id,
    name: "口红礼盒",
    category: "beauty_personal_care",
    target: ["partner"],
    scene: ["birthday"],
    budget: ["200_500"],
    recommendReason: "包装体面有仪式感，适合表达用心。",
  };
}

test("GET /api/health", async () => {
  const { status, body } = await api("GET", "/api/health");
  assert.equal(status, 200);
  assert.equal(body.ok, true);
});

test("GET /api/schema 返回表单元信息", async () => {
  const { status, body } = await api("GET", "/api/schema");
  assert.equal(status, 200);
  assert.ok(body.form.fields.length > 0);
  assert.ok(body.schema.properties.budget);
});

test("POST /api/directions 合法 → 201；非法枚举 → 400 不写入", async () => {
  const ok = await api("POST", "/api/directions", legal("api-a"));
  assert.equal(ok.status, 201);
  assert.equal(ok.body._status, STATUS.PENDING);

  const bad = await api("POST", "/api/directions", { ...legal("api-bad"), budget: ["100_300"] });
  assert.equal(bad.status, 400);
  assert.ok(bad.body.errors.some((e) => e.includes("100_300")));
  // 没写进库
  assert.equal((await api("GET", "/api/directions/api-bad")).status, 404);
});

test("romantic + apology 被 API 拒绝", async () => {
  const bad = await api("POST", "/api/directions", {
    ...legal("api-ra"),
    toneFit: ["romantic"],
    scene: ["apology"],
  });
  assert.equal(bad.status, 400);
});

test("PUT 更新合法保存；非法被拦", async () => {
  await api("POST", "/api/directions", legal("api-u"));
  const ok = await api("PUT", "/api/directions/api-u", { name: "新名字" });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.name, "新名字");

  const bad = await api("PUT", "/api/directions/api-u", { category: "not_real" });
  assert.equal(bad.status, 400);
  // 库里仍是旧的合法值
  assert.equal((await api("GET", "/api/directions/api-u")).body.category, "beauty_personal_care");
});

test("审核 + 列表筛选 + 导出全链路", async () => {
  await api("POST", "/api/directions", legal("api-x"));
  await api("POST", "/api/directions", legal2("api-y"));
  await api("POST", "/api/directions/api-x/status", { status: STATUS.APPROVED, note: "ok" });
  await api("POST", "/api/directions/api-y/status", { status: STATUS.REJECTED });

  const approved = await api("GET", "/api/directions?_status=approved");
  assert.equal(approved.body.total, 1);
  assert.equal(approved.body.items[0].id, "api-x");

  const exp = await api("POST", "/api/export");
  assert.equal(exp.status, 200);
  assert.equal(exp.body.count, 1, "只导出 approved 的一条");
  const client = fs.readFileSync(exp.body.clientPath);
  const srv = fs.readFileSync(exp.body.serverPath);
  assert.ok(client.equals(srv), "两份逐字节一致");
});

test("POST /api/import 导入种子 80 条且均 pending", async () => {
  const { status, body } = await api("POST", "/api/import", {});
  assert.equal(status, 200);
  assert.equal(body.added, 80);
  const all = await api("GET", "/api/directions?_status=pending");
  assert.equal(all.body.total, 80);
});

test("批量审核", async () => {
  await api("POST", "/api/directions", legal("b1"));
  await api("POST", "/api/directions", legal2("b2"));
  const r = await api("POST", "/api/directions/status", { ids: ["b1", "b2"], status: STATUS.APPROVED });
  assert.equal(r.body.updated, 2);
});

function legal2(id) {
  return { ...legal(id), name: "机械键盘", category: "digital_accessories", target: ["bestie"], scene: ["daily"] };
}
