# 执行简报 · 离线管理后台（前后端 + 测试）

> **读者：执行这件事的 agent。** 这是一份可直接执行的任务简报，不是项目文档维护。读完应能独立把 `admin/` 从零搭起、写出测试、本地跑通。
> 背景与全局：`docs/dev-plan-2026-06.md` 阶段 3；数据契约：`schemas/gift-direction.schema.json` + `docs/gift-protocol-v3.md`。

---

## 1. 目标（一句话）

在仓库 `admin/` 下做一个**纯本地、离线、单人用**的管理后台（前端 + 后端 + 测试），对「推荐品(方向)」做增删改查 + 审核，并能**一键导出**成运行时 `giftDirections.js`。

它在链路里的位置：`AI 生成 → [本工具] 人工审核/编辑/补关键词 → 导出运行时 → (后续人工)同步 CloudBase`。

## 2. 锁定的决定（不要重新讨论）

- **完全离线本地**，不部署、不鉴权、不接 CloudBase；同步 CloudBase 是事后人工步骤，不在本工具内。
- 推荐品**单层方向**，**无商品(Product)层**。每条方向带软字段 `searchKeywords`（爆品/经典/品牌词，仅作下游电商搜索种子）。
- **数据字段直接用仓库现有的**：以 `schemas/gift-direction.schema.json` 为唯一字段契约。**不要**等阶段 0 的老数据迁移——本工具可独立先做、用现有 v3 数据起步。
- 真源 = catalog（本工具的本地存储）；运行时 JS 是**派生产物**，只能导出生成，禁止手改。

## 3. 先读这些

- `schemas/gift-direction.schema.json`（字段 + 枚举 + `searchKeywords` + `romantic≠apology` 规则）——前端表单的枚举下拉、后端保存校验都从它来。
- `docs/gift-protocol-v3.md` 第 2 节字段表（硬必填/软/展示三档）。
- 种子数据：`data/generated-gifts-deepseek-20260601-105159.json`（80 条真实 v3 数据，直接用来初始化 catalog 做开发/测试）。
- 现有运行时格式：`cloudfunctions/recommendGift/data/giftDirections.js`（导出目标格式参考；注意它当前是老枚举，导出脚本以 v3 为准）。

## 4. 技术栈与结构（建议，可微调）

```
admin/
  server/            # Node + Express
    app.js           # 路由：/api/directions CRUD + /api/import + /api/export
    store.js         # 存储层（JSON 文件起步；接口隔离，便于日后换 SQLite）
    schema.js        # 加载 gift-direction.schema.json + ajv 校验
    export.js        # catalog(approved) → client/server 两份 giftDirections.js
    *.test.js        # 后端测试（必须）
  web/               # Vite + Vue（或纯 HTML+fetch，越简单越好）
    列表页 + 编辑表单（枚举来自 schema，searchKeywords 为可增删的标签输入）
  data/
    directions.json  # catalog（含管理元字段）；git 跟踪
  package.json       # scripts: dev / test / export
```

- 存储：**JSON 文件起步**（零基建、可 git diff）。store 层接口化，日后换 SQLite 不动 UI。
- catalog 每条 = v3 字段 + 管理元字段（导出时剥离）：`_status`(pending/approved/rejected)、`_source`(manual/deepseek/migrated)、`_updatedAt`、`_note`。

## 5. 功能需求

1. **导入**：`POST /api/import` 吃 `data/generated-gifts-*.json`，落入 catalog，标 `_source=deepseek`、`_status=pending`；按 `id`/`name_key` 去重。
2. **列表/查询**：按 category / target / scene / `_status` 筛选，按 name 搜索。
3. **编辑表单**：枚举字段=下拉/多选（选项来自 schema）；`searchKeywords` / `tags` / `pairingTags`=可增删标签输入；**保存前 ajv 校验**，非法（如 budget 填旧值 `100_300`、romantic+apology）**拒绝写入并提示**。
4. **审核**：单条/批量 `approve` / `reject`；可写 `_note`。
5. **导出**：`POST /api/export` 把 `_status=approved` 的导出成 client + server 两份 `giftDirections.js`（剥离 `_*` 元字段），导出前给 diff 预览；导出后自动跑现有 `scripts/validate-*.js`。

## 6. 测试要求（用户明确要求"包括测试"，必须有）

- **后端单测**（`*.test.js`，node:test 或 jest 均可）：
  - store CRUD：增/改/删后 catalog 文件状态正确。
  - 校验：合法对象通过；非法枚举 / 缺硬必填 / romantic+apology 被拒。
  - 导入去重：同名/同 id 不重复入库。
  - 导出：approved → 两份 JS **内容一致**且剥离了 `_*`；rejected/pending 不进导出。
- **导出回归**：导出后 `node scripts/validate-questionnaire.js` 等现有校验脚本全过。
- `npm test` 一条命令跑全部，**全绿**才算完成。

## 7. 验收标准（逐条可检验）

1. `cd admin && npm i && npm run dev` 起得来，浏览器看到列表。
2. 导入种子 80 条，列表条数对得上，均为 `pending`。
3. 改一条保存 → `data/directions.json` 正确更新（git diff 合理）；故意填非法枚举 → 被拦、不写入。
4. approve 几条、reject 几条 → 导出只含 approved、且剥离 `_*`；client/server 两份**逐字节一致**。
5. 导出后现有 `validate-*` 脚本全过。
6. `npm test` 全绿。
7. **断网**全流程可用（证明不依赖外网/CloudBase）。

## 8. 不做（明确排除）

线上部署 / 登录鉴权 / 多用户 / CloudBase 实时读写或自动同步 / 埋点统计 / 电商交易比价 / 商品(Product)两层模型 / 老数据迁移（那是阶段 0 的事，本工具用现有字段独立推进）。

## 9. 风险与提示

- 双份运行时（client+server）只能同一次导出生成，**禁止手改**，否则漂移。
- 种子数据是 v3 枚举；运行时老文件是旧枚举——导出以 **v3/schema 为准**，不要去兼容旧值。
- CloudBase 同步是人工后续步骤；本工具只需把"导出产物"准备好即可。
