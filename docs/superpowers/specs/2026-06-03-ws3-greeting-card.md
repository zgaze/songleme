# WS3 贺卡 MVP 设计说明（implementation-ready）

> 日期：2026-06-03 · 分支：`dev/app-plan-6-04` · 工作流 WS3
> 权威协调层：`docs/superpowers/specs/2026-06-03-app-plan-6-04-master.md`（冲突以 master 为准并回报）。
> 本工作流拥有/可改的文件：新建 `miniprogram/pages/card/`、新建 `miniprogram/pages/cardEdit/`、新建 `miniprogram/shared/cardTemplates.js`、改 `miniprogram/pages/home/`（加第 3 个入口）、改 `miniprogram/app.json`（追加两页）。**不得**改动其它工作流文件（问卷、推荐引擎、联系人、攻略、cloud.js 等）。

---

## 1. 目标与范围

**目标**：在主页增加「制作贺卡」入口，提供一个**最小可用**的贺卡制作流程：

1. 用户在模板画廊（`pages/card`）看到 3-4 个**带 CSS 动画**的预览贺卡卡片，点选进入编辑器。
2. 编辑器（`pages/cardEdit`）可：切模板、切配色、填「收礼人称呼」+「一句祝福」，并实时看到**动画**预览。
3. 一键「保存到相册」（把贺卡渲染成**静态图片**导出）或「分享」。

**明确的非目标（MVP，不做）**：

- 不做逐元素拖拽编辑器（无元素定位/缩放/旋转）。
- 不做动画时间轴 / 自定义动画参数。
- 不做与结果页（`pages/result`）/ 推荐结果的联动。
- 不做服务端渲染、不调用任何云函数、不落库（贺卡内容仅存在于内存与导出图片中）。
- 不做历史记录、不做素材上传（无用户图片/贴纸上传）。
- 不做字体加载（仅用系统字体，避免 canvas 字体异步问题）。

范围铁律：**导出的图片是静态快照**，App 内预览是动画。每个模板的静态版式必须独立成立、好看（动画只是锦上添花，静态是交付物）。

---

## 2. 现状（相关代码事实，已核实）

- 主页 `pages/home/index.wxml` 当前 **2 个按钮**（`startQuestionnaire` / `openGuide`），用 `.home-button` + `.home-button--primary` / `.home-button--guide` 两类，竖排居中（`.home__action` flex column，gap 26rpx）。`index.js` 用 `wx.navigateTo` 跳转。
- 设计 token 全在 `miniprogram/app.wxss` 的 `page {}` 里，以 CSS 变量提供（`--bg --rose --blue --gold --mint`、`--rose-soft` 等 soft 变体、`--on-rose/--on-blue/--on-gold/--on-mint`、`--r-md/--r-lg/--r-pill`、`--fs-*`、阴影 `--out-sm/md/lg`、内阴影 `--ins-neutral/blue/rose/gold/mint/press`）。**页面 WXSS 一律用 var()，禁止硬编码 hex/阴影**。
- 数据驱动页面范例 = `pages/guide/`：`index.js` 顶部 `require` 一份 shared 数据模块，`data` 里放派生数组，`bindtap` + `data-id` 切换 setData。WS3 的 `pages/card` 与 `pages/cardEdit` 照此模式（require `cardTemplates.js`）。
- 页面 JSON 约定：每页有 `index.json`，仅含 `navigationBarTitleText`（result 页另含 `usingComponents`）。WS3 两页各自给 `navigationBarTitleText`，**无需** `usingComponents`。
- 自定义 tabBar：`app.json` `tabBar.custom = true`，list 只有 home/profile 两项。card/cardEdit 是 `wx.navigateTo` 进入的**非 tab 页**，不进 tabBar.list。**不要**在这两页 `onShow` 调 `selectTab`（那是 tab 页才做的事，见 home/guide 差异：home 调，guide 不调）。
- 代码库**无任何 canvas 使用**、无 `@keyframes`（已 grep 确认）。WS3 是首个引入 canvas 与 keyframes 的工作流。
- `project.config.json` `libVersion: "latest"`；CLAUDE.md 基础库 3.15.2，满足 Canvas 2D（`<canvas type="2d">`，基础库 ≥ 2.9.0）。
- 无本地分享图工具可复用；`sharePayload.js` 是给问卷/结果分享用的文本/路径载荷，与贺卡图片分享无关，**不复用**。

---

## 3. 改动清单（file-by-file）

### 3.1 新建 `miniprogram/shared/cardTemplates.js`

纯数据模块 + 取值函数。CommonJS 导出（与 `guideContent.js` 风格一致）。

**模板对象形状**：

```js
{
  id,            // string 稳定 id，例 "warm-blush"
  name,          // string 中文名，例 "暖粉信笺"
  animationClass,// string 预览动画用的 class 名（在两页 WXSS 各自定义 @keyframes）
  defaultPaletteId, // string 默认配色 id（必须存在于下方 palettes）
  palettes: [    // 该模板可选配色，2-3 个；编辑器「配色」选择从这里取
    {
      id,        // string 配色 id，例 "blush"
      name,      // string 中文名，例 "粉"
      bg,        // string CSS 颜色（贺卡背景，可为线性渐变字符串或纯色 hex）
      text,      // string 主文字颜色 hex
      accent,    // string 点缀色 hex（装饰条/称呼/署名等）
    }
  ],
  fields: [      // 可编辑字段，MVP 固定两项
    { key: "salutation", label: "收礼人称呼", placeholder: "亲爱的 / 给最好的你", maxLen: 12, default: "" },
    { key: "blessing",   label: "一句祝福",   placeholder: "愿你被这个世界温柔以待", maxLen: 40, default: "" }
  ]
}
```

- 颜色值直接写**字面 hex / 渐变字符串**（不能在 JS 里读 CSS 变量；canvas 也需要字面色值）。从 master 调色板取色：primary blue `#30628a`、rose `#ffb0cd`、gold `#fac477`、mint `#b7e4c7`，文字用深色（如 `#2a2126` / `#6e334c` / `#1d4f74`，与 app.wxss 的 `--on-*` 同源）。
- **提供 4 个模板**（每个 2 个配色即可，控范围）：
  1. `warm-blush` 暖粉信笺 — 玫粉系，配色 `blush`(粉) / `gold`(暖金)。
  2. `calm-sky` 静蓝晴空 — 天蓝系，配色 `sky`(蓝) / `mint`(薄荷)。
  3. `fresh-mint` 清新薄荷 — 薄荷系，配色 `mint`(绿) / `sky`(蓝)。
  4. `golden-hour` 暖阳时刻 — 暖金系，配色 `gold`(金) / `blush`(粉)。
- 字段 `salutation`/`blessing` 的 `key`、`maxLen` 在两页与导出之间**保持一致**（编辑器输入校验、预览渲染、canvas 绘制都按这两个 key 取值）。

**导出 API**（供两页 require）：

```js
const CARD_TEMPLATES = [ /* 上述 4 个 */ ];

function getCardTemplates() { return CARD_TEMPLATES; }                 // 画廊用
function getCardTemplateById(id) { return CARD_TEMPLATES.find(t => t.id === id) || null; }
function getTemplatePalette(template, paletteId) {                      // 取配色，缺省回 defaultPalette
  if (!template) return null;
  return (template.palettes.find(p => p.id === paletteId)) ||
         (template.palettes.find(p => p.id === template.defaultPaletteId)) ||
         template.palettes[0] || null;
}

module.exports = { CARD_TEMPLATES, getCardTemplates, getCardTemplateById, getTemplatePalette };
```

### 3.2 新建 `miniprogram/pages/card/`（模板画廊）

文件：`index.js / index.wxml / index.wxss / index.json`。

- `index.json`：`{ "navigationBarTitleText": "选个贺卡模板" }`。
- `index.js`：
  - 顶部 `const { getCardTemplates } = require("../../shared/cardTemplates");`
  - `data: { templates: getCardTemplates() }`（直接渲染整个数组；预览用每个 template 的 `defaultPaletteId` 对应配色渲染一张缩略动画卡）。
  - `onShow()`：调用 `wx.showShareMenu({ withShareTicket: true, menus: ["shareAppMessage"] })`（与其它页一致；非必需）。**不**调 `selectTab`（非 tab 页）。
  - `chooseTemplate(event)`：取 `event.currentTarget.dataset.id`，`wx.navigateTo({ url: '/pages/cardEdit/index?templateId=' + id })`。
- `index.wxml`：
  - 顶部 head（kicker + title，复用 guide 的 `__head` 视觉语言，但用自己的 class 前缀 `card-gallery`）。
  - `wx:for="{{templates}}"` 渲染卡片列表（单列竖排或 2 列网格皆可；MVP 用单列大卡更稳）。每张卡是一个 `<view class="card-preview card-preview--{{item.id}} {{item.animationClass}}" data-id="{{item.id}}" bindtap="chooseTemplate">`，内部展示模板名 + 一行示例祝福 + 装饰条，用于体现动画。
  - 卡片背景色用模板默认配色 → 因 JS 不能注入到 class，采用 **inline style 绑定**：`style="background: {{item._previewBg}}; color: {{item._previewText}};"`。为此在 `index.js` 的 `data` 里把 templates 预处理出 `_previewBg/_previewText/_accent`（用 `getTemplatePalette(t, t.defaultPaletteId)` 取色，map 进每个 item）。
- `index.wxss`：定义画廊布局 + 至少 1-2 个 `@keyframes`（如 `card-float` 缓慢上下浮动、`card-shine` 装饰条左右扫光）。`animationClass`（如 `anim-float` / `anim-shine`）绑定 `animation: card-float 3.2s ease-in-out infinite;`。所有间距/圆角/阴影用 var()。

### 3.3 新建 `miniprogram/pages/cardEdit/`（编辑器 + 预览 + 导出）

文件：`index.js / index.wxml / index.wxss / index.json`。

- `index.json`：`{ "navigationBarTitleText": "制作贺卡" }`。

**`index.js` data**：

```js
data: {
  template: null,        // 当前模板对象
  paletteId: "",         // 当前配色 id
  palette: null,         // 当前配色对象 {id,name,bg,text,accent}
  templates: [],         // 全部模板（供「换模板」横滑选择）
  salutation: "",        // 收礼人称呼
  blessing: "",          // 一句祝福
  saluMax: 12,           // 来自 template.fields salutation.maxLen
  blesMax: 40,           // 来自 template.fields blessing.maxLen
  exporting: false,      // 导出中（防重复点击 + loading）
}
```

**`index.js` 生命周期与方法**：

- `onLoad(options)`：
  - `const template = getCardTemplateById(options.templateId) || getCardTemplates()[0];`（容错：无效 id 回退首个模板）。
  - 用 `getTemplatePalette(template, template.defaultPaletteId)` 取默认配色。
  - 从 `template.fields` 找到 `salutation`/`blessing` 的 `maxLen` 与 `default`，setData 初始化 `salutation/blessing/saluMax/blesMax`。
  - `setData({ template, palette, paletteId: palette.id, templates: getCardTemplates() })`。
- `onShow()`：`wx.showShareMenu({ withShareTicket: true, menus: ["shareAppMessage"] })`。
- `switchTemplate(e)`：`dataset.id` → `getCardTemplateById` → 重置 `palette` 为该模板默认配色并更新 maxLen（若新模板字段 maxLen 不同，需把现有文本 `slice(0, newMax)`）。
- `switchPalette(e)`：`dataset.id` → `getTemplatePalette(this.data.template, id)` → setData `palette/paletteId`。
- `onSalutationInput(e)` / `onBlessingInput(e)`：`setData({ salutation: e.detail.value })`（input 组件用 `maxlength="{{saluMax}}"` 已硬限长，无需 JS 再截）。
- `saveToAlbum()`：见 §3.5 导出流程（含相册授权）。
- `onShareAppMessage()`：返回 `{ title: "我给你做了一张贺卡", path: "/pages/card/index", imageUrl: this._lastTempFilePath }`。`imageUrl` 取最近一次成功导出的临时文件路径（见 §3.5：导出成功后存 `this._lastTempFilePath`）。**若用户没点过保存/未生成图**，分享时先同步触发一次离屏渲染生成 imageUrl（见 §5 边界）；最低限度可不带 imageUrl（微信会用页面截图兜底）。

**`index.wxml` 结构**（自上而下）：

1. **预览区**（动画，可见）：
   ```
   <view class="card-stage">
     <view class="card-canvas {{template.animationClass}}"
           style="background: {{palette.bg}}; color: {{palette.text}};">
       <view class="card-canvas__accent" style="background: {{palette.accent}};"></view>
       <text class="card-canvas__salu">{{salutation || template.fields[0].placeholder}}</text>
       <text class="card-canvas__bless">{{blessing || template.fields[1].placeholder}}</text>
       <text class="card-canvas__sign">—— 送了么</text>
     </view>
   </view>
   ```
   占位文案用 `||` 兜底，让空表单时预览也好看。
2. **换模板**：横滑 `scroll-view`（仿 guide 的 channel-row），`wx:for="{{templates}}"`，每项小卡 `data-id` `bindtap="switchTemplate"`，当前项加 active class。
3. **换配色**：`wx:for="{{template.palettes}}"` 的色块 chip，`style="background:{{item.bg}}"`，`data-id` `bindtap="switchPalette"`，当前项加 active class。
4. **表单**：两个 `<input>`（称呼，`maxlength="{{saluMax}}"`）与一行祝福（用 `<textarea>` 更合适，`maxlength="{{blesMax}}" auto-height`），下方显示「{{salutation.length}}/{{saluMax}}」字数。输入框用「下沉」内阴影 `--ins-press`（见 DESIGN.md「Input Fields 应 inset」）。
5. **底部操作**：两个按钮 `保存到相册`（`bindtap="saveToAlbum"`，`loading="{{exporting}}"`）与 `分享给好友`（`open-type="share"`，沿用 home-button 视觉变体或本页自定义）。
6. **离屏 canvas**（导出用，**不可见**）：放在 WXML 任意位置，用类把它移出视口：
   ```
   <canvas type="2d" id="cardCanvas" class="card-export-canvas"
           style="width: {{exportW}}px; height: {{exportH}}px;"></canvas>
   ```
   `.card-export-canvas { position: fixed; left: -9999px; top: 0; }`（不能用 `display:none`，否则 2D node 取不到/尺寸为 0；用移出屏幕的方式）。

**`index.wxss`**：复制 §3.2 的 `@keyframes`（每页 WXSS 独立，需各自定义；或都在各页文件内重复定义，MVP 可接受冗余）。预览卡 `.card-canvas` 固定宽高比（如 width 100%，aspect 用固定 rpx 高度，比例约 3:4 竖版贺卡），圆角 `--r-lg`，阴影 `--out-md`。

### 3.4 导出尺寸与 Canvas 2D 渲染（核心，须精确）

WeChat **Canvas 2D**（`<canvas type="2d">`）正确用法：

```js
exportCardImage() {
  return new Promise((resolve, reject) => {
    const dpr = wx.getSystemInfoSync().pixelRatio || 2;
    const logicW = 300, logicH = 400;            // 逻辑画布尺寸（px），3:4 竖版
    const query = wx.createSelectorQuery().in(this); // 注意 .in(this)：在本页/组件内查询
    query.select('#cardCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvasNode = res && res[0] && res[0].node;
        if (!canvasNode) { reject(new Error('canvas node not found')); return; }
        const ctx = canvasNode.getContext('2d');
        // 物理像素 = 逻辑 * dpr，再缩放 ctx，保证清晰不糊
        canvasNode.width = logicW * dpr;
        canvasNode.height = logicH * dpr;
        ctx.scale(dpr, dpr);
        this.drawCard(ctx, logicW, logicH); // 同步绘制（纯色/文字，无异步图片）
        wx.canvasToTempFilePath({
          canvas: canvasNode,                // Canvas 2D 必须传 canvas 节点，不传 canvasId
          x: 0, y: 0, width: logicW, height: logicH,
          destWidth: logicW * dpr, destHeight: logicH * dpr,
          success: (r) => resolve(r.tempFilePath),
          fail: reject,
        });
      });
  });
}
```

**`drawCard(ctx, w, h)`** —— 画**静态快照**（无动画）：

1. 背景：`palette.bg` 若是纯 hex → `ctx.fillStyle = palette.bg; ctx.fillRect(0,0,w,h)`；若模板想要渐变，用 `ctx.createLinearGradient(...)`（**注意：cardTemplates 里若把 bg 写成 CSS 渐变字符串，canvas 不认**——见 §5 决策：MVP 让 `palette.bg` 为**纯色 hex**，预览要渐变可由 WXSS 另给同模板的 `--style`，但导出只用纯色，或额外提供 `palette.bgSolid`。最简方案：`bg` 只用纯色 hex）。
2. 装饰：用 `palette.accent` 画一条圆角矩形色带 / 顶部小色块（与预览版式对应）。
3. 文字：`ctx.fillStyle = palette.text;`
   - 称呼：`ctx.font = '600 22px sans-serif'`，左上区域绘制 `this.data.salutation || fields[0].placeholder`。
   - 祝福：`ctx.font = '400 18px sans-serif'`，需**手动折行**（canvas 无自动换行）：实现一个 `wrapText(ctx, text, maxWidth)` 按字符累加宽度 `ctx.measureText` 折行，逐行 `fillText`，行高约 28px。
   - 署名：底部右对齐 `'—— 送了么'`，小字 14px，`palette.text` 调淡可用，但 MVP 直接用 text 色。
4. 文字颜色/字号与 §3.3 预览**版式一致**（导出与预览观感对齐，差异仅「无动画」）。

> 关键点（务必照做）：
> - Canvas 2D 取节点必须 `wx.createSelectorQuery().in(this)` + `.fields({node:true,size:true})`；老的 `wx.createCanvasContext('id')`（2D 不适用）**不要用**。
> - `wx.canvasToTempFilePath` 在 2D 模式**必须传 `canvas` 节点**（不是 `canvasId`）。
> - canvas 节点的 `width/height` 设为逻辑×dpr 后再 `ctx.scale(dpr,dpr)`，否则导出图糊。
> - 全程**同步绘制**（纯色 + 文字），不加载任何远程/本地图片，避免 onLoad 图片异步带来的「画了但还没 ready 就导出」竞态。

### 3.5 保存到相册流程（含授权）

```js
saveToAlbum() {
  if (this.data.exporting) return;
  this.setData({ exporting: true });
  this.exportCardImage()
    .then((tempFilePath) => {
      this._lastTempFilePath = tempFilePath; // 供分享 imageUrl 复用
      return this.persistToAlbum(tempFilePath);
    })
    .then(() => { wx.showToast({ title: '已保存到相册', icon: 'success' }); })
    .catch((err) => { this.handleSaveError(err); })
    .finally(() => { this.setData({ exporting: false }); });
}

persistToAlbum(tempFilePath) {
  return new Promise((resolve, reject) => {
    wx.saveImageToPhotosAlbum({
      filePath: tempFilePath,
      success: resolve,
      fail: reject,
    });
  });
}
```

**授权（scope.writePhotosAlbum）处理**：

- 不预先 `getSetting`，直接 `saveImageToPhotosAlbum`：首次会弹系统授权；用户允许即成功。
- 若 `fail` 的 `errMsg` 含 `auth deny` / `authorize:fail` / `saveImageToPhotosAlbum:fail auth`（即用户曾拒绝、不再弹窗），则在 `handleSaveError` 里 `wx.showModal` 引导去设置页：
  ```js
  handleSaveError(err) {
    const msg = (err && err.errMsg) || '';
    if (msg.indexOf('auth') >= 0 || msg.indexOf('deny') >= 0) {
      wx.showModal({
        title: '需要相册权限',
        content: '保存贺卡需要授权访问相册，请在设置中开启。',
        confirmText: '去设置',
        success: (r) => { if (r.confirm) wx.openSetting(); },
      });
      return;
    }
    if (msg.indexOf('cancel') >= 0) return; // 用户主动取消，不打扰
    wx.showToast({ title: '保存失败，请重试', icon: 'none' });
  }
  ```

### 3.6 改 `miniprogram/pages/home/`（加第 3 个入口）

> ⚠️ **协调（master C7）**：`pages/home/index.js` 也被 WS1 改动（改 `startQuestionnaire`）。本工作流**只**新增 `openCard` 方法 + 「制作贺卡」按钮（wxml）+ `.home-button--card` 样式（wxss），不动 `startQuestionnaire`。两者区域不重叠，合并无冲突。

- `index.wxml`：在两个现有按钮后追加第三个：
  ```
  <button class="home-button home-button--card" bindtap="openCard">制作贺卡</button>
  ```
- `index.wxss`：新增变体（用 gold 或 mint，避免与 primary=rose / guide=blue 撞色，建议 mint）：
  ```
  .home-button--card {
    background: var(--mint);
    color: var(--on-mint);
    box-shadow: var(--out-md), var(--ins-mint);
  }
  ```
  （`.home-button` 基类、`:active`、`::after` 已存在，复用即可。`.home__action` gap 已是 26rpx，第三个按钮自动竖排居中，无需改布局。）
- `index.js`：新增方法（其余不动）：
  ```js
  openCard() {
    wx.navigateTo({ url: "/pages/card/index" });
  },
  ```

### 3.7 改 `miniprogram/app.json`（追加两页）

在 `pages` 数组末尾追加（**追加式，不动既有顺序**）：

```json
"pages/card/index",
"pages/cardEdit/index"
```

> 与 WS1 的 `pages/contacts/index`、`pages/contactEdit/index` 都是对同一 `pages` 数组追加 —— 合并时按 master「app.json 追加合并」处理，互不覆盖。这两页**不**进 `tabBar.list`。

---

## 4. 边界与契约（适用的 master 约定）

WS3 与其它工作流**几乎无契约耦合**，是 4 个工作流里最独立的一个。适用项：

- **master「工作流划分与文件归属」**：WS3 拥有 `pages/card/`、`pages/cardEdit/`、`shared/cardTemplates.js`，并对 `pages/home/`、`app.json` 追加。**不得**触碰问卷 / 推荐引擎 / 联系人 / 攻略 / cloud.js / giftDirections。
- **master C6 文件同步铁律**：`app.json` 新增页面，WS3 加 `pages/card/index`、`pages/cardEdit/index`（本 spec §3.7 已落实）。WS3 不触发其它同步项（不改 questionnaire/recommender/guide/giftDirections）。
- **设计 token 契约**（来自 `app.wxss`，非 master 编号但全局强制）：页面 WXSS 颜色/阴影/圆角/字号一律 `var(--*)`。但 **`cardTemplates.js` 内的贺卡配色与 canvas 绘制是例外**——JS 与 canvas 无法读 CSS 变量，必须写字面 hex；取色须与 master 调色板同源：`#30628a / #ffb0cd / #fac477 / #b7e4c7` 及 app.wxss 的 `--on-*` 文字色。
- **不依赖任何跨流程数据形状**（C1 联系人、C2/C3 问卷入口、C4/C5 标签均与贺卡无关）。贺卡不读 answers、不读 recipient、不读 gift。

WS3 自有内部契约（本 spec 内三处共享，须一致）：贺卡字段 `key` 固定为 `salutation` / `blessing`，`maxLen` 固定 12 / 40；模板/配色取值统一走 `getCardTemplateById` / `getTemplatePalette`。

---

## 5. 边界情况与错误处理

| 场景 | 处理 |
|------|------|
| `cardEdit` 收到非法/缺失 `templateId` | `getCardTemplateById` 返回 null → 回退 `getCardTemplates()[0]`，不报错。 |
| 切模板后新模板 `maxLen` 更小 | `switchTemplate` 里把现有 `salutation/blessing` `slice(0, 新maxLen)` 后再 setData，避免超长文本残留。 |
| 表单全空就导出 | 用占位文案兜底绘制（canvas 里 `salutation || placeholder`、`blessing || placeholder`），导出图始终有内容；不阻断。 |
| 祝福过长（已 maxlength 限 40）canvas 折行 | `wrapText` 按测量宽度折行；若行数超出卡片高度，最多绘制 N 行（如 4 行）后截断加「…」，保证不溢出版式。 |
| Canvas 2D node 取不到（`res[0].node` 为空） | reject → toast「生成失败，请重试」。常见原因：canvas 用了 `display:none`（故必须用 `position:fixed;left:-9999px`）或 `query` 未 `.in(this)`。 |
| 导出图模糊 | 必须 `canvasNode.width = logicW*dpr` 且 `ctx.scale(dpr,dpr)`、`canvasToTempFilePath` 传 `destWidth/destHeight = 逻辑×dpr`。 |
| 相册授权被拒（auth deny） | `wx.showModal` 引导 `wx.openSetting`（见 §3.5 `handleSaveError`）。 |
| 用户取消系统保存弹窗（errMsg 含 cancel） | 静默，不弹错误 toast。 |
| 重复快速点「保存」 | `exporting` 标志位拦截 + 按钮 `loading="{{exporting}}"`。 |
| 渐变背景 vs canvas | **MVP 决策**：`palette.bg` 一律用**纯色 hex**，保证预览与导出一致、canvas 直接 fillRect。如某模板预览想要渐变，仅在 WXSS 层做，导出仍按纯色（可接受的 MVP 取舍）；不要把 CSS `linear-gradient(...)` 字符串塞进 canvas fillStyle（会报错/失效）。 |
| 分享时还没生成过图 | `onShareAppMessage` 里若 `this._lastTempFilePath` 为空，尝试同步已渲染信息生成；最差情况不带 `imageUrl`（微信用页面截图兜底），保证分享不失败。 |
| 字体 | 仅用 `sans-serif` 系统字体，不加载自定义字体，规避 canvas 字体异步未就绪问题。 |

---

## 6. 验收（在微信开发者工具中验证）

**前置**：用微信开发者工具打开项目（基础库 ≥ 2.9.0，项目当前 `libVersion: latest` / CLAUDE.md 3.15.2 满足）。

1. **入口**：首页出现 3 个按钮（开始选礼物 / 送礼攻略 / 制作贺卡），第三个为薄荷绿，点击「制作贺卡」跳到 `pages/card`，标题栏显示「选个贺卡模板」。
2. **画廊**：看到 4 张模板卡，各自有缓慢动画（浮动/扫光），背景为各模板默认配色。点任一卡跳到 `pages/cardEdit?templateId=<id>`，标题「制作贺卡」。
3. **编辑器**：
   - 预览卡按当前模板+配色显示，空表单时显示占位文案。
   - 横滑「换模板」切换 → 预览即时变化、动画跟随。
   - 点「换配色」色块 → 预览背景/点缀色即时变化。
   - 在「收礼人称呼」输入超过 12 字被截断；「一句祝福」超过 40 字被截断；字数计数正确。
4. **保存到相册**：点「保存到相册」→ 首次弹相册授权 → 允许后 toast「已保存到相册」。打开模拟器/真机相册可见一张**静态**贺卡图（清晰、含称呼+祝福+署名，版式与预览一致，但无动画）。在设置里关闭相册权限后再点保存 → 弹「去设置」Modal。
5. **分享**：点「分享给好友」（open-type=share）或右上角菜单分享 → 转发卡片带贺卡图（若已导出过）。
6. **导出清晰度**：在不同 `pixelRatio`（开发者工具切机型）下导出图不糊。
7. **回归**：返回首页，原「开始选礼物 / 送礼攻略」两入口功能不受影响；tabBar 仍为 首页/我的 两项（card/cardEdit 未污染 tabBar）。

**静态检查**：项目无 lint/CI；确认 `app.json` `pages` 含 `pages/card/index`、`pages/cardEdit/index`，且开发者工具编译无「页面未注册」报错。

---

附：本工作流不新增 npm 依赖、不新增云函数、不改任何 schema/脚本。
