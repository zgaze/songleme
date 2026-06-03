# WS1 联系人（收礼人档案）实现规格

> 日期：2026-06-03 · 分支：`dev/app-plan-6-04`
> 上位文件：`docs/superpowers/specs/2026-06-03-app-plan-6-04-master.md`（契约 C1/C2/C3/C7/C8 以 master 为准）
> 本规格只覆盖 WS1 拥有的文件，不设计其它工作流。

## 1. 目标与范围

让用户能在「我的」页维护一组**收礼人档案**（联系人），并在主页「开始选礼物」时先选一个联系人，把已知身份信息预填进问卷、跳过对应身份题，避免每次重复回答。

**本迭代的持久化决策（master C8）**：联系人**改用本地存储 `wx.setStorageSync`**，所有读写经过一个新的存储抽象层 `miniprogram/shared/recipientRepo.js`。`recipientRepo` 对外暴露 **Promise 化**接口，页面代码不感知底层是本地存储还是云后端；上线前换库只需新增一个实现同接口的 backend 模块并改默认导出（DB 切换点）。本迭代**不改动**既有云函数 `manageRecipientProfile`，保留为未来后端选项。

**本工作流要做的事：**

1. 新增存储抽象层 `miniprogram/shared/recipientRepo.js`：实现 master C8 的 Promise 接口（`listRecipients/createRecipient/updateRecipient/deleteRecipient/getRecipient`），后端为本地存储（key `songleme:recipients`，存整数组）。字段清洗逻辑（原云函数 `cleanRecipient`/`cleanEnum`/`cleanText`/`createId`）**移植到 repo 内的客户端**，新增 `personaTags` 清洗（14 值枚举、去重、最多 5）。
2. 新增联系人列表页 `pages/contacts/`：展示已保存联系人，支持「选用 / 编辑 / 删除 / 新建」；空列表直接进入新建。所有数据访问走 `recipientRepo.*`。
3. 新增联系人编辑页 `pages/contactEdit/`：新建/编辑表单（称呼、关系、性别、职业、风格、personaTags 多选 chip、notes 自由文本），完成时自动保存（调用 `recipientRepo` 后返回）。
4. 「我的」页 `pages/profile/`：把「收礼人档案」行从 toast 占位改为 `wx.navigateTo` 到联系人列表。
5. 联系人选择入口：主页 `pages/home/` 的「开始选礼物」改为先进入联系人选择，再按 C2/C3 携带 `prefill`/`skip` 跳转问卷（master C7：只改 `startQuestionnaire` 一处）。
6. `app.json`：追加 `pages/contacts/index`、`pages/contactEdit/index`。

**非目标（明确不做）：**

- **不**修改云函数 `cloudfunctions/manageRecipientProfile/index.js`（本迭代不部署、不调用它；其 CRUD/`cleanRecipient` 逻辑被移植进客户端 repo，原文件原样保留为未来后端）。
- **不**修改 `miniprogram/utils/cloud.js`（联系人不再走云函数，故不新增任何 recipient 包装函数）。
- **不**把 `personaTags` 接入推荐打分（master C1 决策：新属性仅存储展示）。本流程只负责采集、存储、展示与表单回显。
- **不**新增 `age` / `constellation` / `environment` 等结构化字段；年龄/星座/生活环境一律写进 `notes`。
- **不**改问卷页 `pages/question/`（WS2 拥有），只按 C2/C3 传 `prefill`/`skip` 参数。
- **不**接入 `manageUserPreference` / `listRecommendationHistory`（「我的」页另外两行保持 toast 占位不动）。
- **不**做联系人头像、跨设备同步（本地存储仅本机；换库后由 backend 解决）。

## 2. 现状（相关现有代码）

- **持久化基线（master C8）**：本迭代联系人用本地存储，不走 CloudBase。小程序客户端无法直接跑 SQLite，真正换库（SQLite/MySQL/CloudBase）需服务端，推迟到上线前，届时通过 `recipientRepo` 的 backend 模块切换。
- 既有云函数 `cloudfunctions/manageRecipientProfile/index.js` 已实现完整 CRUD（`list/create/update/delete`，集合 `recipients`，身份用 `cloud.getWXContext().OPENID`）。**本迭代不调用、不部署、不修改**，仅作为清洗逻辑的移植来源与未来后端候选：
  - `cleanRecipient(input)`（index.js:100-117）：清洗 `nickname`(text≤30) / `target` / `gender` / `occupation` / `recipientStyle`（各自枚举）/ `notes`(text≤200)，空值不写入。
  - `cleanEnum(value, allowed)`（index.js:132-135）、`cleanText(value, maxLength)`（index.js:137-139）、`createId(prefix)`（index.js:141-143）。
  - 枚举集合（index.js:8-11）：`ALLOWED_TARGETS = {partner,parents,bestie}`、`ALLOWED_GENDERS = {female,male}`、`ALLOWED_OCCUPATIONS = {office,tech,creative,medical_education,student,freelance,homemaker}`、`ALLOWED_STYLES = {practical,aesthetic,experiential,quality}`。
  - 原云函数 `createId` 用 `Date.now().toString(36)`；本 repo 按 master C8 用 `rp_${Date.now()}_${rand}`（见 §3.1）。
  - 该云函数原本无 `personaTags`；本 repo 在移植时新增 personaTags 清洗。

- 14 值 personaTags 枚举来自 `schemas/gift-direction.schema.json:15-22`（`personaTag` definition），`personaTags` 数组 `maxItems: 5`（同文件 line 54）。

- `miniprogram/utils/cloud.js`：现有 `callCloudFunction(name, data)` 通用包装、`recommendGift` / `createGiftShare` / `getGiftShare`。**本流程不动它**（联系人不再经云函数）。

- `pages/profile/index.js`：`data.entries` 三行 `[{title:"我的偏好",value:"preference"},{title:"收礼人档案",value:"recipients"},{title:"历史推荐",value:"history"}]`，`openEntry` 统一 toast（仅取 `dataset.title`）。`onShow` 调 `selectTab(this, 1)`。WXML（profile/index.wxml:7-16）用 `bindtap="openEntry"`、`data-title="{{item.title}}"`（**当前未传 `data-value`**）。profile 是 tab 页。

- `pages/home/index.js`：`startQuestionnaire()`（home/index.js:13-17）现直接 `wx.navigateTo({url:"/pages/question/index"})`；`openGuide()` 跳攻略。home 是 tab 页（selected 0）。WXML 两个按钮 `home-button--primary`（开始选礼物）/ `home-button--guide`（送礼攻略）。

- `pages/question/index.js`：`onLoad()` 直接 `setQuestion(START_QUESTION_ID, [])`，**当前不读任何 URL 参数**。解析 `prefill`/`skip` 由 WS2 实现；WS1 只负责把参数拼对（见 §4 C2/C3）。

- 设计令牌在 `app.wxss`（clay 风）：`--bg / --surface / --surface-solid`、pastel `--blue/--rose/--gold/--mint`(+`-soft`)、文字 `--text/--text-2/--text-3`、pastel 上文字 `--on-blue/--on-rose/--on-gold/--on-mint`、圆角 `--r-sm/md/lg/xl/pill`、字号 `--fs-display/title/h1/h2/body/sm/label/cap`、阴影 `--out-sm/md/lg` + `--ins-neutral/blue/rose/gold/mint/press`。
  - 复用模式（来自 profile/guide/question/home）：clay tile = `border-radius:var(--r-lg/md); background:var(--surface); box-shadow:var(--out-md), var(--ins-neutral)`，`:active` 时 `transform:scale(.985)` + `box-shadow:var(--out-sm), var(--ins-press)`。
  - chip = guide `.guide__channel`：`border-radius:var(--r-pill); height:62rpx; box-shadow:var(--out-sm), var(--ins-neutral)`，选中态加 `transform:translateY(-2rpx)` + `var(--out-md)`。`button` 需 `::after{border:0;}` 去除默认描边。
  - 按钮：`.dark-button`(rose 主操作) / `.ghost-button`(surface 次操作)，见 `pages/question/index.wxss:155-180`。
  - 普通页根容器加 class `page`（`min-height:100vh; box-sizing:border-box`）；底部留白用 `safe-bottom`。

## 3. 改动清单（逐文件）

### 3.1 新文件 `miniprogram/shared/recipientRepo.js`（存储抽象层 · master C8）

这是本工作流的**中枢**：所有联系人读写都经过它。对外接口 Promise 化（便于日后换异步云后端，页面零改动）；本迭代后端是本地存储；字段清洗（master C1）在 repo 内完成，页面不重复校验。

**存储约定：**

- 存储 key：`songleme:recipients`（常量 `STORAGE_KEY`）。
- 存储内容：**整个 recipient 数组**（`Recipient[]`），用 `wx.getStorageSync` 读、`wx.setStorageSync` 写。
- 每条 recipient 形态见 master C1：`{ recipientId, nickname, target, gender, occupation, recipientStyle, personaTags, notes, createdAt, updatedAt }`。
- `recipientId` 客户端生成：`rp_${Date.now()}_${rand}`（master C8），`rand = Math.random().toString(36).slice(2, 8)`。
- `createdAt` / `updatedAt` 用 `Date.now()`（毫秒数）。
- 本地读写是同步操作，统一用 `Promise.resolve(...)` 包装以符合异步接口；读写异常用 `Promise.reject(err)` 抛出，页面 `.catch` 兜底。

**枚举与清洗常量（移植自云函数 index.js:8-11 + 新增 personaTags）：**

```js
const STORAGE_KEY = "songleme:recipients";

const ALLOWED_TARGETS = new Set(["partner", "parents", "bestie"]);
const ALLOWED_GENDERS = new Set(["female", "male"]);
const ALLOWED_OCCUPATIONS = new Set([
  "office", "tech", "creative", "medical_education", "student", "freelance", "homemaker",
]);
const ALLOWED_STYLES = new Set(["practical", "aesthetic", "experiential", "quality"]);
const ALLOWED_PERSONA_TAGS = new Set([
  "tech_geek", "office_pro", "creative", "student", "night_owl", "homebody",
  "outdoorsy", "fitness", "coffee_tea", "foodie", "pet_owner", "beauty_lover",
  "fandom_gamer", "bookish",
]);
const MAX_PERSONA_TAGS = 5;
```

**清洗工具（移植自云函数；逻辑等价于 cleanText/cleanEnum/createId）：**

```js
function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function cleanEnum(value, allowed) {
  const text = cleanText(value, 80);
  return allowed.has(text) ? text : "";
}

// personaTags：按 14 值枚举过滤、去重、保持传入顺序、截到 maxItems(5)、非数组返回 []
function cleanEnumArray(value, allowed, maxItems) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const result = [];
  for (const raw of value) {
    const text = cleanText(raw, 80);
    if (allowed.has(text) && !seen.has(text)) {
      seen.add(text);
      result.push(text);
      if (result.length >= maxItems) break;
    }
  }
  return result;
}

function createId() {
  const rand = Math.random().toString(36).slice(2, 8);
  return `rp_${Date.now()}_${rand}`;
}
```

**字段清洗（移植自云函数 cleanRecipient，新增 personaTags 的 hasOwnProperty 语义）：**

```js
// 返回只含「白名单内、清洗后非空」字段的对象；personaTags 例外见下。
function cleanRecipient(input) {
  const result = {};
  const nickname = cleanText(input.nickname, 30);          // 长度上限 30
  const target = cleanEnum(input.target, ALLOWED_TARGETS);
  const gender = cleanEnum(input.gender, ALLOWED_GENDERS);
  const occupation = cleanEnum(input.occupation, ALLOWED_OCCUPATIONS);
  const recipientStyle = cleanEnum(input.recipientStyle, ALLOWED_STYLES);
  const notes = cleanText(input.notes, 200);               // 长度上限 200

  if (nickname) result.nickname = nickname;
  if (target) result.target = target;
  if (gender) result.gender = gender;
  if (occupation) result.occupation = occupation;
  if (recipientStyle) result.recipientStyle = recipientStyle;
  if (notes) result.notes = notes;

  // personaTags：仅当 input 显式带该 key 时才写入，允许写空数组（用户清空全部 tag）。
  // 未带该 key 时不动（保持 update「只更新传入字段」语义，与既有云函数一致）。
  if (Object.prototype.hasOwnProperty.call(input, "personaTags")) {
    result.personaTags = cleanEnumArray(input.personaTags, ALLOWED_PERSONA_TAGS, MAX_PERSONA_TAGS);
  }

  return result;
}
```

> 字段白名单 = 只有上述 6 个既有字段 + `personaTags`；任何其它键（如客户端误传的 `recipientId`、`createdAt`）都不会被 `cleanRecipient` 透传，避免脏字段落库。

**本地存储读写底层：**

```js
function readAll() {
  const raw = wx.getStorageSync(STORAGE_KEY);
  return Array.isArray(raw) ? raw : [];
}

function writeAll(list) {
  wx.setStorageSync(STORAGE_KEY, list);
}
```

**Promise 化接口（master C8 五个方法）：**

```js
// 1) 列表：按 updatedAt 倒序
function listRecipients() {
  try {
    const list = readAll().slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return Promise.resolve(list);
  } catch (err) {
    return Promise.reject(err);
  }
}

// 2) 新建：清洗 → 生成 id/时间戳 → 入数组头 → 落库；返回 { recipientId }
function createRecipient(input) {
  try {
    const now = Date.now();
    const recipient = {
      recipientId: createId(),
      ...cleanRecipient(input || {}),
      createdAt: now,
      updatedAt: now,
    };
    const list = readAll();
    list.unshift(recipient);
    writeAll(list);
    return Promise.resolve({ recipientId: recipient.recipientId });
  } catch (err) {
    return Promise.reject(err);
  }
}

// 3) 更新：清洗 patch → 合并到目标行 → 刷新 updatedAt → 落库；返回 void
function updateRecipient(recipientId, patch) {
  try {
    const id = cleanText(recipientId, 80);
    if (!id) return Promise.reject(new Error("INVALID_RECIPIENT"));
    const list = readAll();
    const idx = list.findIndex((r) => r.recipientId === id);
    if (idx < 0) return Promise.resolve(); // 已被删/不存在：静默成功（语义同云函数 updated:0）
    const update = cleanRecipient(patch || {});
    list[idx] = { ...list[idx], ...update, updatedAt: Date.now() };
    writeAll(list);
    return Promise.resolve();
  } catch (err) {
    return Promise.reject(err);
  }
}

// 4) 删除：按 id 过滤 → 落库；返回 void
function deleteRecipient(recipientId) {
  try {
    const id = cleanText(recipientId, 80);
    if (!id) return Promise.reject(new Error("INVALID_RECIPIENT"));
    const list = readAll().filter((r) => r.recipientId !== id);
    writeAll(list);
    return Promise.resolve();
  } catch (err) {
    return Promise.reject(err);
  }
}

// 5) 取单条（contactEdit 编辑态用）；不存在返回 null
function getRecipient(recipientId) {
  try {
    const id = cleanText(recipientId, 80);
    const found = readAll().find((r) => r.recipientId === id);
    return Promise.resolve(found || null);
  } catch (err) {
    return Promise.reject(err);
  }
}

module.exports = {
  listRecipients,
  createRecipient,
  updateRecipient,
  deleteRecipient,
  getRecipient,
};
```

> **DB 切换点（master C8）**：上线前换库 = 新增一个实现这 5 个 Promise 方法的 backend 模块（如 `recipientRepo.cloud.js`，内部可调 `manageRecipientProfile` 云函数），把 `recipientRepo.js` 的 `module.exports` 改成转发到该 backend。`pages/contacts` / `pages/contactEdit` / 主页选择器代码**零改动**——因为它们只 `await` 这 5 个 Promise 方法、只判 resolve/reject。

### 3.2 新页面 `pages/contacts/`（联系人列表 / 选择）

文件：`index.js` / `index.wxml` / `index.wxss` / `index.json`。是 `navigateTo` 普通页（**非 tab**）。

**两种模式（同一页面，靠 URL 参数 `mode` 区分）：**

- 默认（从「我的 → 收礼人档案」进入，无 `mode`）：**管理模式**。每行点击进入编辑；行内提供「删除」。
- `mode=pick`（从主页「开始选礼物」进入）：**选择模式**。点击某联系人 = 选用 → 按 C2/C3 跳问卷；额外提供「跳过 / 匿名送」入口。两种模式都提供「＋ 新建联系人」。

`index.json`：

```json
{ "navigationBarTitleText": "收礼人" }
```

`index.js` 结构（数据访问全部走 `recipientRepo`，await Promise）：

```js
const recipientRepo = require("../../shared/recipientRepo");
// 复用同一份中文标签字典（见 §3.3，建议抽成 shared 常量或在本页内重声明，
// 列表页用它把 enum 值翻成中文摘要展示）。

Page({
  data: {
    mode: "manage",         // "manage" | "pick"
    loading: true,
    items: [],              // 已格式化用于展示的联系人（含 summary 文案，保留 raw）
    error: "",
  },

  onLoad(options) {
    this.setData({ mode: options.mode === "pick" ? "pick" : "manage" });
  },

  onShow() {
    this.loadList();        // onShow 而非 onLoad，保证从编辑页返回后刷新
  },

  loadList() {
    this.setData({ loading: true, error: "" });
    recipientRepo.listRecipients().then((rows) => {
      const items = (rows || []).map(formatRecipientForList);
      this.setData({ loading: false, items });
      // 管理模式下空列表 → 直接进新建（首次使用更顺）
      if (this.data.mode === "manage" && items.length === 0) {
        this.goCreate();
      }
    }).catch(() => this.setData({ loading: false, error: "加载失败，请重试" }));
  },

  goCreate() {
    wx.navigateTo({ url: "/pages/contactEdit/index" });
  },

  goEdit(e) {                       // 管理模式：点行进编辑
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/contactEdit/index?recipientId=${id}` });
  },

  onDelete(e) {                     // 管理模式：删除（带二次确认）
    const id = e.currentTarget.dataset.id;
    wx.showModal({ title: "删除联系人", content: "确定删除该联系人？", confirmColor: "#6e334c" })
      .then((r) => {
        if (!r.confirm) return;
        return recipientRepo.deleteRecipient(id).then(() => {
          wx.showToast({ title: "已删除", icon: "none" });
          this.loadList();
        });
      })
      .catch(() => wx.showToast({ title: "删除失败", icon: "none" }));
  },

  onPick(e) {                       // 选择模式：选用 → 跳问卷（C2/C3）
    const id = e.currentTarget.dataset.id;
    const recipient = (this.data.items.find((it) => it.recipientId === id) || {}).raw;
    if (!recipient) return;
    const prefill = buildPrefill(recipient);                 // 见 §4
    const skip = "target,gender,occupation,recipientStyle";   // C3 固定
    const url = `/pages/question/index?prefill=${encodeURIComponent(JSON.stringify(prefill))}&skip=${skip}`;
    wx.navigateTo({ url });
  },

  onSkip() {                        // 选择模式：跳过 / 匿名送
    wx.navigateTo({ url: "/pages/question/index" });
  },
});
```

`formatRecipientForList(item)`：把 repo 返回的原始行包成 `{ recipientId, nickname, summary, raw:item }`。`summary` 拼成一行：关系中文 + 性别中文 + 职业中文（缺失项跳过），personaTags 译成中文展示前若干个（如「数码极客·吃货 …」）。`buildPrefill` 与中文字典见 §3.3 / §4。

WXML 用 `wx:if="{{mode=='manage'}}"` / `wx:if="{{mode=='pick'}}"` 切换行的 `bindtap`（`goEdit` vs `onPick`）、是否显示删除按钮、是否显示「跳过/匿名送」入口。

`index.wxml`（clay 风，结构示意）：

```
<view class="page contacts safe-bottom">
  <view class="contacts__head">
    <text class="contacts__title">{{mode=='pick' ? '送给谁' : '收礼人档案'}}</text>
    <text wx:if="{{mode=='pick'}}" class="contacts__sub">选一个人，跳过身份问题</text>
  </view>

  <view wx:if="{{loading}}" class="contacts__hint">加载中…</view>
  <view wx:elif="{{error}}" class="contacts__hint" bindtap="loadList">{{error}}（点此重试）</view>

  <view wx:else class="contacts__list">
    <view
      wx:for="{{items}}" wx:key="recipientId"
      class="contact-card"
      data-id="{{item.recipientId}}"
      bindtap="{{mode=='pick' ? 'onPick' : 'goEdit'}}"
    >
      <view class="contact-card__main">
        <text class="contact-card__name">{{item.nickname}}</text>
        <text class="contact-card__summary">{{item.summary}}</text>
      </view>
      <view wx:if="{{mode=='manage'}}" class="contact-card__del" catchtap="onDelete" data-id="{{item.recipientId}}">删除</view>
      <text wx:else class="contact-card__arrow">›</text>
    </view>
  </view>

  <view class="contacts__actions">
    <button class="dark-button" bindtap="goCreate">＋ 新建联系人</button>
    <button wx:if="{{mode=='pick'}}" class="ghost-button" bindtap="onSkip">跳过 / 匿名送</button>
  </view>
</view>
```

> 注意删除按钮用 `catchtap`（阻止冒泡到行的 `bindtap`），并各自带 `data-id`。

`index.wxss`：复用 §2 的 clay tile 模式。`.contact-card` = `display:flex; align-items:center; justify-content:space-between; min-height:120rpx; padding:0 32rpx; border-radius:var(--r-lg); background:var(--surface); box-shadow:var(--out-md), var(--ins-neutral);` + `:active{transform:scale(.985); box-shadow:var(--out-sm), var(--ins-press);}`。`.contacts__actions` 随内容流于底部；`.dark-button`/`.ghost-button` 沿用 question 页定义（直接复制那段 CSS 进本页 wxss，因 wxss 不跨页共享）。

### 3.3 新页面 `pages/contactEdit/`（新建 / 编辑表单）

文件：`index.js` / `index.wxml` / `index.wxss` / `index.json`。`navigateTo` 普通页。

URL 参数：无参 = 新建；`?recipientId=xxx` = 编辑。编辑模式用 `recipientRepo.getRecipient(id)` 直接取单条回填（C8 提供了 `getRecipient`，无需再拉全量列表 find）。

`index.json`：

```json
{ "navigationBarTitleText": "编辑联系人" }
```

**字段与选项字典（页面内常量，value 必须与 master/schema 完全一致）：**

```js
const RELATION_OPTIONS = [   // target
  { value: "partner", label: "伴侣" },
  { value: "parents", label: "父母" },
  { value: "bestie",  label: "好友" },
];
const GENDER_OPTIONS = [
  { value: "female", label: "女" },
  { value: "male",   label: "男" },
];
const OCCUPATION_OPTIONS = [
  { value: "office",            label: "职场白领" },
  { value: "tech",              label: "技术" },
  { value: "creative",          label: "创意设计" },
  { value: "medical_education", label: "医护/教育" },
  { value: "student",           label: "学生" },
  { value: "freelance",         label: "自由职业" },
  { value: "homemaker",         label: "全职照护" },
];
const STYLE_OPTIONS = [       // recipientStyle
  { value: "practical",    label: "实用派" },
  { value: "aesthetic",    label: "颜值控" },
  { value: "experiential", label: "体验型" },
  { value: "quality",      label: "品质感" },
];
// personaTags —— 14 值，中文标签按 master C1（权威）
const PERSONA_OPTIONS = [
  { value: "tech_geek",    label: "数码极客" },
  { value: "office_pro",   label: "职场人" },
  { value: "creative",     label: "创意工作者" },
  { value: "student",      label: "学生党" },
  { value: "night_owl",    label: "夜猫子" },
  { value: "homebody",     label: "宅家派" },
  { value: "outdoorsy",    label: "户外控" },
  { value: "fitness",      label: "健身党" },
  { value: "coffee_tea",   label: "咖啡茶饮" },
  { value: "foodie",       label: "吃货" },
  { value: "pet_owner",    label: "养宠人" },
  { value: "beauty_lover", label: "美妆控" },
  { value: "fandom_gamer", label: "追星/游戏" },
  { value: "bookish",      label: "文艺书虫" },
];
const MAX_PERSONA = 5;
```

> personaTags 的中文标签与 occupation 的 `creative`/`student` 中文不要混淆——它们是两个独立维度（职业 vs 兴趣），value 恰好同名是巧合，互不影响。

`index.js` 结构（数据访问走 `recipientRepo`）：

```js
const recipientRepo = require("../../shared/recipientRepo");

Page({
  data: {
    recipientId: "",          // 空 = 新建
    nickname: "",
    target: "", gender: "", occupation: "", recipientStyle: "",
    personaTags: [],          // value 数组
    notes: "",
    relationOptions: RELATION_OPTIONS,
    genderOptions: GENDER_OPTIONS,
    occupationOptions: OCCUPATION_OPTIONS,
    styleOptions: STYLE_OPTIONS,
    personaOptions: PERSONA_OPTIONS,
    maxPersona: MAX_PERSONA,
    saving: false,
  },

  onLoad(options) {
    if (options.recipientId) {
      this.setData({ recipientId: options.recipientId });
      this.loadOne(options.recipientId);
    }
  },

  loadOne(id) {
    recipientRepo.getRecipient(id).then((r) => {
      if (!r) return;          // 已被删/不存在：静默，按空表渲染
      this.setData({
        nickname: r.nickname || "", target: r.target || "", gender: r.gender || "",
        occupation: r.occupation || "", recipientStyle: r.recipientStyle || "",
        personaTags: Array.isArray(r.personaTags) ? r.personaTags : [], notes: r.notes || "",
      });
    }).catch(() => {});
  },

  onNickname(e) { this.setData({ nickname: e.detail.value }); },
  onNotes(e)    { this.setData({ notes: e.detail.value }); },

  // 单选维度：再次点选中项 = 取消（关系/性别/职业/风格都可选，非必填）
  pickSingle(e) {
    const { field, value } = e.currentTarget.dataset;
    this.setData({ [field]: this.data[field] === value ? "" : value });
  },

  // personaTags 多选，最多 5
  togglePersona(e) {
    const value = e.currentTarget.dataset.value;
    const cur = this.data.personaTags;
    const idx = cur.indexOf(value);
    if (idx >= 0) { this.setData({ personaTags: cur.filter((v) => v !== value) }); return; }
    if (cur.length >= this.data.maxPersona) { wx.showToast({ title: `最多选${this.data.maxPersona}个`, icon: "none" }); return; }
    this.setData({ personaTags: cur.concat(value) });
  },

  // 「完成」= 自动保存：组装 recipient → create/update → 成功后 navigateBack
  onSave() {
    if (this.data.saving) return;
    const recipient = {
      nickname: this.data.nickname.trim(),
      target: this.data.target,
      gender: this.data.gender,
      occupation: this.data.occupation,
      recipientStyle: this.data.recipientStyle,
      personaTags: this.data.personaTags,   // 始终带上（含空数组，配合 repo hasOwnProperty 语义）
      notes: this.data.notes.trim(),
    };
    if (!recipient.nickname) { wx.showToast({ title: "请填写称呼", icon: "none" }); return; }

    this.setData({ saving: true });
    const op = this.data.recipientId
      ? recipientRepo.updateRecipient(this.data.recipientId, recipient)
      : recipientRepo.createRecipient(recipient);
    op.then(() => {
      this.setData({ saving: false });
      wx.showToast({ title: "已保存", icon: "success" });
      setTimeout(() => wx.navigateBack(), 350);
    }).catch(() => {
      this.setData({ saving: false });
      wx.showToast({ title: "保存失败", icon: "none" });
    });
  },
});
```

**「完成自动保存」的明确定义：** 用户点底部「完成」按钮即触发 `onSave`——校验称呼非空 → 组装 recipient 对象（始终包含 `personaTags`，可能为空数组）→ 新建走 `recipientRepo.createRecipient`、编辑走 `recipientRepo.updateRecipient(recipientId, patch)` → Promise resolve 后 `wx.navigateBack()` 回到列表页（列表页 `onShow` 自动重拉刷新）。除称呼外其余字段均非必填、缺省即空（repo 清洗后不落非空字段）。

`index.wxml`（结构示意，clay 风）：

```
<view class="page edit safe-bottom">
  <view class="edit__field">
    <text class="edit__label">称呼</text>
    <input class="edit__input" value="{{nickname}}" placeholder="给 TA 起个称呼" maxlength="30" bindinput="onNickname" />
  </view>

  <!-- 关系 / 性别 / 职业 / 风格：单选 chip 组 -->
  <view class="edit__field">
    <text class="edit__label">关系</text>
    <view class="chip-row">
      <view wx:for="{{relationOptions}}" wx:key="value"
            class="chip {{target==item.value ? 'chip--active' : ''}}"
            data-field="target" data-value="{{item.value}}" bindtap="pickSingle">{{item.label}}</view>
    </view>
  </view>
  <!-- gender / occupation / recipientStyle 同上，data-field 分别为 gender/occupation/recipientStyle -->

  <!-- 兴趣爱好 personaTags：多选 chip -->
  <view class="edit__field">
    <text class="edit__label">兴趣爱好（最多{{maxPersona}}个）</text>
    <view class="chip-row">
      <view wx:for="{{personaOptions}}" wx:key="value"
            class="chip {{personaTags.indexOf(item.value) >= 0 ? 'chip--active' : ''}}"
            data-value="{{item.value}}" bindtap="togglePersona">{{item.label}}</view>
    </view>
  </view>

  <view class="edit__field">
    <text class="edit__label">备注</text>
    <textarea class="edit__textarea" value="{{notes}}" maxlength="200"
              placeholder="可补充年龄、星座、生活环境等" bindinput="onNotes" />
  </view>

  <view class="edit__actions">
    <button class="dark-button" loading="{{saving}}" bindtap="onSave">完成</button>
  </view>
</view>
```

> `notes` 的 placeholder 必须正好是「可补充年龄、星座、生活环境等」（master C1）。`personaTags` 在 WXML 里用 `personaTags.indexOf(item.value) >= 0` 判断选中态——WXML 支持该表达式。

`index.wxss`：`.chip` 复用 guide `.guide__channel` 模式（pill、`var(--out-sm), var(--ins-neutral)`），`.chip--active` 用某 pastel 实色（如 `background:var(--rose); color:var(--on-rose); box-shadow:var(--out-md), var(--ins-rose);` + `transform:translateY(-2rpx)`）。`.chip-row{display:flex; flex-wrap:wrap; gap:16rpx;}`。`.edit__input`/`.edit__textarea` 用 `background:var(--surface); border-radius:var(--r-md); box-shadow:var(--ins-press); padding:...`（凹陷输入框）。`.dark-button`/`.ghost-button` 复制 question 页定义。chip 用 `<view>` 实现则无需 `::after` 去边；若用 `<button>` 需补 `::after{border:0;}`。

### 3.4 `miniprogram/pages/profile/index.js` + `index.wxml`（接线）

把「收礼人档案」行从 toast 改为跳转。最小改动：在 `openEntry` 里按 `value` 分流——`recipients` 走 `navigateTo`，其余仍 toast。需要 WXML 把 `value` 也传进来。

`index.wxml`（profile/index.wxml:7-13）给行加 `data-value="{{item.value}}"`：

```
<view ... data-title="{{item.title}}" data-value="{{item.value}}" bindtap="openEntry">
```

`index.js` 改 `openEntry`：

```js
openEntry(event) {
  const { title, value } = event.currentTarget.dataset;
  if (value === "recipients") {
    wx.navigateTo({ url: "/pages/contacts/index" });
    return;
  }
  wx.showToast({ title, icon: "none" });
},
```

`profile/index.wxss`、`index.json`、`onShow`(selectTab) 不变。「我的偏好」「历史推荐」仍 toast 占位（非本工作流范围）。

### 3.5 `miniprogram/pages/home/index.js`（联系人选择入口 · master C7）

> ⚠️ **协调（master C7）**：`pages/home/index.js` 也被 WS3 改动（新增 `openCard`）。本工作流**只**改 `startQuestionnaire` 这一处函数，不动 `openGuide`、`openCard`、「制作贺卡」按钮与样式；也不动 `index.wxml`/`index.wxss`。两者区域不重叠，3-way 合并无冲突。

按 C2：「开始选礼物」改为先进联系人**选择模式**（即 `pages/contacts?mode=pick`），由列表页内部完成「选用 → 带 prefill+skip 跳问卷」「新建 → contactEdit」「跳过/匿名送 → 无参问卷」三条出口。

`home/index.js` 改 `startQuestionnaire`（home/index.js:13-17）：

```js
startQuestionnaire() {
  wx.navigateTo({ url: "/pages/contacts/index?mode=pick" });
},
```

`onShow`/`onShareAppMessage`/`onShareTimeline`/`openGuide` 不动。

> 设计取舍：选择入口直接复用 `pages/contacts`（`mode=pick`）而非再做一个轻量 chooser，避免重复维护联系人列表 UI 与跳转逻辑。`mode=pick` 下隐藏删除、改点击为「选用」、并显示「跳过/匿名送」。选择器从 `recipientRepo.listRecipients()` 读联系人，与底层存储后端无关（master C8 与 C2/C3 的关系）。

### 3.6 `miniprogram/app.json`（追加页面，无云改动）

在 `pages` 数组末尾追加两条（追加式，勿动现有顺序）：

```json
"pages": [
  "pages/home/index",
  "pages/guide/index",
  "pages/question/index",
  "pages/result/index",
  "pages/shareMystery/index",
  "pages/shareProduct/index",
  "pages/profile/index",
  "pages/contacts/index",
  "pages/contactEdit/index"
]
```

`tabBar` / `window` / `cloud` 配置等不变（本迭代无云函数改动）。contacts/contactEdit 是 `navigateTo` 普通页，**不**进 tabBar、**不**进 `custom-tab-bar/index.js` 的 list（保持 2 tab：首页/我的）。

## 4. 边界与契约（适用的 master 契约）

### C1 — 联系人对象最终形态（本流程产出）

存储/返回的 recipient 形态（本流程负责的字段全集）：

```js
{
  recipientId,     // 既有，repo 客户端生成 rp_${Date.now()}_${rand}
  nickname,        // 称呼，text ≤ 30
  target,          // partner | parents | bestie
  gender,          // female | male
  occupation,      // office | tech | creative | medical_education | student | freelance | homemaker
  recipientStyle,  // practical | aesthetic | experiential | quality
  personaTags,     // 【新增·唯一结构化新字段】14 值枚举数组，最多 5
  notes,           // 自由文本 ≤ 200；年龄/星座/生活环境写这里
  createdAt,       // Date.now() 毫秒
  updatedAt,       // Date.now() 毫秒（list 按此倒序）
}
```

`personaTags` 14 值 + 中文标签（权威，表单与展示统一用这套）：
`tech_geek 数码极客` / `office_pro 职场人` / `creative 创意工作者` / `student 学生党` / `night_owl 夜猫子` / `homebody 宅家派` / `outdoorsy 户外控` / `fitness 健身党` / `coffee_tea 咖啡茶饮` / `foodie 吃货` / `pet_owner 养宠人` / `beauty_lover 美妆控` / `fandom_gamer 追星/游戏` / `bookish 文艺书虫`。

约束：不新建 interests 概念；不做 age/constellation/environment 结构化字段；personaTags **暂不进推荐打分**（本流程不碰 recommender）。**客户端清洗在 `recipientRepo` 内完成**（master C1/C8）：14 值枚举过滤、去重、最多 5、字段白名单、长度截断（nickname 30 / notes 200）、recipientId 客户端生成——逻辑等价于原云函数 `cleanRecipient`/`toPublicRecipient`，只是改在客户端跑；原云函数不动，未来切 CloudBase 时把同样清洗放回服务端即可。

### C8 — `recipientRepo` 存储抽象（本流程拥有；DB 切换点）

联系人所有读写都经过 `miniprogram/shared/recipientRepo.js`，接口 Promise 化：

```
listRecipients()                     // -> Promise<Recipient[]>（按 updatedAt 倒序）
createRecipient(input)               // -> Promise<{ recipientId }>
updateRecipient(recipientId, patch)  // -> Promise<void>
deleteRecipient(recipientId)         // -> Promise<void>
getRecipient(recipientId)            // -> Promise<Recipient|null>
```

本迭代 backend = 本地存储：`wx.getStorageSync`/`wx.setStorageSync`，key `songleme:recipients`，存整数组；`recipientId` = `rp_${Date.now()}_${rand}`；`createdAt/updatedAt` = `Date.now()`；同步操作 `Promise.resolve()` 包装。字段清洗在 repo 内完成（C1）。DB 切换点：上线前新增实现同接口的 backend 模块并改默认导出，页面零改动（实现见 §3.1）。

### C2 — 问卷入口契约（本流程跳转 → WS2 消费）

选用某联系人时，跳转 URL 严格为：

```
/pages/question/index?prefill=<encodeURIComponent(JSON.stringify(prefill))>&skip=<csv>
```

`prefill` 是部分 answers 对象，键用问卷 answer key，**只放被跳过的身份四题且有值的字段**（缺值的字段不要放进去）：

```json
{"target":"partner","gender":"female","occupation":"tech","recipientStyle":"practical"}
```

`buildPrefill(recipient)` 实现：从 recipient 取 `target/gender/occupation/recipientStyle`，逐个非空才写入，其余字段（nickname/personaTags/notes/createdAt/updatedAt）**不进 prefill**（C3：更丰富档案字段不进问卷）：

```js
function buildPrefill(recipient) {
  const prefill = {};
  ["target", "gender", "occupation", "recipientStyle"].forEach((k) => {
    if (recipient[k]) prefill[k] = recipient[k];
  });
  return prefill;
}
```

`skip` 固定 CSV 常量：`target,gender,occupation,recipientStyle`（不做 encodeURIComponent，逗号在 query 中安全；WS2 按逗号 split）。

「新建联系人」→ `wx.navigateTo('/pages/contactEdit/index')`。
「跳过 / 匿名送」→ `wx.navigateTo('/pages/question/index')`（无参，与今天行为一致）。

> WS2 负责解析 `prefill`/`skip`、预置 answers、从第一道未跳过题开始、返回时不回跳过题。本流程**只**保证 URL 与 JSON 格式正确，不依赖 WS2 内部实现。

### C3 — 身份题跳过集（共享常量）

跳过集恒为 `{ target, gender, occupation, recipientStyle }`，对应 `skip=target,gender,occupation,recipientStyle`。问卷只问情境题 `{ scene, budget, emotionalTags, visualStyle }`（由 WS2 维护）。本流程不把 personaTags 等档案字段塞进 prefill/skip。

### C7 — `pages/home/` 协调合并

本流程只改 `pages/home/index.js` 的 `startQuestionnaire` 一处（改为进 `/pages/contacts/index?mode=pick`），不动 `index.wxml`/`index.wxss`、不动 `openCard`（WS3 拥有）。区域不重叠，与 WS3 3-way 合并无冲突（实现见 §3.5）。

### repo 调用约定（本流程内部）

- 五个方法均返回 Promise；成功 resolve（`listRecipients` resolve 数组、`createRecipient` resolve `{recipientId}`、其余 resolve `undefined`/`null`），失败 reject（本地存储异常或非法 id）。
- 页面统一 `.then(...).catch(...)`：成功路径处理数据 + 跳转/toast，失败路径 toast「加载失败 / 保存失败 / 删除失败」。不再有「云函数返回 `{ok:false, code}`」概念——本地后端只有 resolve/reject 两态。

## 5. 边界情况与错误处理

- **本地存储读写异常**（极少见，如存储满）：repo `Promise.reject(err)`，页面 `.catch` 兜底 toast「加载失败 / 保存失败 / 删除失败」，不抛未捕获异常。
- **首次使用 / 存储为空**：`readAll()` 读不到 key 时返回 `[]`（非数组也归一为 `[]`），`listRecipients` resolve 空数组。管理模式下空列表 → 自动 `goCreate()` 进新建；选择模式（`mode=pick`）空列表**不**自动跳新建，正常展示「＋新建 / 跳过」两个入口，避免用户被强制建档。
- **杀进程重开后持久性**：`wx.setStorageSync` 数据持久化在本机，重启小程序后 `listRecipients` 仍读得到（与旧云方案的「换设备/清缓存即丢」差异——本地存储为单机持久，跨设备同步留待换库）。
- **称呼为空**：`onSave` 前置校验，toast「请填写称呼」并 return，不发起 repo 写入。`nickname` 前后空格由表单 `trim` + repo `cleanText` 双重处理。
- **personaTags 超 5**：表单 `togglePersona` 客户端拦截 toast「最多选5个」；repo `cleanEnumArray` 再次截断到 5（双保险）。非法/未知 tag 值被 repo 过滤丢弃。
- **清空全部 personaTags 后保存**：表单始终发送 `personaTags`（空数组），repo `cleanRecipient` 用 `hasOwnProperty` 命中 → 落库 `[]`，达成「可清空」。其它单选字段（target 等）若清成空字符串，因 repo `if (value)` 不写入，**update 无法把已有非空值清空**——这是沿用既有云函数 `cleanRecipient` 的行为，本流程不改；称呼同理（但有非空校验兜底）。如需支持清空这些单选字段，属于后续迭代，非本范围。
- **编辑模式取数失败 / 联系人已被删**：`recipientRepo.getRecipient(id)` resolve `null` 时 `loadOne` 静默不回填，表单按新建空表渲染；用户保存会走 `updateRecipient(recipientId, patch)`，repo `findIndex` 命中 -1 → resolve（无操作），等价于「无变更」。可接受。
- **删除二次确认取消**：`showModal` 返回 `confirm:false` 时不发起删除。删除按钮 `catchtap` 防止冒泡触发行点击。
- **重复 tag 值**：repo `cleanEnumArray` 用 `Set` 去重；客户端 `togglePersona` 本身不会产生重复。
- **prefill 缺字段**：某联系人未填 gender 时，`buildPrefill` 不写 gender，但 `skip` 仍固定含 gender——WS2 据 skip 跳过 gender 题，gender 不在最终 answers（推荐引擎对缺失维度按中性处理，符合既有引擎语义）。这是 C2/C3 的预期行为。
- **连点保存**：`saving` 标志 + 按钮 `loading` 防重复提交。
- **recipientId 碰撞**：`rp_${Date.now()}_${rand}`，同毫秒 + 6 位随机后缀碰撞概率极低；单机使用足够。换库后由 backend 的 id 策略接管。

## 6. 验收（微信开发者工具）

前置：用微信开发者工具打开项目。**本迭代无云函数部署步骤**——联系人全部走本地存储，不依赖登录/`getWXContext()`。

存储与清洗（可在「调试器 → Storage」面板查看 `songleme:recipients` 数组，或用 `wx.getStorageSync` 在 console 验证）：

1. **新建落库**：新建一个联系人（称呼「小鹿」、关系伴侣、性别女、职业技术、风格实用派、兴趣选数码极客/吃货/咖啡茶饮）→ Storage 面板 `songleme:recipients` 出现该条，含 `recipientId`(以 `rp_` 开头)、`createdAt`/`updatedAt`(13 位毫秒数)、`personaTags:["tech_geek","foodie","coffee_tea"]`。
2. **persona 清洗 ≤5/去重/丢非法**：可临时在 console 调 `require` 不便，改为表单层验证——连点选第 6 个兴趣 chip → toast「最多选5个」且选不中；已选项重复点 = 取消。（repo 层的去重/丢非法在单测或 console 直调 `recipientRepo.createRecipient({personaTags:["tech_geek","tech_geek","xxx_invalid","a","b","c","d","e"]})` 后查 Storage，应为去重+过滤+截断后 ≤5 的合法值、无 `xxx_invalid`、无重复。）
3. **持久性（关键）**：新建联系人后，在开发者工具点「编译」或真机**杀掉并重新打开**小程序 → 进「我的 → 收礼人档案」→ 之前的联系人仍在列表中（本地存储持久）。
4. **清空 personaTags**：编辑某条，取消全部兴趣 chip → 完成 → Storage 该条 `personaTags === []`（hasOwnProperty 语义生效）。
5. **不带 personaTags 的更新**：（console 直调）`recipientRepo.updateRecipient(id, {nickname:"新名"})` → Storage 该条 `nickname` 变化、`personaTags` 保持原值不变。
6. **倒序**：先后新建 A、B 两条，`listRecipients` / 列表展示中 B 在 A 之前（按 `updatedAt` 倒序）；编辑 A 后 A 跳到最前。

前端主流程：

7. 「我的 → 收礼人档案」→ 进 `pages/contacts`（管理模式）。首次空列表应自动跳到 `pages/contactEdit`（新建）。
8. 新建：填称呼、选关系/性别/职业/风格各一、选 3 个兴趣 chip、备注写「30岁，天秤座」→ 点「完成」→ toast「已保存」→ 自动返回列表，新建项出现，摘要含中文关系/职业、兴趣中文标签。
9. 编辑：点列表某项 → 进编辑页且各字段（含 personaTags chip 高亮、notes 文本）正确回显 → 改称呼 → 完成 → 列表更新。
10. 删除：点「删除」→ showModal 确认 → 列表移除（Storage 同步移除）；点取消 → 不变。点删除不应误触发进入编辑页（`catchtap` 生效）。
11. 主页入口：「开始选礼物」→ 进 `pages/contacts?mode=pick`（标题「送给谁」、有「跳过/匿名送」、无删除按钮、点行=选用）。
12. **C2 picker→prefill 往返**：在选择模式点一个联系人 → 跳 `/pages/question/index?prefill=...&skip=target,gender,occupation,recipientStyle`。在开发者工具「页面参数」里确认 `prefill` 解码后是仅含该联系人非空身份字段的 JSON（如 `{"target":"partner","gender":"female","occupation":"tech","recipientStyle":"practical"}`）、`skip` 为 `target,gender,occupation,recipientStyle` 四项 CSV，与 WS2 解析口径逐字一致。
13. **跳过/匿名送 path**：点该按钮 → 跳 `/pages/question/index`（无参），走完整问卷，与改动前行为一致。
14. 新建入口（选择模式）：点「＋新建联系人」→ 进 contactEdit；完成返回应回到 contacts（pick 模式）列表。
15. 标题/导航：contacts、contactEdit 不出现底部 tab，返回箭头正常；profile/home 仍是 tab 页。
16. `app.json` 两个新页面路径存在、可被 `navigateTo`，编译无「page not found」。

回归：确认「我的偏好」「历史推荐」仍是 toast；问卷无参流程（不经联系人）与改动前一致；确认未改动 `utils/cloud.js`、`cloudfunctions/manageRecipientProfile/`。

---

附：本规格仅改动 WS1 归属文件——新 `miniprogram/shared/recipientRepo.js`、新 `pages/contacts/`、新 `pages/contactEdit/`、`pages/profile/`(轻改)、`pages/home/index.js`(1 处函数)、`app.json`(追加)。**不触碰** `cloudfunctions/manageRecipientProfile/`、`utils/cloud.js`、`pages/question/`、recommender、giftDirections、questionnaire 配置。
