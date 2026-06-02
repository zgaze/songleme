# 攻略内容框架使用文档

攻略页采用“静态内容包 + 小程序结构化渲染”的框架。内容编辑入口是：

```text
miniprogram/shared/guideContent.js
```

页面渲染入口是：

```text
miniprogram/pages/guide/index.js
miniprogram/pages/guide/index.wxml
miniprogram/pages/guide/index.wxss
```

校验入口是：

```sh
node scripts/validate-guide-content.js
```

结构参考 schema：

```text
schemas/guide-content.schema.json
```

旧文件 `miniprogram/shared/guideTips.js` 只保留为兼容适配层，新内容不要再写到那里。

## 设计目标

- 运营或 AI 可以只改静态内容，不改 WXML。
- 正文不用任意 HTML，避免小程序 `rich-text` 限制、样式失控和安全问题。
- 内容可以先随小程序发版，后续平滑迁到 CloudBase 数据库或云存储。
- 每篇攻略都能关联场景、对象、预算，未来可以和推荐结果互相跳转。

## 内容结构

`guideContent.js` 导出三类东西：

```js
const GUIDE_CONTENT_VERSION = "2026-05-31-static-v1";
const guideChannels = [];
const guideArticles = [];

module.exports = {
  GUIDE_CONTENT_VERSION,
  guideChannels,
  guideArticles,
  getGuideContentPayload,
  getPublishedGuideArticles,
  getPublishedGuideChannels,
  getGuideArticleById,
  getPublishedGuideArticlesByChannel,
};
```

- `GUIDE_CONTENT_VERSION`：内容版本号。改内容时建议更新，方便排查线上缓存。
- `guideChannels`：频道列表，比如花语、巧克力、穿戴、饰品。
- `guideArticles`：攻略文章列表，每篇文章由结构化 blocks 组成。
- 查询函数：页面只读 `published` 内容，`draft` 可以留在文件里但不会展示。
- `getGuideContentPayload()`：返回 `{ version, channels, articles }`，未来云函数也可以按这个形状下发内容。

## 频道格式

```js
{
  id: "flowers",
  name: "花语",
  summary: "鲜花适合表达仪式感，花色和数量会让语气变得更明确。",
  note: "不确定对方偏好时，选浅色混搭花束和短卡片，比大束红玫瑰更稳。",
  accent: "blue",
  articleIds: ["flower-language-basics"]
}
```

字段说明：

- `id`：频道唯一标识。只用小写英文、数字、下划线、短横线，不能重复。
- `name`：频道名，显示在顶部横向频道按钮里。
- `summary`：频道摘要，建议 20-45 个中文字符。
- `note`：轻提醒，适合写避坑、边界、适用场景。
- `accent`：频道主题色，目前支持 `blue` / `pink` / `green` / `apricot`。
- `articleIds`：频道下展示的文章 id，顺序就是页面展示顺序。

## 文章格式

```js
{
  id: "flower-language-basics",
  channelId: "flowers",
  status: "published",
  title: "常见花材怎么表达心意",
  subtitle: "先判断关系阶段，再决定花材、颜色和卡片语气。",
  summary: "适合生日、纪念日、道歉和日常关心前快速确认。",
  updatedAt: "2026-05-31",
  readingMinutes: 3,
  tags: ["鲜花", "仪式感", "关系边界"],
  scenes: ["birthday", "anniversary", "apology", "daily"],
  targets: ["partner", "parents", "bestie"],
  budgets: ["under_200", "200_500", "500_1000"],
  blocks: []
}
```

字段说明：

- `id`：文章唯一标识，必须被某个频道的 `articleIds` 引用才会展示。
- `channelId`：所属频道，必须对应一个频道 `id`。
- `status`：`published` 会展示，`draft` 不展示。
- `title` / `subtitle` / `summary`：页面标题、副标题和文章卡片摘要。
- `updatedAt`：`YYYY-MM-DD` 格式。
- `readingMinutes`：1-15 的整数。
- `tags`：页面展示标签，建议 2-5 个。
- `scenes` / `targets` / `budgets`：给未来搜索、推荐结果跳攻略、个性化排序使用。
  这些值必须来自当前问卷配置里的 `scene` / `target` / `budget` 选项。
- `blocks`：正文结构化内容，见下一节。

## 正文 blocks 格式

正文不要写 HTML，也不要直接写 Markdown。当前支持这些 block：

### paragraph

普通段落。

```js
{
  id: "opening",
  type: "paragraph",
  text: "花不是越大束越好。真正影响感受的，是颜色、花材含义和你写在卡片里的理由。"
}
```

### heading

段内小标题。

```js
{
  id: "how-to-choose",
  type: "heading",
  text: "怎么判断是否适合"
}
```

### tip

重点建议或避坑提醒。

```js
{
  id: "safe-choice",
  type: "tip",
  title: "稳妥选择",
  text: "浅色混搭花束 + 一句具体祝福，通常比单一强烈花材更不容易出错。"
}
```

### list

普通列表，适合写踩坑点、选择原则。

```js
{
  id: "avoid",
  type: "list",
  title: "容易踩坑",
  items: ["临期或运输易融化", "只选自己爱吃的口味"]
}
```

### checklist

确认清单，适合下单前检查。

```js
{
  id: "checklist",
  type: "checklist",
  title: "下单前检查",
  items: ["对方是否花粉过敏", "收花地点是否方便"]
}
```

### compare

对比表，适合解释不同礼物信号。

```js
{
  id: "common-flowers",
  type: "compare",
  title: "常见花材信号",
  items: [
    {
      label: "红玫瑰",
      good: "热烈、明确的爱意",
      caution: "适合关系确定的恋人，不适合刚认识就送。"
    }
  ]
}
```

### giftRefs

礼物方向引用。现在只展示文字，未来可以把 `name` 换成 `giftId` 并跳转推荐详情。

```js
{
  id: "gift-refs",
  type: "giftRefs",
  title: "可以搭配的礼物方向",
  items: [
    {
      name: "手写卡片",
      note: "写清楚为什么选这束花，比堆砌情话更有效。"
    }
  ]
}
```

## 编辑流程

1. 打开 `miniprogram/shared/guideContent.js`。
2. 新增或修改 `guideArticles`。
3. 如果是新文章，把文章 `id` 加进对应频道的 `articleIds`。
4. 保存后运行：

```sh
node --check miniprogram/shared/guideContent.js
node scripts/validate-guide-content.js
```

5. 在微信开发者工具重新编译，进入首页点击 `送礼攻略` 检查频道、文章和正文换行。

## 文案注意事项

- 不要把民俗、传闻写成绝对事实。
- 多用“常被理解为”“容易被解读为”“更适合”这类温和表达。
- 每个 block 都要帮助用户做决策，不要只写情绪词。
- 避免制造焦虑，风险提醒要具体、少量、可操作。
- 不写品牌、型号、实时价格，避免内容很快过期。
- 涉及亲密关系时保持边界感，尤其是戒指、睡衣、香水、鞋子这类强信号礼物。
- 不存任意 HTML，不接收用户生成的富文本直接渲染。

## 图片和富文本

当前框架不展示图片。后续如果要加图，建议只给少量文章或礼物引用加统一风格图片，字段可以设计为：

```js
{
  type: "image",
  src: "/assets/guide/flowers/sunflower.png",
  alt: "向日葵花束"
}
```

加新 block 类型时，需要同步修改：

- `miniprogram/shared/guideContent.js`
- `miniprogram/pages/guide/index.wxml`
- `miniprogram/pages/guide/index.wxss`
- `scripts/validate-guide-content.js`
- `schemas/guide-content.schema.json`

不要直接用服务端下发的 HTML。小程序 `rich-text` 只能渲染受限节点，而且样式、点击、图片和安全都不好控。更推荐把 Markdown 在构建阶段转成 blocks，或者直接维护 blocks。

## 迁到云端的方案

当前是第一阶段：内容随小程序包发布。优点是简单、稳定、可版本管理；缺点是改内容需要发版。

第二阶段可以做“本地 Markdown/JSON 源文件 + 构建脚本”，例如：

```text
content/guides/*.md 或 *.json
scripts/build-guide-content.js
miniprogram/shared/guideContent.js
```

第三阶段适合需要运营后台或热更新时迁到 CloudBase：

- `guide_articles` 集合存标题、标签、状态、排序、正文路径、版本号。
- 正文 blocks 放数据库或 CloudBase Storage 的 JSON 文件。
- 云函数提供 `listGuideArticles` 和 `getGuideArticle`。
- 云函数返回结构建议和 `getGuideContentPayload()` 保持一致，至少包含 `version`、`channels`、`articles`。
- 小程序先请求云端内容，失败时回退到 `guideContent.js` 本地默认内容。

迁云端时仍建议保持 blocks 格式不变，这样前端渲染层不用重写。
