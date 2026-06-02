"use strict";

/**
 * catalog 存储层（真源）。JSON 文件起步——零基建、可 git diff。
 *
 * 接口刻意做成「数据进出 = 纯函数式 + 一个文件落盘点」，日后换 SQLite 只需
 * 重写 read/write 两处，路由/校验/导出都不动。
 *
 * catalog 每条 = v3 字段 + 管理元字段（导出时由 schema.stripMeta 剥离）：
 *   _status   pending | approved | rejected
 *   _source   manual | deepseek | migrated
 *   _updatedAt ISO 字符串
 *   _note     人工备注
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_FILE = path.resolve(__dirname, "../data/directions.json");

const STATUS = Object.freeze({ PENDING: "pending", APPROVED: "approved", REJECTED: "rejected" });
const SOURCE = Object.freeze({ MANUAL: "manual", DEEPSEEK: "deepseek", MIGRATED: "migrated" });

class Store {
  /** @param {string} [filePath] catalog 文件路径（默认 admin/data/directions.json） */
  constructor(filePath = DEFAULT_FILE) {
    this.filePath = filePath;
  }

  /** 读取整个 catalog（文件不存在视为空表） */
  _readAll() {
    if (!fs.existsSync(this.filePath)) return [];
    const raw = fs.readFileSync(this.filePath, "utf8").trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("catalog 文件应是一个数组");
    return parsed;
  }

  /** 落盘（稳定排序 + 2 空格缩进，让 git diff 干净） */
  _writeAll(items) {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(items, null, 2) + "\n", "utf8");
  }

  /**
   * 列表 + 筛选。filters 任意组合：
   *   category, _status, _source（精确匹配）
   *   target / scene（数组包含）
   *   q（按 name 子串，忽略大小写）
   */
  list(filters = {}) {
    let items = this._readAll();
    const { category, _status, _source, target, scene, q } = filters;
    if (category) items = items.filter((it) => it.category === category);
    if (_status) items = items.filter((it) => it._status === _status);
    if (_source) items = items.filter((it) => it._source === _source);
    if (target) items = items.filter((it) => Array.isArray(it.target) && it.target.includes(target));
    if (scene) items = items.filter((it) => Array.isArray(it.scene) && it.scene.includes(scene));
    if (q) {
      const needle = String(q).toLowerCase();
      items = items.filter((it) => (it.name || "").toLowerCase().includes(needle));
    }
    return items;
  }

  get(id) {
    return this._readAll().find((it) => it.id === id) || null;
  }

  /**
   * 新建。data 是 v3 字段（可含部分 _* 元字段覆盖默认）。
   * 默认 _status=pending、_source=manual、_updatedAt=now。
   * id 重复则抛错（由调用方/路由决定如何处理）。
   * @param {string} now ISO 时间戳（由调用方注入，便于测试可复现）
   */
  create(data, now = new Date().toISOString()) {
    const items = this._readAll();
    if (!data.id) throw new Error("create: 缺少 id");
    if (items.some((it) => it.id === data.id)) {
      throw new Error(`create: id 已存在 "${data.id}"`);
    }
    const record = {
      _status: STATUS.PENDING,
      _source: SOURCE.MANUAL,
      _note: "",
      ...data,
      _updatedAt: now,
    };
    items.push(record);
    this._writeAll(items);
    return record;
  }

  /** 局部更新（合并），刷新 _updatedAt。不存在则抛错。 */
  update(id, patch, now = new Date().toISOString()) {
    const items = this._readAll();
    const idx = items.findIndex((it) => it.id === id);
    if (idx === -1) throw new Error(`update: 未找到 id "${id}"`);
    // 不允许通过 patch 改 id（避免引用漂移）
    const { id: _ignored, ...rest } = patch;
    items[idx] = { ...items[idx], ...rest, id, _updatedAt: now };
    this._writeAll(items);
    return items[idx];
  }

  /** 改状态的便捷方法（approve/reject 复用） */
  setStatus(id, status, note, now = new Date().toISOString()) {
    if (!Object.values(STATUS).includes(status)) throw new Error(`非法状态 ${status}`);
    const patch = { _status: status };
    if (note !== undefined) patch._note = note;
    return this.update(id, patch, now);
  }

  remove(id) {
    const items = this._readAll();
    const next = items.filter((it) => it.id !== id);
    const removed = next.length !== items.length;
    if (removed) this._writeAll(next);
    return removed;
  }

  count() {
    return this._readAll().length;
  }

  /** 整表覆写（导入时批量写入用） */
  replaceAll(items) {
    this._writeAll(items);
    return items.length;
  }
}

module.exports = { Store, STATUS, SOURCE, DEFAULT_FILE };
