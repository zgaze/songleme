"use strict";

/**
 * HTTP API（Node 内置 http，零依赖）。createApp() 返回一个 requestListener，
 * 既可交给 http.createServer 跑 dev，也可在测试里直接挂载。
 *
 * 路由：
 *   GET    /api/health
 *   GET    /api/schema                -> { schema, form }       表单元信息
 *   GET    /api/directions?filters    -> { items, total }
 *   GET    /api/directions/:id        -> record
 *   POST   /api/directions            -> 新建（先 ajv 校验，非法 400）
 *   PUT    /api/directions/:id        -> 更新（先 ajv 校验，非法 400）
 *   DELETE /api/directions/:id        -> 删除
 *   POST   /api/directions/:id/status -> { status, note }  审核单条
 *   POST   /api/directions/status     -> { ids:[], status, note }  批量审核
 *   POST   /api/import                -> { file? }  导入种子（默认最新 deepseek 种子）
 *   POST   /api/export                -> 写两份产物 + 校验；?preview=1 只回 diff
 *   GET    /                          -> 静态 web/
 */

const fs = require("fs");
const path = require("path");
const { Store, STATUS } = require("./store");
const schema = require("./schema");
const { importFromFile } = require("./importer");
const { writeExport, previewExport, DEFAULT_OUT_DIR } = require("./export");

const WEB_DIR = path.resolve(__dirname, "../web");
const DEFAULT_SEED = path.resolve(
  __dirname,
  "../../data/generated-gifts-deepseek-20260601-105159.json"
);

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 5e6) reject(new Error("请求体过大"));
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("请求体不是合法 JSON"));
      }
    });
    req.on("error", reject);
  });
}

function serveStatic(res, urlPath) {
  let rel = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.normalize(path.join(WEB_DIR, rel));
  if (!filePath.startsWith(WEB_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return send(res, 404, { error: "Not Found" });
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  res.end(fs.readFileSync(filePath));
}

/**
 * @param {object} [opts]
 * @param {Store}  [opts.store]   注入 store（测试用临时文件）
 * @param {string} [opts.outDir]  导出目录（测试用临时目录）
 * @param {string} [opts.seedFile] 默认导入文件
 */
function createApp(opts = {}) {
  const store = opts.store || new Store();
  const outDir = opts.outDir || DEFAULT_OUT_DIR;
  const seedFile = opts.seedFile || DEFAULT_SEED;

  return async function handler(req, res) {
    const url = new URL(req.url, "http://localhost");
    const pathname = url.pathname;
    const method = req.method;

    try {
      // ---- 静态资源 ----
      if (method === "GET" && !pathname.startsWith("/api/")) {
        return serveStatic(res, pathname);
      }

      // ---- health ----
      if (method === "GET" && pathname === "/api/health") {
        return send(res, 200, { ok: true, count: store.count() });
      }

      // ---- schema / 表单元信息 ----
      if (method === "GET" && pathname === "/api/schema") {
        return send(res, 200, { schema: schema.loadSchema(), form: schema.formMeta() });
      }

      // ---- 列表 ----
      if (method === "GET" && pathname === "/api/directions") {
        const f = Object.fromEntries(url.searchParams.entries());
        const items = store.list(f);
        return send(res, 200, { items, total: items.length });
      }

      // ---- 单条 CRUD：/api/directions/:id(/status) ----
      const m = pathname.match(/^\/api\/directions\/([^/]+)(\/status)?$/);
      if (m) {
        const id = decodeURIComponent(m[1]);
        const isStatus = !!m[2];

        if (method === "GET") {
          const rec = store.get(id);
          return rec ? send(res, 200, rec) : send(res, 404, { error: "未找到" });
        }
        if (method === "POST" && isStatus) {
          const { status, note } = await readBody(req);
          if (!Object.values(STATUS).includes(status)) return send(res, 400, { error: "非法状态" });
          if (!store.get(id)) return send(res, 404, { error: "未找到" });
          return send(res, 200, store.setStatus(id, status, note));
        }
        if (method === "PUT") {
          const body = await readBody(req);
          if (!store.get(id)) return send(res, 404, { error: "未找到" });
          const merged = schema.stripMeta({ ...store.get(id), ...body, id });
          const { valid, errors } = schema.validate(merged);
          if (!valid) return send(res, 400, { error: "校验未通过", errors });
          return send(res, 200, store.update(id, body));
        }
        if (method === "DELETE") {
          return send(res, 200, { removed: store.remove(id) });
        }
      }

      // ---- 新建 ----
      if (method === "POST" && pathname === "/api/directions") {
        const body = await readBody(req);
        const clean = schema.stripMeta(body);
        const { valid, errors } = schema.validate(clean);
        if (!valid) return send(res, 400, { error: "校验未通过", errors });
        if (store.get(body.id)) return send(res, 409, { error: "id 已存在" });
        return send(res, 201, store.create(body));
      }

      // ---- 批量审核 ----
      if (method === "POST" && pathname === "/api/directions/status") {
        const { ids = [], status, note } = await readBody(req);
        if (!Object.values(STATUS).includes(status)) return send(res, 400, { error: "非法状态" });
        const updated = [];
        for (const id of ids) {
          if (store.get(id)) updated.push(store.setStatus(id, status, note));
        }
        return send(res, 200, { updated: updated.length });
      }

      // ---- 导入 ----
      if (method === "POST" && pathname === "/api/import") {
        const { file } = await readBody(req);
        const target = file ? path.resolve(process.cwd(), file) : seedFile;
        const result = importFromFile(store, target);
        return send(res, 200, { ...result, file: target });
      }

      // ---- 导出（含 preview） ----
      if (method === "POST" && pathname === "/api/export") {
        const all = store.list();
        if (url.searchParams.get("preview") === "1") {
          return send(res, 200, previewExport(all, outDir));
        }
        try {
          const result = writeExport(all, outDir);
          return send(res, 200, result);
        } catch (e) {
          return send(res, 400, { error: e.message, invalid: e.invalid || [] });
        }
      }

      return send(res, 404, { error: "Not Found" });
    } catch (e) {
      return send(res, 500, { error: e.message });
    }
  };
}

module.exports = { createApp, WEB_DIR, DEFAULT_SEED };
