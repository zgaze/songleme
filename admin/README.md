# 送了么 · 离线管理后台

纯本地、离线、单人用的「推荐品方向」管理后台：增删改查 + 审核 + 一键导出运行时 `giftDirections.js`。

链路位置：`AI 生成 → [本工具] 人工审核/编辑/补关键词 → 导出运行时 → (事后人工) 同步 CloudBase`。

## 特性

- **零运行时依赖**：只用 Node 内置 `http` + 内置 schema 校验器 + `node:test`。`npm i` 无需联网，**全程断网可用**，不接 CloudBase、不鉴权、不部署。
- **schema 为唯一契约**：字段/枚举/校验全部由 `schemas/gift-direction.schema.json` 驱动（含 `romantic ≠ apology` 安全规则）。
- **真源 = catalog**（`admin/data/directions.json`），运行时 JS 是派生物，只能导出生成、禁止手改。

## 用法

```sh
cd admin
npm i              # 零依赖，秒过
npm run dev        # 起 http://127.0.0.1:5174
npm test           # 全部单测（store / schema / 导入去重 / 导出 / API）
npm run export     # 把 catalog 中 approved 的方向导出成两份运行时 JS
```

浏览器打开后：

1. **导入种子** → 吃 `data/generated-gifts-deepseek-*.json`（80 条），标 `_source=deepseek`、`_status=pending`，按 id/name 去重。
2. **列表/筛选** → 按状态 / 品类 / 对象 / 场景筛，按名称搜。
3. **编辑** → 枚举字段=下拉/多选（选项来自 schema）；`searchKeywords`/`tags`/`pairingTags`=标签输入；保存前 ajv 式校验，非法（旧 `budget`、`romantic+apology` 等）**拒绝写入并提示**。
4. **审核** → 单条/批量 approve / reject，可写 `_note`。
5. **导出** → 只导 `approved`，剥离 `_*` 元字段，写 `dist/client` + `dist/server` 两份**逐字节一致**的 `giftDirections.js`；导出前有 diff 预览。

## 目录

```
admin/
  server/   schema.js(校验+表单元信息) store.js(catalog CRUD) importer.js(导入去重)
            export.js(导出) app.js(HTTP API) server.js(dev 入口) export-cli.js  *.test.js
  web/      index.html + app.js + styles.css（原生，无框架/CDN）
  data/     directions.json （catalog 真源，git 跟踪）
  dist/     导出产物（派生物，gitignore）
```

## 边界（明确不做）

线上部署 / 鉴权 / 多用户 / CloudBase 实时读写或自动同步 / 商品(Product)两层模型 / 老数据迁移。

> 导出默认写入 `admin/dist/{client,server}/`，**不**覆盖 `miniprogram/` 与 `cloudfunctions/` 的运行时文件——
> 同步到运行时 / CloudBase 是事后人工步骤（硬约束：不碰 miniprogram 构建）。
