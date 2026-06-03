# WS2 问卷引擎与标签 — 实现规格

> 日期：2026-06-03 · 分支：`dev/app-plan-6-04` · 工作流：WS2
> 上位文档：`docs/superpowers/specs/2026-06-03-app-plan-6-04-master.md`（契约 C2/C3/C4/C5/C6 以 master 为准）

## 1. 目标与范围

本工作流做四件事：

1. **扩充标签题**：新增两道多选题 `emotionalTags`（心意标签）、`visualStyle`（视觉/风格标签），词表按 master C4 扩充（emotionalTags 5→12，visualStyle 5→10），并接入问卷分支：`budget → emotionalTags → visualStyle → result`。
2. **自定义输入能力**：题级新增 `allowCustom` 能力（schema + 校验器 + 问卷页 UI），默认对上述两道标签题开启。用户可输入自由文本作为答案值。
3. **问卷入口契约消费**：问卷页 `pages/question/` 解析 master C2/C3 的 `prefill`/`skip` query 参数，预置身份题答案并从第一道未跳过题开始；返回上一题不得回到被跳过的题；无参数时行为与今天完全一致。
4. **推荐引擎容错**（master C5）：两个 recommender 同步新词表到 `ANSWER_OPTIONS` 与 tag 映射；已知枚举照常打分；未知自定义值（a）保留在 payload，（b）对 gift 的 `searchKeywords`/`tags`/`highlights` 做子串软匹配，命中 +4。同时给现有礼物方向重打 emotionalTags/visualStyle 标签，确保每个新 value 至少被若干礼物覆盖。

### 拥有/修改的文件（不得越界）

- `miniprogram/shared/questionnaire.config.json`（+ 重生成 `miniprogram/shared/questionnaire.js`）
- `schemas/questionnaire.schema.json`
- `scripts/validate-questionnaire.js`
- `miniprogram/pages/question/index.{js,wxml,wxss,json}`（**此页仅 WS2 拥有**）
- `cloudfunctions/recommendGift/lib/recommender.js`
- `miniprogram/shared/localRecommender.js`
- `miniprogram/shared/giftDirections.js` + `cloudfunctions/recommendGift/data/giftDirections.js` + `data/gift-directions.seed.json`（3 份同步，见 C6 与 §3.7）
- `docs/questionnaire-config.md`、`docs/questionnaire-branching.md`（按需更新）

### 非目标（明确不做）

- 不改主页「开始选礼物」入口（WS1 负责跳转传参）。问卷页只**消费** `prefill`/`skip`，不发起。
- 不改结果页 `pages/result/`（已正确把整个 answers 对象透传给两个 recommender，见 §4 验证依据）。
- 不接入 `personaTags` 进问卷或推荐打分（master 决策：仅存储展示，WS1 范畴）。
- 不改 `preparationTime` 相关逻辑（当前 config 无此题；保持现状，分支不引入它）。
- 不做后端 LLM 调用；自定义值仅做确定性软匹配 + 保留 payload。

## 2. 现状（已核实）

- **问卷 config**（`miniprogram/shared/questionnaire.config.json`）当前 6 道单选，线性无分支：`target → gender → scene → occupation → recipientStyle → budget`，`budget.defaultNext = "result"`。**没有** emotionalTags / visualStyle 题。`version` 为 `"2026-05-30-candidate-v2"`。
- **运行时** `questionnaire.js` 由 `scripts/validate-questionnaire.js --write-runtime` 生成，导出 `QUESTIONNAIRE_CONFIG / QUESTIONS / RESULT_NODE / START_QUESTION_ID`。不可手改。
- **schema**（`schemas/questionnaire.schema.json`）draft-07，`question` 定义 `additionalProperties:false`，当前允许 `id/title/type/defaultNext/max/options`，**无** `allowCustom`。`option` 定义也是 `additionalProperties:false`。
- **校验器**（`scripts/validate-questionnaire.js`）手写校验（不依赖 schema 文件做运行时校验）。`getEdges`（L227）算分支：single 取每个 option 的 `next||defaultNext`，multi 只取 `defaultNext`。会做：可达性、循环、到 result 的路径、`option.value` 唯一、multi 的 `option.next` 报错、`max` 不超过选项数、runtime 同步检查。**当前不存在 enum/分支对自定义值的豁免逻辑**（因为现在没有自定义值）。
- **问卷页**（`pages/question/index.js`）已是 config 驱动：
  - `onLoad()`（L24）只调 `this.setQuestion(START_QUESTION_ID, [])`，**不读 query 参数**。
  - 单选 `selectOption`（L90）自动 persist + `goNext`；多选累积 `selectedValues`，受 `current.max` 限制，手动点「下一步」走 `goNext`（L143）。
  - `showNextButton = question.type === "multi"`（L38），即多选题已渲染手动「下一步」按钮。**所以加多选题不需要额外页面代码，除了自定义输入 UI。**
  - `getNextQuestionId`（L65）按 single 的 `option.next||defaultNext`、multi 的 `defaultNext` 求下一题；`normalizeNextQuestionId`（L79）把 `result`/未知题归一为 `""`（结束）。
  - `pruneAnswers`（L205）/`getVisibleQuestionIds`（L216）从 `START_QUESTION_ID` 沿当前 answers 走一遍可见链，**只保留可见题的答案** → 这是「回退改答案后剔除失效分支」的机制。
  - `goNext`（L159）在无下一题时 `encodeURIComponent(JSON.stringify(this.data.answers))` 跳 `/pages/result/index?answers=...`。
  - `answers` 形态：单选存字符串（`selectedValues[0]`），多选存数组（`selectedValues`）。见 `persistCurrentAnswer`（L171）/`persistAnswer`（L183）。
- **问卷页 JSON**（`pages/question/index.json`）仅 `navigationBarTitleText`。
- **两个 recommender** 当前 `ANSWER_OPTIONS`（recommender.js L8 / localRecommender.js L5）含：`emotionalTags: ["romantic","company","care","surprise","memory"]`、`visualStyle: ["minimal","warm","delicate","tech","classic"]`。打分权重一致：target 22 / budget 18 / scene 16 / recipientStyle 12 / emotionalTags 10 / visualStyle 8 / preparationTime 8 / occupation 6 / gender 3。`normalizeValues`（L91/L88）按 `ANSWER_OPTIONS` 白名单**丢弃**未知值 → 自定义自由文本目前会被静默丢掉（这正是 C5 要修的）。`scoreGift`/`hardFilter`/`buildGiftTags` 按精确枚举匹配。两个文件逻辑实质相同。
- **礼物数据**：3 处副本——
  - `miniprogram/shared/giftDirections.js`（客户端）
  - `cloudfunctions/recommendGift/data/giftDirections.js`（服务端，与客户端**逐字相同**，已核实 `diff` 无差异）
  - `data/gift-directions.seed.json`（种子，**snake_case** 字段：`gift_direction/budget_range/preparation_time/emotional_tags/visual_style_tags/risk_tags/recommend_reason`；JSON 顶层是数组；不被运行时消费）
  - 实际共 **33 个礼物方向**（master 写「6 个」是早期描述，以代码为准——33 个）。当前 emotionalTags 仅用到 5 个旧值，visualStyle 仅用到 5 个旧值；**新值全部 0 覆盖**。
  - 礼物对象当前**没有** `searchKeywords` 字段、`tags` 字段；有 `highlights`（数组，中文短词）、`pairingTags`、`riskTags`。`tags` 是 recommender 在输出时动态生成的（`buildGiftTags`），不是数据字段。
- **结果页** `pages/result/index.js`：`onLoad` 解析 `options.answers`（`JSON.parse(decodeURIComponent)`），把整个 answers 对象传给 `recommendGift`/`recommendLocally`。**因此被预填的字段只要进入最终 answers，就会被推荐引擎照常使用**——问卷页只需保证最终 answers 含预填字段即可。

## 3. 改动清单（逐文件）

### 3.1 `miniprogram/shared/questionnaire.config.json`

(1) 把 `budget` 题的 `defaultNext` 从 `"result"` 改为 `"emotionalTags"`。

(2) 在 `budget` 题之后、`questions` 数组末尾追加两道题（顺序：emotionalTags 在前，visualStyle 在后）：

```json
{
  "id": "emotionalTags",
  "title": "想表达什么心意",
  "type": "multi",
  "max": 3,
  "allowCustom": true,
  "defaultNext": "visualStyle",
  "options": [
    { "value": "romantic", "label": "浪漫表达" },
    { "value": "company", "label": "陪伴感" },
    { "value": "care", "label": "贴心实用" },
    { "value": "surprise", "label": "有惊喜" },
    { "value": "memory", "label": "纪念感" },
    { "value": "gratitude", "label": "感恩感谢" },
    { "value": "encourage", "label": "鼓励打气" },
    { "value": "healing", "label": "治愈解压" },
    { "value": "playful", "label": "有趣好玩" },
    { "value": "prestige", "label": "有面子" },
    { "value": "sincere", "label": "走心用心" },
    { "value": "ritual", "label": "仪式感" }
  ]
}
```

```json
{
  "id": "visualStyle",
  "title": "偏好什么风格",
  "type": "multi",
  "max": 3,
  "allowCustom": true,
  "defaultNext": "result",
  "options": [
    { "value": "minimal", "label": "简洁耐看" },
    { "value": "warm", "label": "温柔治愈" },
    { "value": "delicate", "label": "包装精美" },
    { "value": "tech", "label": "科技感" },
    { "value": "classic", "label": "质感高级" },
    { "value": "cute", "label": "可爱有趣" },
    { "value": "retro", "label": "复古怀旧" },
    { "value": "natural", "label": "自然清新" },
    { "value": "elegant", "label": "优雅气质" },
    { "value": "festive", "label": "节日氛围" }
  ]
}
```

- value id 必须**逐字**用 master C4（不可改 id；label 文案可微调但建议照用上表）。
- 不给 option 写 `size`，让问卷页自动分配（10/12 选项时页面已有 `getAutoOptionSize` 逻辑）。
- 改完**必须**重生成：`node scripts/validate-questionnaire.js --write-runtime`（见 §6）。

(3) 可选：把 `version` 升为 `"2026-06-03-tags-v3"`（便于追踪；不强制）。

### 3.2 `schemas/questionnaire.schema.json`

在 `definitions.question.properties` 中新增可选布尔字段（`additionalProperties:false`，必须显式声明否则带 `allowCustom` 的 config 会被 JSON Schema 工具判非法）：

```json
"allowCustom": { "type": "boolean" }
```

加在 `max` 与 `options` 之间即可。不进 `required`，默认视为 false。`option` 定义不动。

### 3.3 `scripts/validate-questionnaire.js`

校验器是手写的，需要：

(1) **允许 `allowCustom` 字段**：在 question 字段校验段（约 L73–L90，`question.max` 校验之后、`options` 校验之前）加：

```js
if (question.allowCustom !== undefined && typeof question.allowCustom !== "boolean") {
  addIssue(errors, `${prefix}.allowCustom must be a boolean.`);
}
```

(2) **对自定义值跳过分支/枚举校验**：当前校验器**不做** option.value 的 enum 校验（它只查 value 唯一性），分支只看 `option.next`/`defaultNext`（题级），与 option.value 无关。因此 `allowCustom` 不会引入新的分支/枚举冲突——**不需要**额外豁免逻辑。但为符合 master C5「校验器对自定义值跳过分支/枚举校验」的意图，明确在代码注释里说明：自定义值是运行时由用户输入的自由文本，不出现在 config 的 options 里，故不参与任何 config 期校验。**实现上仅需 (1)**；不要为「自定义值」在 config 里加占位 option。

(3) runtime 重生成逻辑（`buildRuntimeSource` / `--write-runtime`）无需改动——它整体序列化 config，`allowCustom` 会自动带进 `questionnaire.js`。

### 3.4 `miniprogram/pages/question/index.json`

无需改动（除非新增题需要更长标题；当前 `navigationBarTitleText:"选礼物"` 够用）。

### 3.5 `miniprogram/pages/question/index.js` — prefill/skip 消费（master C2/C3）

**目标**：解析 query → 预置 answers → 从第一道未跳过题开始 → 回退不进跳过题 → 最终 answers 含预填字段。无参数时零行为变化。

(1) 新增模块级常量（顶部，紧随 require 之后）：

```js
const SKIPPABLE_IDS = ["target", "gender", "occupation", "recipientStyle"]; // master C3
```

(2) `data` 中新增字段用于自定义输入 UI（§3.6 用）与跳过集合：

```js
data: {
  // ...既有字段...
  skipIds: [],          // 本次会话被跳过的题 id（来自 query.skip ∩ 已预填）
  customInputVisible: false,
  customInputValue: "",
}
```

(3) **改写 `onLoad(options)`**（替换现有 L24–26）：

```js
onLoad(options) {
  const prefill = this.parsePrefill(options && options.prefill);
  const skipIds = this.parseSkip(options && options.skip).filter(
    (id) => prefill[id] !== undefined && prefill[id] !== null && prefill[id] !== ""
  );
  // 预置答案（单选字段存字符串，与既有 answers 形态一致）
  this.setData({ answers: { ...prefill }, skipIds });
  this.setQuestion(this.getFirstQuestionId(skipIds), []);
},

parsePrefill(raw) {
  // 注：此处 decodeURIComponent 是**有意冗余**——小程序 onLoad options 已自动解码一次。
  // 与结果页 pages/result 解析 answers 的写法保持一致；因 prefill 仅含 ASCII 枚举值
  // (target/gender/occupation/recipientStyle)，二次解码是无害 no-op。
  // 若未来 prefill 可能携带含 % 的值，应去掉内层 decodeURIComponent，直接 JSON.parse 已解码串。
  if (!raw) return {};
  try {
    const obj = JSON.parse(decodeURIComponent(raw));
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  } catch (e) {
    return {};
  }
},

parseSkip(raw) {
  if (!raw) return [];
  return decodeURIComponent(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
},

// 沿可见链找第一道不在 skipIds 里的题
getFirstQuestionId(skipIds) {
  let question = QUESTION_BY_ID[START_QUESTION_ID];
  let guard = 0;
  while (question && guard < QUESTIONS.length) {
    if (skipIds.indexOf(question.id) < 0) return question.id;
    const values = this.getSelectedValuesFromAnswers(question, this.data.answers);
    const nextId = this.getNextQuestionId(question, values, this.data.answers);
    if (!nextId) break;
    question = QUESTION_BY_ID[nextId];
    guard += 1;
  }
  return START_QUESTION_ID;
},
```

说明：预填值参与 `getNextQuestionId`，因此沿链跳过逻辑天然正确（被跳过的身份题都有预填答案，可正常算出下一题）。

(4) **`goBack`（L124）防止回到被跳过的题**：当前 `goBack` 用 `history` 栈，被跳过的题从不会入栈（因为 `goNext` 只在前进时 `history.concat(current.id)`，而我们从第一道未跳过题开始）。**唯一边界**：`history` 为空时回退要回到入口而非起点题。当前逻辑（`history` 空 → `navigateBack`/`switchTab`）已正确，无需改。**但**为保险，在 `goBack` 取 `previousQuestionId` 后加一道防御：若该 id 在 `skipIds` 中（理论上不会发生），继续向更早的 history 回退或直接 `navigateBack`：

```js
goBack() {
  const { history, skipIds } = this.data;
  if (!history.length) {
    if (getCurrentPages().length > 1) { wx.navigateBack(); return; }
    wx.switchTab({ url: "/pages/home/index" }); return;
  }
  let idx = history.length - 1;
  while (idx >= 0 && skipIds.indexOf(history[idx]) >= 0) idx -= 1; // 跳过被 skip 的题
  if (idx < 0) {
    if (getCurrentPages().length > 1) { wx.navigateBack(); return; }
    wx.switchTab({ url: "/pages/home/index" }); return;
  }
  this.setQuestion(history[idx], history.slice(0, idx));
},
```

(5) **`pruneAnswers` 保留预填字段**：`pruneAnswers`（L205）按 `getVisibleQuestionIds` 过滤，从 `START_QUESTION_ID` 沿链走。**关键**：预填的身份题（target/gender/occupation/recipientStyle）本就在可见链上（它们是问卷前段的题，只是被 skip 没展示），其答案已在 `this.data.answers` 里，`getVisibleQuestionIds` 会把它们算作可见 → 不会被剔除。因此最终 answers 仍含预填字段，**无需改 `pruneAnswers`**。务必在自测时确认（§6 步骤 4）。

> 实现注意：`getVisibleQuestionIds` 在 single 题用 `getNextQuestionId` 求链，对预填的 single 身份题它能正确取到 `option.next||defaultNext`。确保预填值是合法 option.value（WS1 保证传合法值；非法值会导致该题 `getNextQuestionId` 走 `defaultNext`，仍可达 result，不致命）。

### 3.6 `miniprogram/pages/question/index.{js,wxml,wxss}` — 自定义输入 UI（master C5 第 2 点）

仅当 `current.allowCustom === true` 时渲染「＋自定义」chip + 文本输入。自定义值以**自由文本**追加进 answers：多选题 → push 进数组；单选题 → 作为单值（本期两道题都是 multi，但代码按通用处理）。

**index.wxml**：在 `question__options`（L17 之后）与 `question__footer`（L19）之间插入：

```html
<view wx:if="{{current.allowCustom}}" class="question__custom">
  <view wx:if="{{!customInputVisible}}" class="custom-chip" bindtap="openCustomInput">＋ 自定义</view>
  <view wx:else class="custom-input-row">
    <input
      class="custom-input"
      type="text"
      value="{{customInputValue}}"
      placeholder="输入你的标签"
      maxlength="12"
      confirm-type="done"
      bindinput="onCustomInput"
      bindconfirm="addCustomValue"
    />
    <button class="custom-add" bindtap="addCustomValue">添加</button>
  </view>
</view>
```

说明：已添加的自定义值会作为 `current.options` 里的一项渲染出来（见下 `buildQuestionState` 改动），与内置选项一致显示/可取消选择，因此不需要单独的「已添加 chips」列表。

**index.js** 新增方法 + 改动：

(a) 自定义值需要进入 `current.options` 才能在格子里显示并可被取消。改 `buildQuestionState`（L45）使其把「不在 config options 里、但出现在 selectedValues 里的值」也渲染为 option：

```js
buildQuestionState(question, selectedValues) {
  const baseValues = question.options.map((o) => o.value);
  const customOptions = (selectedValues || [])
    .filter((v) => baseValues.indexOf(v) < 0)
    .map((v) => ({ value: v, label: v, _custom: true }));
  const allOptions = question.options.concat(customOptions);
  return {
    ...question,
    options: allOptions.map((option, index) => ({
      ...option,
      selected: selectedValues.indexOf(option.value) >= 0,
      shapeClass: `option--shape-${index % 6}`,
      sizeClass: `option--size-${option.size || this.getAutoOptionSize(allOptions.length, index)}`,
    })),
  };
},
```

(b) 新增方法：

```js
openCustomInput() {
  this.setData({ customInputVisible: true, customInputValue: "" });
},

onCustomInput(e) {
  this.setData({ customInputValue: e.detail.value });
},

addCustomValue() {
  const raw = (this.data.customInputValue || "").trim();
  if (!raw) { wx.showToast({ title: "先输入内容", icon: "none" }); return; }
  const { current, selectedValues } = this.data;
  // 去重：与已选/内置 option 同名则忽略
  if (selectedValues.indexOf(raw) >= 0) {
    this.setData({ customInputVisible: false, customInputValue: "" });
    return;
  }
  if (current.type === "multi" && current.max && selectedValues.length >= current.max) {
    wx.showToast({ title: `最多选${current.max}个`, icon: "none" });
    return;
  }
  const nextValues = current.type === "multi" ? selectedValues.concat(raw) : [raw];
  // 单选自定义：直接当作选中并前进；多选：累积等用户点下一步
  if (current.type === "single") {
    this.persistAnswer(nextValues, () => setTimeout(() => this.goNext(), 140));
    this.setData({ customInputVisible: false, customInputValue: "" });
    return;
  }
  this.setData({
    selectedValues: nextValues,
    current: this.buildQuestionState(current, nextValues),
    customInputVisible: false,
    customInputValue: "",
  });
},
```

(c) 在 `setQuestion`（L28）的 `setData` 里重置自定义输入态（避免切题残留）：把 `isAdvancing: false,` 同级加上 `customInputVisible: false, customInputValue: "",`。

(d) `selectOption` 对自定义 option（`_custom:true`）走与普通 option 完全相同的多选 toggle 分支——已存在的 `selectOption`（L90）按 `data-value` 处理，自定义 option 也带 `data-value`，取消选择时它会从 `selectedValues` 移除，下次 `buildQuestionState` 不再生成该 customOption，自然消失。无需特判。

**最终答案中自定义值的存储**：与内置值同质——多选题答案数组里直接是字符串（如 `["romantic","公司团建氛围"]`），单选题答案是该字符串。`pruneAnswers` 不动它（按题 id 保留整个值）。

**index.wxss**：新增样式（贴合现有 claymorphism；放文件末尾）：

```css
.question__custom {
  width: 100%;
  display: flex;
  justify-content: center;
  margin-top: 8rpx;
  margin-bottom: 12rpx;
}
.custom-chip {
  padding: 14rpx 30rpx;
  border-radius: var(--r-pill);
  background: var(--surface);
  color: var(--text-2);
  font-size: var(--fs-sm);
  box-shadow: var(--out-md), var(--ins-neutral);
}
.custom-input-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  width: 100%;
  max-width: 520rpx;
}
.custom-input {
  flex: 1;
  height: 72rpx;
  padding: 0 24rpx;
  border-radius: var(--r-pill);
  background: var(--surface);
  color: var(--text);
  font-size: var(--fs-sm);
  box-shadow: var(--ins-press);
}
.custom-add {
  min-width: 120rpx;
  height: 72rpx;
  line-height: 72rpx;
  border-radius: var(--r-pill);
  background: var(--rose);
  color: var(--on-rose);
  font-size: var(--fs-sm);
  font-weight: 600;
  box-shadow: var(--out-md), var(--ins-rose);
}
.custom-add::after { border: 0; }
```

> 布局注意：`question__options` 当前 `flex:1` 占满中段，`question__footer` 是 fixed。新插入的 `question__custom` 在普通文档流中，会出现在选项区与 footer 之间，footer 是 fixed 不挤压，正常。若视觉拥挤，可把 `question__options` 的 `flex:1` 在有自定义时保持不变（无需改）。

### 3.7 两个 recommender — 词表同步 + 自定义软匹配（master C5 第 3 点）

对 **`cloudfunctions/recommendGift/lib/recommender.js`** 与 **`miniprogram/shared/localRecommender.js`** 做**完全相同**的改动：

(1) **扩 `ANSWER_OPTIONS`**（recommender.js L16-17 / localRecommender.js L13-14）：

```js
emotionalTags: ["romantic","company","care","surprise","memory","gratitude","encourage","healing","playful","prestige","sincere","ritual"],
visualStyle: ["minimal","warm","delicate","tech","classic","cute","retro","natural","elegant","festive"],
```

(2) **扩 tag 文案映射**（用于 `buildGiftTags` 输出的中文标签）：
- `TAG_BY_EMOTION`（L69 / L66）补：`gratitude:"感恩感谢", encourage:"鼓励打气", healing:"治愈解压", playful:"有趣好玩", prestige:"有面子", sincere:"走心用心", ritual:"仪式感"`。
- `TAG_BY_STYLE`（L57 / L54）补 visualStyle 新值：`cute:"可爱有趣", retro:"复古怀旧", natural:"自然清新", elegant:"优雅气质", festive:"节日氛围"`。

(3) **保留自定义值（payload）**：`normalizeAnswers`（L77 / L74）当前用 `normalizeValues` 按白名单过滤，会丢弃自定义文本。改为**分离已知值与自定义值**：

```js
function normalizeAnswers(rawAnswers) {
  const source = (rawAnswers && typeof rawAnswers === "object" && !Array.isArray(rawAnswers)) ? rawAnswers : {};
  const answers = {};
  const custom = {}; // field -> [自定义自由文本]
  Object.keys(ANSWER_OPTIONS).forEach((field) => {
    const allowed = new Set(ANSWER_OPTIONS[field] || []);
    const aliases = VALUE_ALIASES[field] || {};
    const known = normalizeValues(field, source[field]);
    if (known.length) answers[field] = known;
    // 收集既不在 allowed、也无 alias 命中的原始字符串作为自定义值
    const customVals = toArray(source[field]).filter((item) => {
      const mapped = aliases[item] || item;
      const mappedArr = toArray(mapped);
      return typeof item === "string" && !mappedArr.some((m) => allowed.has(m));
    });
    if (customVals.length) custom[field] = unique(customVals);
  });
  if (Object.keys(custom).length) answers._custom = custom;
  return answers;
}
```

- `answers._custom` 仅供软匹配与（未来）结果文案用，是内部字段。

(4) **软匹配 +4**（master C5 建议值）：在 `scoreGift`（L222 / L212）末尾、`return score` 前加：

```js
score += customMatchBonus(gift, answers._custom);
```

新增函数：

```js
function customMatchBonus(gift, custom) {
  if (!custom) return 0;
  // 仅对标签类字段的自定义文本做软匹配
  const fields = ["emotionalTags", "visualStyle"];
  const haystack = []
    .concat(toArray(gift.searchKeywords))
    .concat(toArray(gift.tags))
    .concat(toArray(gift.highlights))
    .filter((s) => typeof s === "string");
  let bonus = 0;
  fields.forEach((field) => {
    toArray(custom[field]).forEach((term) => {
      const t = String(term).trim();
      if (!t) return;
      const hit = haystack.some((h) => h.indexOf(t) >= 0 || t.indexOf(h) >= 0);
      if (hit) bonus += 4;
    });
  });
  return bonus;
}
```

- `gift.searchKeywords` / `gift.tags` 当前不是数据字段（`tags` 是输出期生成、`searchKeywords` 不存在），`toArray` 对 undefined 返回 `[]`，安全。软匹配实际命中靠 `highlights`（中文短词）。若后续给礼物数据补 `searchKeywords` 字段，此函数自动生效。
- `hardFilter` **不变**（自定义值不参与硬过滤，避免误杀）。

(5) **`_custom` 不得泄漏进候选输出**：`recommendGift`/`recommendLocally` 返回的是 `candidates`（gift 列表）+ summary 等，`answers._custom` 只在内部使用，不会进 candidate。无需额外 strip（`_custom` 挂在 answers，不在 gift 上）。`stripInternalFields` 仍只去 `_rankIndex`。

(6) **导出**：recommender.js 已导出 `scoreGift`/`normalizeAnswers`（L353-360），localRecommender 只导出 `recommendLocally`/`normalizeAnswers`（L350-353）——保持不变即可。

> ⚠️ 两份文件**并非逐字一致**，不要用 `cp`/整体覆盖。已知既有差异：服务端 `recommender.js` 另有 `SCHEMA_VERSION`/`QUESTIONNAIRE_VERSION`/`MODEL_VERSION` 常量并导出 `scoreGift` 及这些常量；`hardFilter` 在服务端位于 `scoreGift` **之前**、客户端在其**之后**。正确做法是**对两份文件分别施加相同的逻辑改动**（`ANSWER_OPTIONS`、`TAG_BY_*`、`normalizeAnswers`、`scoreGift` 主体、自定义软匹配加分），只对这些共享函数体做 `diff` 抽查，勿动各自的版本常量/导出/函数顺序。

### 3.8 礼物数据重打标签（master C4 同步要求 3 / C6）

给 33 个礼物方向补充 emotionalTags / visualStyle 的**新值**，使每个新 value 至少被若干礼物覆盖（否则新标签恒 0 分）。在**所有 3 份**副本同步。

**新值 → 建议至少覆盖的礼物**（按语义；追加而非替换，原值保留；每个礼物 emotionalTags/visualStyle 各建议 ≤4 个）：

emotionalTags 新值：
- `gratitude 感恩感谢`：`wellness-tea-box`、`fruit-gift-box`、`fountain-pen`、`soft-scarf`
- `encourage 鼓励打气`：`hobby-kit`、`craft-experience`、`desk-plant`
- `healing 治愈解压`：`heated-eye-mask`、`sleep-pillow`、`sleep-spray`、`aroma-night-light`、`bath-care-set`
- `playful 有趣好玩`：`instant-camera`、`star-projector-light`、`hobby-kit`
- `prestige 有面子`：`dinner-voucher`、`fountain-pen`、`perfume-discovery-set`、`smart-speaker`
- `sincere 走心用心`：`photo-book`、`custom-mug`、`custom-calendar`、`music-box`
- `ritual 仪式感`：`same-day-flowers-dessert`、`handmade-chocolate`、`couple-bracelet`、`music-box`

visualStyle 新值：
- `cute 可爱有趣`：`star-projector-light`、`desk-plant`、`custom-mug`
- `retro 复古怀旧`：`music-box`、`instant-camera`、`fountain-pen`
- `natural 自然清新`：`desk-plant`、`wellness-tea-box`、`fruit-gift-box`
- `elegant 优雅气质`：`perfume-discovery-set`、`soft-scarf`、`dinner-voucher`、`art-print`
- `festive 节日氛围`：`same-day-flowers-dessert`、`fruit-gift-box`、`handmade-chocolate`

**操作方式**（保证 3 份同步、低出错）：
1. 改 `miniprogram/shared/giftDirections.js`（往对应礼物的 `emotionalTags` / `visualStyle` 数组里追加新值）。
2. 把同一文件**整体复制**到 `cloudfunctions/recommendGift/data/giftDirections.js`（两份逐字相同，可直接 `cp`）：
   `cp miniprogram/shared/giftDirections.js cloudfunctions/recommendGift/data/giftDirections.js`
3. `data/gift-directions.seed.json`（snake_case，字段名 `emotional_tags` / `visual_style_tags`）按相同语义同步追加。seed 不被运行时消费，但 master C6 要求 3 份同步——同步以保持数据一致；用脚本或手工编辑均可。建议写一次性 node 脚本读 runtime 数组、按 id 映射回写 seed 的 snake_case 字段，避免手抖。

> 验证覆盖：改完跑 §6 步骤 5 的覆盖统计脚本，确认每个新 value 计数 ≥1（建议 ≥2）。

### 3.9 文档更新

- `docs/questionnaire-config.md`：在「题目字段」段补 `allowCustom`（可选 boolean，默认 false，开启后问卷页显示「＋自定义」输入）。在「校验内容」段补「`allowCustom` 必须是布尔」。
- `docs/questionnaire-branching.md`：「当前分支」段已写 `budget -> emotionalTags -> visualStyle -> result`（与本次一致），无需改；但其示例提到 `preparationTime` 分支——保留即可（属说明性示例，不与本次 config 冲突）。可补一句说明 emotionalTags/visualStyle 为多选 + 支持自定义。

## 4. 边界与契约（依赖的 master 契约，原样重述）

**适用契约：C2、C3、C4、C5、C6。** C1 由 WS1 拥有，本流程不实现，仅须保证消费 prefill 时与其 answer key 命名一致。

### C2 问卷入口契约（WS2 消费）
- `prefill` = 部分 answers 对象，键用问卷 answer key，URL 编码后传入：
  ```json
  {"target":"partner","gender":"female","occupation":"tech","recipientStyle":"practical"}
  ```
- `skip` = CSV，固定为 `target,gender,occupation,recipientStyle`。
- WS2 职责：解析 → 预置 answers → 从第一道**未跳过**题开始；返回上一题**不得**回到被跳过题；最终 answers **仍含**被预填字段（推荐引擎照常用）。**无参数时行为不变。**

### C3 身份题跳过集（共享常量）
- 选中联系人时跳过：`{ target, gender, occupation, recipientStyle }`。
- 问卷仅询问情境题：`{ scene, budget, emotionalTags, visualStyle }`。
- （注：当前 config 还有 `gender` 单独题，它在 skip 集合里；剩余实际会展示的题视 prefill 而定——通常为 `scene → budget → emotionalTags → visualStyle`。）

### C4 标签词表（WS2 拥有，value id 固定）
- emotionalTags：既有 `romantic/company/care/surprise/memory` + 新增 `gratitude/encourage/healing/playful/prestige/sincere/ritual`（共 12）。
- visualStyle：既有 `minimal/warm/delicate/tech/classic` + 新增 `cute/retro/natural/elegant/festive`（共 10）。
- 新 value 必须同时出现在：config（+重生成 runtime）、两 recommender 的 `ANSWER_OPTIONS` 及 tag 映射、giftDirections ×3 重打标签。

### C5 自定义输入容错
1. schema 题级新增可选 `allowCustom:boolean`（默认 false）；校验器允许该字段，自定义值不参与 config 期分支/枚举校验。
2. 问卷页：`allowCustom` 为真渲染「＋自定义」chip + 文本输入；自定义值以自由文本进答案数组（多选）或作为答案（单选）。
3. 推荐引擎：已知枚举照常打分；未知自定义值（a）保留 payload（`answers._custom`），（b）子串软匹配 gift 的 `searchKeywords`/`tags`/`highlights`，命中 +4；确定性引擎不被破坏（hardFilter 不变）。
4. 默认对 `emotionalTags`、`visualStyle` 开 `allowCustom`；其余题保持关闭（控范围）。

### C6 文件同步铁律
- 改 config 后必须 `node scripts/validate-questionnaire.js --write-runtime`。
- recommender server + client 两份一致。
- giftDirections 3 份一致。
- （guide / app.json 与本流程无关。）

## 5. 边界情况

1. **无参数进入**（匿名送）：`onLoad` 的 `prefill`/`skip` 均空 → `answers={}`、`skipIds=[]`、`getFirstQuestionId` 返回 `START_QUESTION_ID`。行为与今天完全一致。**必须回归验证**。
2. **prefill 含非法 value**（如 `target:"xxx"`）：问卷页照存（不校验 option 合法性），`getNextQuestionId` 对找不到的 option 走 `defaultNext`，链仍可达 result；recommender 的 `normalizeValues` 会把非法 target 丢弃（不进 answers，也不进 `_custom` 除非是字符串——实际会被当自定义收集，但 target 字段不在 `customMatchBonus` 的 fields 里，无副作用）。不致命。
3. **skip 含未预填的 id**：§3.5 已 `filter` 仅保留「prefill 里有值」的 skip id，防止跳过一道没答案的题导致链断裂。
4. **prefill 覆盖了一道仍会展示的题**：理论上 skip 与 prefill 应一致（master 固定 skip 集）。若 prefill 多给了一个不在 skip 的字段（如 scene），该字段进 answers 但该题仍会展示（用户可改），最终 prune 后保留用户最新选择——可接受。
5. **多选自定义达到 max**：`addCustomValue` 与 `selectOption` 都检查 `current.max`，超限 toast 阻止。
6. **自定义文本为空/纯空格**：`addCustomValue` trim 后为空则 toast「先输入内容」。
7. **自定义文本与内置 option 重名**：`addCustomValue` 检查 `selectedValues.indexOf(raw)`；若与某未选中的内置 option 同值，仍会作为该 value 加入（等价于选中内置项），不重复。可接受。
8. **自定义文本含 `,` 或特殊字符**：answers 经 `JSON.stringify` 传给结果页，`JSON.parse` 还原，逗号无影响（只有 `skip` CSV 用逗号，自定义值不进 skip）。
9. **回退到被跳过题**：§3.5 `goBack` 跳过 `skipIds` 中的 history 项；正常流程被跳过题不入 history，此为冗余防御。
10. **自定义值落进结果页**：结果页把整个 answers（含自定义文本与 `_custom`？——注意：`_custom` 是 recommender 内部生成，**不在**问卷页的 answers 里；问卷页传的是原始 answers，含自定义文本字符串）。recommender 收到后自行用 `normalizeAnswers` 重新分离 known/custom。链路自洽。
11. **软匹配命中过多导致排序异常**：+4 远小于主权重（target 22 等），且仅命中 `highlights` 等短词；不会颠覆确定性排序。
12. **seed 与 runtime 不一致风险**：seed 不被运行时读，但 C6 要求同步；若时间紧张，至少保证 client+server 两份运行时副本逐字一致（这两份才影响功能），seed 同步可作为收尾项但不可省（按 C6）。

## 6. 验收

按顺序执行：

1. **config + runtime 同步**
   ```sh
   node scripts/validate-questionnaire.js --write-runtime
   node scripts/validate-questionnaire.js   # 应输出 "Questionnaire config is valid."（无 out-of-sync 报错）
   ```
   预期：新增两题校验通过；`questionnaire.js` 含 `emotionalTags`/`visualStyle` 题与 `allowCustom:true`。

2. **schema 兼容**：确认 `schemas/questionnaire.schema.json` 含 `allowCustom`。若 IDE/工具按 schema 校验 config，应无 `additionalProperties` 报错。

3. **微信开发者工具 — 无参数主流程（回归）**
   - 主页「开始选礼物」走匿名路径（或直接打开 `pages/question/index` 无参）。
   - 走完 `target→gender→scene→occupation→recipientStyle→budget→emotionalTags→visualStyle→result`。
   - emotionalTags/visualStyle 为多选 + 有「下一步」按钮 + `max:3` 限制（选第 4 个 toast）+ 「＋自定义」可输入并显示为可取消的格子。
   - 结果页正常出候选。

4. **微信开发者工具 — prefill/skip 路径**
   - 在问卷页 URL 手动加参数（开发者工具「编译模式」可配 query，或临时在 `onLoad` 打 log）：
     `?prefill=%7B%22target%22%3A%22partner%22%2C%22gender%22%3A%22female%22%2C%22occupation%22%3A%22tech%22%2C%22recipientStyle%22%3A%22practical%22%7D&skip=target,gender,occupation,recipientStyle`
   - 预期：第一道展示题为 `scene`（身份题全跳过）；逐题点「上一个」**不会**回到 gender/target；走到 result 时，打印 `this.data.answers` 应**包含** `target/gender/occupation/recipientStyle` 4 个预填字段 + scene/budget/emotionalTags/visualStyle。
   - 在 emotionalTags 加一个自定义值（如「上岸庆祝」），确认最终 answers 数组里含该字符串。

5. **礼物覆盖统计**（确保新标签非恒 0）
   ```sh
   node -e "const {GIFT_DIRECTIONS}=require('./miniprogram/shared/giftDirections.js'); const want={e:['gratitude','encourage','healing','playful','prestige','sincere','ritual'],v:['cute','retro','natural','elegant','festive']}; const e={},v={}; GIFT_DIRECTIONS.forEach(g=>{(g.emotionalTags||[]).forEach(t=>e[t]=(e[t]||0)+1);(g.visualStyle||[]).forEach(t=>v[t]=(v[t]||0)+1)}); console.log('emotion new:', want.e.map(k=>k+':'+(e[k]||0)).join(' ')); console.log('visual new:', want.v.map(k=>k+':'+(v[k]||0)).join(' ')); console.log('OK?', want.e.every(k=>e[k]>0)&&want.v.every(k=>v[k]>0));"
   ```
   预期：每个新 value 计数 ≥1，末行 `OK? true`。

6. **3 份礼物数据一致**
   ```sh
   diff miniprogram/shared/giftDirections.js cloudfunctions/recommendGift/data/giftDirections.js && echo "client==server OK"
   ```
   再人工核对 `data/gift-directions.seed.json` 的 `emotional_tags`/`visual_style_tags` 与 runtime 语义一致。

7. **recommender 两份一致 + 软匹配生效**
   ```sh
   # 已知枚举打分回归：传标准 answers，确认有候选
   node -e "const {recommendGift}=require('./cloudfunctions/recommendGift/lib/recommender.js'); const r=recommendGift({target:'partner',scene:'birthday',budget:'200_500',emotionalTags:['ritual'],visualStyle:['cute']}); console.log('candidates:', r.candidates.length, 'top:', r.candidates[0]&&r.candidates[0].name);"
   # 自定义软匹配：传一个能子串命中某礼物 highlights 的自定义文本，确认不报错且有候选
   node -e "const {recommendGift}=require('./cloudfunctions/recommendGift/lib/recommender.js'); const r=recommendGift({target:'partner',emotionalTags:['浪漫']}); console.log('custom-ok candidates:', r.candidates.length);"
   ```
   对 `miniprogram/shared/localRecommender.js` 用 `recommendLocally` 跑同样两条，结果应同质（候选数量/排序一致或近似）。

8. **云函数依赖**：recommender.js 改动无新依赖；若部署，`cd cloudfunctions/recommendGift && npm install` 后上传。
