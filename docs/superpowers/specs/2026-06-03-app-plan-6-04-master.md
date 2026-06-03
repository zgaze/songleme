# 送了么 6-04 迭代总计划（Master Plan）

> 日期：2026-06-03 · 分支：`dev/app-plan-6-04`
> 本文件是**权威协调层**：定义 4 个可并行工作流的边界与跨流程契约。每个工作流有独立 spec（见末尾索引），但所有共享约定以本文件为准。子 agent 实现时若发现与本文件冲突，以本文件为准并回报。

## 目标

在现有系统基础上做四件相对独立的事：

1. **联系人（收礼人档案）** —— 单独维护送礼对象，避免每次问卷重复询问。
2. **问卷优化 + 心意/视觉标签 + 自定义输入** —— 扩充标签题，新增自定义输入能力。
3. **贺卡（MVP）** —— 主页入口，CSS 动画卡片 + Canvas 导出图片。先简单做。
4. **送礼攻略选题** —— 给现有攻略系统补充选题与文案大纲。

## 现状关键事实（已核实）

- 问卷 `questionnaire.config.json` 当前 **6 道单选**：`target → gender → scene → occupation → recipientStyle → budget`（线性，无分支）。**无** emotionalTags / visualStyle 题。
- 运行时推荐引擎 `recommender.js` / `localRecommender.js` 已支持并打分：target(22) / budget(18) / scene(16) / recipientStyle(12) / emotionalTags(10) / visualStyle(8) / preparationTime(8) / occupation(6) / gender(3)。**按精确枚举匹配**。
- 联系人后端**已存在但未接入**：云函数 `manageRecipientProfile`（list/create/update/delete）+ `recipients` 集合，字段 `nickname/target/gender/occupation/recipientStyle/notes`。客户端无任何页面调用它。
- 同样存在但未接入的云函数：`manageUserPreference`、`listRecommendationHistory`、`saveRecommendationFeedback`、`giftShare`。「我的」页 3 个入口当前都是 toast 占位。
- **兴趣爱好 = `personaTags`**：定义在 `schemas/gift-direction.schema.json:15-22`，14 值枚举：`tech_geek, office_pro, creative, student, night_owl, homebody, outdoorsy, fitness, coffee_tea, foodie, pet_owner, beauty_lover, fandom_gamer, bookish`。存在于 admin/gift-direction schema 与 DeepSeek 生成数据，**尚未接入运行时推荐引擎**（与「新属性仅存储展示」决策一致）。
- 送礼攻略**已完整实现**：`pages/guide/` + `miniprogram/shared/guideContent.js` + `schemas/guide-content.schema.json` + `scripts/validate-guide-content.js`。当前 5 个频道（鲜花/巧克力/穿戴/珠宝/关系阶段），每频道 1 篇。
- 贺卡：**全新**。代码库无任何 canvas 使用，无 @keyframes，仅有按钮 :active 过渡。主页当前 2 个按钮（开始选礼物 / 送礼攻略）。
- 现有数据持久化走 CloudBase；用户身份用微信 `_openid`（云函数侧 `cloud.getWXContext()`）。**本迭代 WS1 联系人改用本地存储 `wx.setStorageSync` + `recipientRepo` 抽象层**（DB 选型推迟到上线前，届时加一个实现同接口的 backend 模块即可换 SQLite/MySQL/CloudBase，见 C8）；现有 `manageRecipientProfile` 云函数本迭代**不改动**，保留为未来后端选项。注：小程序客户端无法直接跑 SQLite，真 SQLite 需服务端（云托管 CloudRun + 持久卷），故现阶段用本地存储占位。
- 礼物数据 3 处副本需同步：`miniprogram/shared/giftDirections.js`、`cloudfunctions/recommendGift/data/giftDirections.js`、admin/seed。（**实测约 33 个方向**，非旧文档「6 个」；client/server 两份运行时副本已核实逐字一致。）

## 工作流划分与文件归属

| # | 工作流 | 拥有/修改的文件 |
|---|--------|----------------|
| **WS1** | 联系人 | 新 `miniprogram/shared/recipientRepo.js`(本地存储后端)、新 `pages/contacts/`、新 `pages/contactEdit/`、`pages/profile/`、`pages/home/index.js`(协调·见 C7)、`app.json`(追加页面) |
| **WS2** | 问卷引擎与标签 | `questionnaire.config.json`(+`questionnaire.js` 重生成)、`schemas/questionnaire.schema.json`、`scripts/validate-questionnaire.js`、`pages/question/`、`recommender.js`、`localRecommender.js`、`giftDirections.js`×3(重打标签) |
| **WS3** | 贺卡 MVP | 新 `pages/card/`、新 `pages/cardEdit/`、新 `miniprogram/shared/cardTemplates.js`、`pages/home/`、`app.json`(追加页面) |
| **WS4** | 攻略选题 | `miniprogram/shared/guideContent.js`、`scripts/validate-guide-content.js`(运行) |

**并行安全**：交叠文件有两个，均按协调合并处理：(1) `app.json` 的 `pages` 数组（WS1、WS3 各自追加页面路径，追加式合并）；(2) `pages/home/index.js`（WS1 改 `startQuestionnaire`、WS3 加 `openCard`，区域不重叠，见 C7）。**问卷页 `pages/question/` 仅 WS2 拥有**；WS1 不改问卷页，只通过下方「问卷入口契约」传参。其余文件互不交叠。四个工作流可**同时**进行。

---

## 跨流程契约（权威，不可各自发挥）

### C1. 联系人对象最终形态（WS1 产出，WS2 消费）

```js
recipient = {
  recipientId,      // 既有
  nickname,         // 既有 — 称呼
  target,           // 既有 — 关系：partner|parents|bestie
  gender,           // 既有 — female|male
  occupation,       // 既有 — office|tech|creative|medical_education|student|freelance|homemaker
  recipientStyle,   // 既有 — practical|aesthetic|experiential|quality
  personaTags,      // 【新增·唯一结构化新字段】— 兴趣爱好+生活环境，复用 14 值枚举，最多 5
  notes,            // 既有 — 自由文本；年龄/星座/生活环境补充都写进这里
}
```

- `personaTags` 复用 `schemas/gift-direction.schema.json` 的 14 值枚举。**不新建 interests 概念**。
- 年龄/星座/生活环境**不做结构化字段**，并入 `notes`（编辑表单 placeholder 提示「可补充年龄、星座、生活环境等」）。
- personaTags 中文标签（WS1 表单 + 未来展示统一用这套）：
  `tech_geek 数码极客` / `office_pro 职场人` / `creative 创意工作者` / `student 学生党` / `night_owl 夜猫子` / `homebody 宅家派` / `outdoorsy 户外控` / `fitness 健身党` / `coffee_tea 咖啡茶饮` / `foodie 吃货` / `pet_owner 养宠人` / `beauty_lover 美妆控` / `fandom_gamer 追星/游戏` / `bookish 文艺书虫`
- **存储层（本迭代）**：字段清洗由客户端 `recipientRepo` 负责（见 C8）——按 14 值枚举过滤 `personaTags`（去重、最多 5）、字段白名单、长度截断、`recipientId` 客户端生成。逻辑等价于原云函数 `cleanRecipient`/`toPublicRecipient`，只是改在客户端跑；原云函数不动，未来切 CloudBase 时把同样清洗放回服务端即可。
- **personaTags 暂不进推荐打分**（决策：新属性仅存储展示）。

### C2. 问卷入口契约（WS1 跳转 → WS2 消费）

主页「开始选礼物」改为先进入**联系人选择**（WS1 的 picker）：
- 选中某联系人 → `wx.navigateTo('/pages/question/index?prefill=<encodeURIComponent(JSON)>&skip=<csv>')`
- 「新建联系人」→ 进 WS1 的 contactEdit 流程
- 「跳过 / 匿名送」→ `/pages/question/index`（无参数，走完整问卷，与今天行为一致）

`prefill` 是部分 answers 对象，键用问卷 answer key：
```json
{"target":"partner","gender":"female","occupation":"tech","recipientStyle":"practical"}
```
`skip` 固定为 `target,gender,occupation,recipientStyle`（见 C3）。

**WS2 问卷页职责**：解析 `prefill`/`skip` → 预置 answers → 从第一道**未跳过**的题开始；返回上一题时**不得**回到被跳过的题；最终 answers 仍包含被预填的字段（推荐引擎照常使用）。无参数时行为不变。

### C3. 身份题跳过集（WS1↔WS2 共享常量）

选中联系人时跳过：`{ target, gender, occupation, recipientStyle }`。
问卷仅询问情境题：`{ scene, budget, emotionalTags, visualStyle }`。
（personaTags 等更丰富的档案字段不进问卷，与「仅存储展示」一致。）

### C4. 标签词表扩充（WS2 拥有；value id 固定，标签文案可微调）

新增题统一为 **multi-select**，建议 `max: 3`，`allowCustom: true`。

**emotionalTags（5 → 12）** value:label：
- 既有：`romantic 浪漫表达` / `company 陪伴感` / `care 贴心实用` / `surprise 有惊喜` / `memory 纪念感`
- 新增：`gratitude 感恩感谢` / `encourage 鼓励打气` / `healing 治愈解压` / `playful 有趣好玩` / `prestige 有面子` / `sincere 走心用心` / `ritual 仪式感`

**visualStyle（5 → 10）** value:label：
- 既有：`minimal 简洁耐看` / `warm 温柔治愈` / `delicate 包装精美` / `tech 科技感` / `classic 质感高级`
- 新增：`cute 可爱有趣` / `retro 复古怀旧` / `natural 自然清新` / `elegant 优雅气质` / `festive 节日氛围`

**同步要求**：新增 value 必须同时出现在
1. `questionnaire.config.json`（+重生成 `questionnaire.js`）；
2. 两个 recommender 的 `ANSWER_OPTIONS` 及相关 tag 映射；
3. `giftDirections.js` ×3 —— 给现有礼物方向（**实测约 33 个**，旧文档「6 个」为陈旧说法）**重打标签**，让新 value 至少各被若干礼物覆盖，否则新标签恒 0 分。

### C5. 自定义输入与 config 驱动的冲突解决（WS2 拥有）

冲突本质：推荐引擎按精确枚举匹配，自由文本匹配不到 → 静默 0 分。解决方案（保持 config 驱动，不 hack）：

1. **schema 形式化**：`questionnaire.schema.json` 题级新增可选 `allowCustom: boolean`（默认 false）。校验器 `validate-questionnaire.js` 允许该字段，并对自定义值跳过分支/枚举校验。
2. **问卷页**：`allowCustom` 为真时渲染「＋自定义」chip，点开文本输入；自定义值以**自由文本**追加进答案数组（多选）或作为答案（单选）。
3. **推荐引擎容错**：已知枚举值照常打分；未知自定义值（a）保留在 payload 供结果文案/未来 LLM 用，（b）作为子串**软匹配** gift 的 `searchKeywords`/`tags`/`highlights`，命中给小额加分（建议 +4）。确定性引擎不被破坏。
4. 默认对 `emotionalTags`、`visualStyle` 开启 `allowCustom`；其余题是否开启由 WS2 spec 决定（默认关闭以控范围）。

### C6. 文件同步铁律

- 改 `questionnaire.config.json` 后必须 `node scripts/validate-questionnaire.js --write-runtime` 重生成 `questionnaire.js`（不可手改 runtime）。
- recommender 改动 server + client **两份**保持一致。
- 礼物数据改动 `giftDirections.js` **3 份**保持一致。
- 改 guide 内容后跑 `node scripts/validate-guide-content.js`。
- `app.json` 新增页面：WS1 加 `pages/contacts/index`、`pages/contactEdit/index`；WS3 加 `pages/card/index`、`pages/cardEdit/index`。

### C7. `pages/home/` 协调合并（WS1 ⇄ WS3，第二个交叠文件）

`pages/home/index.js` 被两个工作流改动，但**区域不重叠**，按协调合并处理（同 `app.json`）：

- **WS1 拥有**：`index.js` 的 `startQuestionnaire()` 处理函数——把「开始选礼物」从直接跳问卷改为先进联系人选择（`/pages/contacts/index?mode=pick`，见 C2）。仅此一处，不动 `index.wxml`/`index.wxss`。
- **WS3 拥有**：`index.js` 新增 `openCard()` 方法 + `index.wxml` 新增「制作贺卡」按钮 + `index.wxss` 新增 `.home-button--card` 样式。
- 两者改不同函数/元素，3-way 合并无冲突。**执行建议**：若 WS1/WS3 在隔离 worktree 并行，最后单独合并 `pages/home/`；若同树并行，把 `pages/home/index.js` 的两处改动收尾时串行落地。

### C8. `recipientRepo` 存储抽象（WS1 拥有；DB 切换点）

联系人所有读写都经过 `miniprogram/shared/recipientRepo.js`，接口 **Promise 化**（便于日后换异步云后端，页面代码不必改）：

```js
listRecipients()                 // -> Promise<Recipient[]>（按 updatedAt 倒序）
createRecipient(input)           // -> Promise<{ recipientId }>
updateRecipient(recipientId, patch)  // -> Promise<void>
deleteRecipient(recipientId)     // -> Promise<void>
getRecipient(recipientId)        // -> Promise<Recipient|null>（contactEdit 编辑态用）
```

- 本迭代默认 backend = **本地存储**：`wx.getStorageSync`/`wx.setStorageSync`，key `songleme:recipients`，存整数组；`recipientId` 用 `rp_${Date.now()}_${rand}` 客户端生成；`createdAt/updatedAt` 用 `Date.now()`。本地同步操作用 `Promise.resolve()` 包装以符合异步接口。
- 字段清洗（C1）在 repo 内完成，页面不重复校验。
- **DB 切换点**：上线前换库 = 新增一个实现上述接口的 backend 模块（如 `recipientRepo.cloud.js`）并改 `recipientRepo.js` 的默认导出，`pages/contacts`/`pages/contactEdit`/选择器代码零改动。
- 与 C2 的关系：选择器从 `recipientRepo.listRecipients()` 读联系人，再据所选 recipient 拼 `prefill`/`skip`——存储后端是什么不影响 C2/C3 契约。

---

## 执行方式

四个工作流无顺序依赖，可并行。唯一软依赖：WS1 与 WS2 共用 C2/C3 契约——双方都按本文件契约编码即可独立推进（WS1 只管跳转传参，WS2 只管解析消费）。`app.json` 追加合并最后统一核对。

每个工作流完成后各自验证（见各 spec 的「验收」），最后整体在微信开发者工具里跑一遍主流程回归。

## Spec 索引

- WS1 联系人 → `2026-06-03-ws1-contacts.md`
- WS2 问卷引擎与标签 → `2026-06-03-ws2-questionnaire-tags.md`
- WS3 贺卡 MVP → `2026-06-03-ws3-greeting-card.md`
- WS4 攻略选题 → `2026-06-03-ws4-guide-topics.md`
