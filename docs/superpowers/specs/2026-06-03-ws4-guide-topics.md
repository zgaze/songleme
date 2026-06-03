# WS4 送礼攻略选题（Spec）

> 日期：2026-06-03 · 分支：`dev/app-plan-6-04`
> 上位文件：`docs/superpowers/specs/2026-06-03-app-plan-6-04-master.md`（以 Master 为准）
> 本工作流是**内容**，不是架构。攻略系统已完整实现，本 spec 只负责：补选题 + 写大纲 + 定写作规范，并给出把成稿塞进 `guideContent.js` 的精确方法和校验流程。

---

## 1. 目标与范围

### 做什么
- 给现有送礼攻略系统补充 **13 个选题**（覆盖现有 5 频道 + 新增 2 频道），每个选题给出：频道归属、一句话 hook、目标读者/场景、3–6 个 H2 大纲（映射到具体 block 类型）。
- 新增 **2 个频道**（预算分档送礼 / 道歉和好），给出 id + name + summary + note + accent，使其符合 schema。
- 制定「写作规范（去 AI 味）」，供人工/AI 写手按此填正文。
- 说明成稿如何写进 `miniprogram/shared/guideContent.js`（对象形状 + 字段约束）并用脚本校验（Master C6）。

### 不做什么（明确非目标）
- **不写正文成稿**。本 spec 只交付选题 + 大纲 + 写作规范，正文由人工的 AI 写手据此产出。
- **不改任何渲染代码**。`pages/guide/index.js`/`.wxml`/`.wxss`、schema、validator 脚本**一律不动**。攻略系统按现状渲染，本工作流仅往数据数组里加对象。
- **不新增 block 类型、不新增 accent 颜色**。schema 是封闭枚举，只能用已有的 7 种 block 和 4 种 accent。
- **不改其它工作流的文件**。本工作流只拥有 `miniprogram/shared/guideContent.js`，外加运行 `scripts/validate-guide-content.js`（只运行，不改）。

---

## 2. 现状（相关代码与事实）

### 文件
- 内容数据：`miniprogram/shared/guideContent.js`（`guideChannels` 数组 + `guideArticles` 数组 + 一组 getter；末尾 `module.exports`）。
- Schema：`schemas/guide-content.schema.json`（draft-07，定义 channel/article/各 block）。
- 校验入口：`scripts/validate-guide-content.js`（手写校验，不是 ajv；逻辑与 schema 一致但更严，且额外做交叉引用校验）。
- 渲染页：`miniprogram/pages/guide/index.js` + `index.wxml`。

### 当前内容规模
- 5 频道，每频道 1 篇，共 5 篇，全部 `status: "published"`：
  - `flowers`(花语) → `flower-language-basics`
  - `chocolate`(巧克力) → `chocolate-gift-basics`
  - `wearables`(穿戴) → `wearable-boundaries`
  - `jewelry`(饰品) → `jewelry-signal-guide`
  - `closeness`(亲密等级) → `relationship-stage-guide`

### 渲染如何消费数据（`pages/guide/index.js`）
- 页面只渲染**已发布**内容：`getPublishedGuideChannels()`（过滤掉没有已发布文章的频道）、`getPublishedGuideArticlesByChannel()`、`getGuideArticleById()`（只返回 `status==="published"`）。
- 频道横向 chip → 选中后取该频道第一篇为默认；文章卡片列表**仅当 `articles.length > 1` 才显示**（即频道下≥2 篇才出现文章切换条，单篇时直接展示正文）。**结论：新频道每个至少放 1 篇即可上线；若想出现文章切换条则放 ≥2 篇。**
- block 渲染（`index.wxml` 58–114 行）逐类型 if/elif，支持全部 7 种 block。各 block 的 `id` 仅做 `wx:key`，不展示。

### Block 类型与字段（来自 schema + wxml，写手必须严格遵守）
| type | 必填字段 | 渲染表现 | 写作用途 |
|------|---------|---------|---------|
| `heading` | `id,type,text` | 小标题（H2 感） | 段落分隔的小标题 |
| `paragraph` | `id,type,text` | 正文段 | 开篇钩子、过渡说明 |
| `tip` | `id,type,title,text` | 「建议」标签 + 标题 + 一段文字 | 一句话稳妥建议/避雷提醒 |
| `list` | `id,type,title,items[]` | 标题 + 圆点列表 | 罗列要点/坑（无勾选语义） |
| `checklist` | `id,type,title,items[]` | 标题 + ✓ 列表 | 下单前/送出前可执行检查清单 |
| `compare` | `id,type,title,items[]`，每项 `{label,good,caution}` | 标题 + 多卡片，每卡 标签/适合/注意 | 多选项横向对比（最有信息量的 block） |
| `giftRefs` | `id,type,title,items[]`，每项 `{name,note}` | 标题 + 礼物方向卡（名称+说明） | 引用礼物方向，给落地抓手 |

- **重要**：`giftRefs.items` 只有 `name` 和 `note` 两个**字符串**字段，schema **没有** giftId 字段。引用真实礼物的方式是把礼物方向**名称**写进 `name`（与 `giftDirections.js` 的 `name` 对齐，便于读者在结果页认出），id 仅作写手内部映射参考，不进数据。

### 字段枚举约束（validator 会逐项校验，违反即报错退出码 1）
- `channel.accent` ∈ `{blue, pink, green, apricot}`（**没有更多颜色**；新频道只能复用这 4 个）。
- `article.status` ∈ `{published, draft}`。
- `article.readingMinutes`：整数，1–15。
- `article.tags`：1–6 个非空字符串。
- `article.updatedAt`：`YYYY-MM-DD`。
- `article.scenes[]` 必须 ∈ 问卷 `scene` 选项：**`birthday, anniversary, festival, apology, daily`**。
- `article.targets[]` 必须 ∈ 问卷 `target` 选项：**`partner, parents, bestie`**。
- `article.budgets[]` 必须 ∈ 问卷 `budget` 选项：**`under_200, 200_500, 500_1000, 1000_2000, 2000_plus`**。
- id（channel/article/block）正则：`^[a-z][a-z0-9_]*(-[a-z0-9_]+)*$`（小写字母开头，可含数字/下划线/中划线分段）。
- 交叉引用：`channel.articleIds` 里的每个 id 必须存在、不重复、且该文章的 `channelId` 指回本频道；`article.channelId` 必须指向存在的频道。**频道与文章是双向引用，两边都要写。**

> ⚠️ 极易踩的坑：`budgets` 用的是**问卷预算枚举**（`under_200/200_500/...`），**不是** `giftDirections.js` 里的预算枚举（那套是 `under_100/100_300/300_800/800_plus`）。两套预算枚举不一样。攻略文章一律用问卷那套，否则 `validateEnumArray` 报「not in questionnaire options」。

### 可引用的真实礼物方向（`giftDirections.js` 的 id → name，供 giftRefs 写手参考）
`photo-book 定制照片书` / `same-day-flowers-dessert 鲜花甜品组合` / `massage-device 肩颈按摩仪` / `coffee-gift-box 咖啡礼盒` / `digital-membership 数字会员礼物` / `home-textile 舒适家居织物` / `aroma-night-light 香氛小夜灯` / `craft-experience 手作体验券` / `wellness-tea-box 养生茶礼盒` / `soft-scarf 质感围巾` / `digital-photo-frame 电子相框` / `handmade-chocolate 手工巧克力` / `perfume-discovery-set 香水小样套装` / `skincare-travel-set 护肤旅行套装` / `smart-speaker 智能音箱` / `heated-eye-mask 蒸汽眼罩礼盒` / `desk-plant 桌面绿植` / `dinner-voucher 餐厅礼券` / `custom-mug 定制马克杯` / `sleep-pillow 助眠枕` / `music-box 八音盒` / `wool-blanket 羊毛毯` / `art-print 装饰画` / `fruit-gift-box 水果礼盒` / `bath-care-set 沐浴护理套装` / `travel-storage-set 旅行收纳套装` / `instant-camera 拍立得相机` / `fountain-pen 钢笔礼盒` / `sleep-spray 助眠喷雾` / `hobby-kit 兴趣体验套装` / `couple-bracelet 情侣手链` / `star-projector-light 星空投影灯` / `custom-calendar 定制日历`

> giftRefs 写 `name` 时**优先用上表里的真实名称**（如「定制照片书」「星空投影灯」），读者在结果页能对得上；确需泛指时也可写「小份甜品」「手写卡片」这类通用方向（现有文章就这么做的）。

---

## 3. 改动清单（file-by-file）

唯一改动文件：`miniprogram/shared/guideContent.js`。两处数组追加，频道与文章双向挂接。

### 3.1 `guideChannels` 追加 2 个新频道对象

追加到 `guideChannels` 数组末尾（`closeness` 之后）。形状与现有频道一致：

```js
{
  id: "budget_tier",            // 频道 id，唯一，符合正则
  name: "预算分档",              // chip 上显示的短名（建议 ≤4 字）
  summary: "同样的钱，花在对方真正在意的点上，比硬凑价位更显心意。",
  note: "预算不是越高越好；超出关系阶段的贵重礼物反而制造压力。",
  accent: "green",              // 只能取 blue/pink/green/apricot
  articleIds: ["budget-under-200-ideas", "budget-mid-tier-pick"], // 必须与下方文章 id 对应且 channelId 指回 budget_tier
},
{
  id: "reconcile",
  name: "道歉和好",
  summary: "道歉礼物的重点是先把话说清楚，礼物只是行动的补充，不是替代。",
  note: "别用价格替代道歉；越贵的礼物越容易被理解成在花钱买原谅。",
  accent: "apricot",
  articleIds: ["apology-gift-do-dont", "make-up-after-fight"],
},
```

- accent 分配建议（避免与相邻频道撞色，纯视觉，无逻辑约束）：`budget_tier → green`、`reconcile → apricot`。
- `articleIds` 数组里列出该频道下**所有**已发布文章 id；顺序即文章切换条顺序（第一个为默认展示）。

### 3.2 `guideArticles` 追加文章对象

每篇文章对象形状（必填字段，validator 全部检查）：

```js
{
  id: "couple-festival-ritual",         // 唯一，符合正则
  channelId: "flowers",                 // 必须指向存在的频道，且该频道 articleIds 要包含本 id
  status: "published",                  // 想暂存可用 "draft"（不会渲染，但仍参与 id/引用校验）
  title: "情侣节日怎么送更有仪式感",       // 标题，对应用户给的「情侣节日如何更有仪式感？」选题
  subtitle: "仪式感不是花得多，是把对方记在心上的细节做出来。", // 可选，但建议都写
  summary: "适合情人节、纪念日、对方生日前临时补救仪式感。",   // 文章卡上的一句话简介，必填
  updatedAt: "2026-06-03",              // YYYY-MM-DD
  readingMinutes: 3,                    // 1–15 整数；按大纲估，3 个 H2 约 2–3 分钟
  tags: ["情侣", "仪式感", "节日"],       // 1–6 个
  scenes: ["anniversary", "festival", "birthday"], // ∈ birthday/anniversary/festival/apology/daily
  targets: ["partner"],                 // ∈ partner/parents/bestie
  budgets: ["under_200", "200_500", "500_1000"],   // ∈ under_200/200_500/500_1000/1000_2000/2000_plus
  blocks: [ /* ≥1 个 block，见各篇大纲 */ ],
}
```

- block 的 `id` 在**同一篇文章内唯一**即可（不同文章可重名，如每篇都用 `opening`）。
- 双向挂接：每追加一篇文章，记得把它的 id 加到对应频道的 `articleIds`（3.1 已为新频道预留；给**老频道**加文章时，要去改老频道对象的 `articleIds` 数组——这是对老频道对象的唯一允许改动）。

### 3.3 不需要改动的部分
- `GUIDE_CONTENT_VERSION`：可选地从 `"2026-05-31-static-v1"` 升一版（如 `"2026-06-03-static-v2"`）以标识内容更新；不升也不影响功能。**建议升版**便于排查缓存。
- getter 函数、`module.exports`：完全不动。

---

## 4. 选题清单（13 篇 + 2 新频道）

> 语气基线（用户给的范例）：「情侣节日如何更有仪式感？」「男性不懂化妆礼必看？」——具体、略带标题党但有用、干货优先、去 AI 味。
> 每篇给出：频道 / 建议文章 id / title / 一句话 hook（可做 subtitle 或开篇 paragraph）/ 目标读者·场景 / 3–6 个 H2 大纲（标注 block 类型）。giftRefs 引用尽量用第 2 节真实礼物名。

### 频道：flowers（花语）

**1. 情侣节日怎么送更有仪式感**
- id：`couple-festival-ritual`
- hook：仪式感不是花得多，是把对方记在心上的细节做出来。
- 读者/场景：partner；anniversary/festival/birthday；budgets `under_200,200_500,500_1000`
- 大纲：
  1. 开篇 `paragraph`：先否定「贵=有仪式感」，点出仪式感=时间+专属+被记住。
  2. `compare`「三种仪式感强度」：仅卡片 / 花+卡片+小物 / 制造一个时刻（label/good/caution）。
  3. `checklist`「提前要确认的事」：花粉过敏、收花地点、配送时间是否赶得上、卡片别太用力。
  4. `giftRefs`「能加仪式感的搭配」：`鲜花甜品组合`(当天到手)、`星空投影灯`(把氛围搬进卧室)、`手写卡片`(写清为什么选这束)。
  5. 结尾 `tip`「一句话行动」：定个时间点（饭后/睡前），把礼物和那句话一起给出去。

**2. 异地恋节日送什么不踩雷**
- id：`long-distance-festival-gift`
- hook：人不在身边，礼物要解决「送达」和「同步在场感」两件事。
- 读者/场景：partner；festival/anniversary/daily；budgets `under_200,200_500`
- 大纲：
  1. `paragraph`：异地的核心矛盾——配送不可控 + 缺少共同在场。
  2. `list`「异地容易翻车的点」：易碎/易化、配送地址变动、时差/到货延迟、对方不在家收不到。
  3. `compare`「按到达方式选」：即时数字礼 / 可寄实物 / 可同步体验（label/good/caution）。
  4. `giftRefs`：`数字会员礼物`(秒到)、`定制日历`(每月想到你)、`鲜花甜品组合`(同城代送)。
  5. `tip`：约个视频时间一起拆，比单纯寄到更像「在一起过」。

### 频道：wearables（穿戴）

**3. 男生不懂化妆/护肤礼物必看**
- id：`men-buy-beauty-gift`
- hook：不懂没关系，记住三条避雷线就不会送错。
- 读者/场景：partner；birthday/festival/anniversary；budgets `under_200,200_500,500_1000`
- 大纲：
  1. `paragraph`：直说男生选美妆礼最常见的恐惧（怕选错色号/肤质），给定心丸：选「不挑人」的品类。
  2. `compare`「按风险从低到高」：护肤套装(低)/香水(中)/底妆色号(高)（label/good/caution）。
  3. `checklist`「下单前问清/查清」：肤质（干油敏）、有无固定在用品牌、是否过敏、别买底妆色号。
  4. `list`「新手三条铁律」：优先小样/套装、避开需要精确匹配的、留好退换空间。
  5. `giftRefs`：`护肤旅行套装`(安全实用)、`香水小样套装`(不押注单一香型)、`沐浴护理套装`(几乎不挑人)。
  6. `tip`：拿不准就送「小样套装」，把选择权交回给她。

**4. 香水当礼物：怎么选不踩雷**
- id：`perfume-gift-no-fail`
- hook：香水是高风险礼物，先别买正装。
- 读者/场景：partner；birthday/anniversary/festival;budgets `200_500,500_1000`
- 大纲：
  1. `paragraph`：香水=气味记忆，主观性极强，押错整瓶都白搭。
  2. `compare`「香调大类怎么选」：清新/花香/木质/甜香（label/good/caution）。
  3. `checklist`「确认信息」：对方现在用什么味、喜欢清淡还是浓、季节、有没有香精过敏。
  4. `giftRefs`：`香水小样套装`(让对方自己挑出本命香)。
  5. `tip`：第一次送香水，永远选小样套装而不是正装。

### 频道：jewelry（饰品）

**5. 第一次送饰品，送什么不越界**
- id：`first-jewelry-not-overstep`
- hook：饰品信号有强弱，戒指和耳钉完全不是一个量级。
- 读者/场景：partner/bestie；birthday/anniversary/festival；budgets `200_500,500_1000,1000_2000`
- 大纲：
  1. `paragraph`：饰品会被长期看见、被人问起，信号比食品强得多。
  2. `compare`「信号强弱排序」：耳饰/手链(弱-中)、项链(中)、戒指(强)（label/good/caution）。
  3. `list`「比价格更重要的细节」：低敏材质、日常能戴、可调尺寸、包装别过度。
  4. `giftRefs`：`情侣手链`(刻字专属、低调)、`八音盒`(纪念向、非贴身、压力小)。
  5. `tip`：关系没明确前，别送戒指；耳饰/手链更安全。

### 频道：chocolate（巧克力）

**6. 巧克力礼盒怎么送不显得敷衍**
- id：`chocolate-not-careless`
- hook：巧克力不是廉价，是「随手」让它显廉价。
- 读者/场景：partner/bestie；festival/birthday/daily；budgets `under_200,200_500`
- 大纲：
  1. `paragraph`：巧克力被理解为好感，但份量大/口味单一/裸装会变成凑数。
  2. `compare`「口味怎么选」：黑巧/牛奶/手工（label/good/caution）。
  3. `list`「容易踩坑」：临期易化、只选自己爱吃、包装太隆重制造压力、没问控糖忌口。
  4. `giftRefs`：`手工巧克力`(轻仪式、好搭配)，搭 `手写卡片` 把心意补足。
  5. `tip`：不确定口味就选小份多口味礼盒，靠包装和卡片补心意。

### 频道：closeness（亲密等级）

**7. 暧昧期送礼，怎么有心意又留余地**
- id：`crush-stage-gift`
- hook：暧昧期的礼物要「有点特别」，但别逼对方表态。
- 读者/场景：partner/bestie；birthday/daily/festival；budgets `under_200,200_500`
- 大纲：
  1. `paragraph`：暧昧期的核心是降低对方的回应压力。
  2. `compare`「合适 vs 过界」：可消耗/小物(合适)、强暗示如戒指睡衣(过界)（label/good/caution）。
  3. `checklist`「送之前自检」：是否会逼对方表态、对方是否真会用、是否说得清选择理由。
  4. `giftRefs`：`咖啡礼盒`(轻、可分享)、`桌面绿植`(日常陪伴、不暧昧过头)、`手工巧克力`(轻甜)。
  5. `tip`：暧昧期最稳的是「可分享、可消耗、低负担」。

**8. 给爸妈送礼，怎么送他们才真的用**
- id：`gift-for-parents-actually-used`
- hook：父母礼物的最大浪费是「买了，但他们舍不得用」。
- 读者/场景：parents；birthday/festival/daily；budgets `200_500,500_1000,1000_2000`
- 大纲：
  1. `paragraph`：父母礼物的目标不是惊喜，是实用、安心、低学习成本。
  2. `list`「父母不会用的礼物特征」：操作复杂、太花哨、需长期维护、贵到舍不得用。
  3. `compare`「高频生活场景切入」：睡眠/肩颈/茶饮/家居（label/good/caution）。
  4. `giftRefs`：`肩颈按摩仪`(易理解价值)、`养生茶礼盒`(日常可用)、`羊毛毯`(温暖耐用)、`智能音箱`(易上手陪伴)。
  5. `tip`：选他们每天都会碰到的东西，比「贵但供着」强。

### 新频道：budget_tier（预算分档）

**9. 200 元以内，怎么送得不像便宜货**
- id：`budget-under-200-ideas`
- hook：预算低不丢人，「看起来在凑数」才丢人。
- 读者/场景：partner/parents/bestie；birthday/daily/festival；budgets `under_200`
- 大纲：
  1. `paragraph`：低预算的关键是把钱花在「精致感」和「专属感」上，而不是堆量。
  2. `list`「低价显廉价的几个雷」：裸装、太大份、明显凑单、毫无专属。
  3. `compare`「低预算三条路线」：可消耗精致款/小定制/体验小券（label/good/caution）。
  4. `giftRefs`：`手工巧克力`、`香氛小夜灯`、`定制马克杯`(小定制提升专属感)、`桌面绿植`。
  5. `tip`：200 以内优先「小而精+一句具体祝福」，别追求量。

**10. 预算 500–1000，怎么花在刀刃上**
- id：`budget-mid-tier-pick`
- hook：中等预算最容易「花了不少，但没记忆点」。
- 读者/场景：partner/parents；birthday/anniversary/festival；budgets `500_1000`
- 大纲：
  1. `paragraph`：中预算的陷阱是买个「中规中矩的贵东西」，没有专属和记忆。
  2. `compare`「把钱花在哪类更值」：长期高频用/共同时间/可承载回忆（label/good/caution）。
  3. `checklist`「下手前确认」：对方是否真会长期用、有没有更便宜替代、是否有专属/回忆点。
  4. `giftRefs`：`餐厅礼券`(共同时间)、`电子相框`(承载回忆)、`质感围巾`(贴身实用)、`智能音箱`。
  5. `tip`：同价位优先「能长期用」或「能变成一段相处」的。

### 新频道：reconcile（道歉和好）

**11. 道歉礼物怎么送，才不像花钱买原谅**
- id：`apology-gift-do-dont`
- hook：道歉礼物送错，比不送更糟。
- 读者/场景：partner/bestie；apology；budgets `under_200,200_500`
- 大纲：
  1. `paragraph`：先讲清楚——礼物是道歉的补充，不是替代；越贵越像「拿钱了事」。
  2. `compare`「该送 vs 别送」：小而具体/对方在意的事(该)、突然的贵重物(别)（label/good/caution）。
  3. `checklist`「送之前先做到」：先把话说清、承认具体错在哪、给改的行动、别要求对方立刻原谅。
  4. `giftRefs`：`手写卡片`(把话写清)、`鲜花甜品组合`(克制但有诚意)、对方平时在意的小物。
  5. `tip`：先道歉、再补礼物；顺序反了等于没道歉。

**12. 吵架后怎么和好，礼物只占三成**
- id：`make-up-after-fight`
- hook：和好靠沟通，礼物是台阶，不是答案。
- 读者/场景：partner；apology/daily；budgets `under_200,200_500`
- 大纲：
  1. `paragraph`：把「和好」拆成沟通 70%+ 行动 20%+ 礼物 10%，先调预期。
  2. `list`「和好时别犯的错」：用礼物逃避对话、翻旧账、要求对方马上没事、礼物用力过猛。
  3. `tip`「时机」：情绪还在峰值时别送，等能好好说话了再给。
  4. `giftRefs`：`手工巧克力`(轻、给台阶)、`香氛小夜灯`(缓和气氛)、`手写卡片`。
  5. 结尾 `tip`「一句话行动」：先约一次好好聊，礼物当作「我想修复」的信号附上。

### 频道：closeness（亲密等级，补第 2 篇）

**13. 给同事/普通朋友送礼，怎么不尴尬**
- id：`gift-for-colleague-friend`
- hook：关系不深时，礼物要「轻到对方不用还人情」。
- 读者/场景：bestie；festival/birthday/daily；budgets `under_200,200_500`
- 大纲：
  1. `paragraph`：弱关系送礼的核心是低负担、无暗示、不让对方欠人情。
  2. `compare`「合适 vs 让人有压力」：可消耗/通用小物(合适)、贴身/贵重(有压力)（label/good/caution）。
  3. `list`「弱关系避雷」：太私人(香水睡衣)、太贵、带强烈个人暗示、需要回礼的高价位。
  4. `giftRefs`：`咖啡礼盒`、`水果礼盒`(接受度高)、`蒸汽眼罩礼盒`(轻关心)、`桌面绿植`。
  5. `tip`：弱关系送「人人能用、不贵、不私人」的，最安全。

> 选题归属汇总（频道→文章 id，写进各频道 `articleIds`）：
> - flowers：`flower-language-basics`(既有)、`couple-festival-ritual`、`long-distance-festival-gift`
> - wearables：`wearable-boundaries`(既有)、`men-buy-beauty-gift`、`perfume-gift-no-fail`
> - jewelry：`jewelry-signal-guide`(既有)、`first-jewelry-not-overstep`
> - chocolate：`chocolate-gift-basics`(既有)、`chocolate-not-careless`
> - closeness：`relationship-stage-guide`(既有)、`crush-stage-gift`、`gift-for-parents-actually-used`、`gift-for-colleague-friend`
> - budget_tier（新）：`budget-under-200-ideas`、`budget-mid-tier-pick`
> - reconcile（新）：`apology-gift-do-dont`、`make-up-after-fight`
>
> 共 13 篇新文章 + 5 篇既有 = 18 篇；7 频道（5 既有 + 2 新）。每频道≥2 篇 → 全频道都会出现文章切换条。

---

## 5. 写作规范（去 AI 味）

> 这一节给正文写手（人或 AI）。目标是让攻略读起来像一个会送礼的朋友在给你支招，而不是一篇模板化的「软文」。

### 必须做
1. **具体场景 + 具体数字**：不说「价格适中」，说「200 元以内」「500–1000」。不说「提前准备」，说「定制类要留出 3–7 天」。
2. **可执行清单**：`checklist`/`list` 的每一项都要能直接照做或照查（「确认对方是否花粉过敏」「问清是干皮还是油皮」），不要写「用心挑选」这种废话。
3. **避雷 + 反例**：`compare` 的 `caution` 字段、`list` 的「容易踩坑」，要写真实会犯的错（「只选自己爱吃的口味」「香水直接买正装」）。每篇至少 1 处反例。
4. **第一人称口语**：可以用「你」「对方」「他/她」，可以说「拿不准就…」「我一般会…」。短句优先。
5. **每篇结尾给一句话行动建议**：用一个 `tip` block 收尾，给一个能立刻执行的动作（「拿不准就送小样套装」「先道歉、再补礼物」）。
6. **giftRefs 落地**：每篇尽量有 1 个 `giftRefs` block，`name` 优先用第 2 节的真实礼物名，`note` 写「为什么在这个场景用它」，而不是复述商品卖点。

### 禁止做
- **忌空泛套话**：删掉「在这个特别的日子里」「礼物承载着满满的爱意」「相信对方一定会感动」这类话。
- **忌排比口号 / 三连金句**：不要「不是…而是…」连用三段，不要「既要…又要…还要…」堆砌。每篇最多保留 1 处对仗，多了就是 AI 味。
- **忌全篇 compare/全篇 list**：block 类型要混搭（见各篇大纲），至少包含 1 个 `paragraph` 开篇 + 1 个结构化 block（compare/checklist/list）+ 1 个收尾 `tip`。
- **忌假数据**：不要编造不存在的礼物名、不要给具体品牌价格背书。礼物名只用第 2 节列表里的，或「手写卡片/小份甜品」这类通用方向。
- **忌「万能正确但没用」的建议**：「根据对方喜好选择」属于废话，要落到「怎么知道对方喜好」（去问、看朋友圈、看 ta 在用什么）。

### 文风长度参考
- `paragraph` 单段 60–120 字，最多 2 句到 3 句。
- `compare` 3–4 个 item，每个 `good`/`caution` 各 ≤ 30 字。
- `checklist`/`list` 3–5 项，每项 ≤ 20 字。
- 整篇 `readingMinutes` 估 2–4 分钟（对应 4–6 个 block）。

---

## 6. 成稿如何写进 guideContent.js + 校验（Master C6）

### 步骤
1. 打开 `miniprogram/shared/guideContent.js`。
2. **加新频道**：把第 3.1 节的 2 个频道对象追加到 `guideChannels` 数组末尾。
3. **挂接老频道新文章**：对 flowers / wearables / jewelry / chocolate / closeness，把本次新增文章 id 追加进各自频道对象的 `articleIds` 数组（见第 4 节末尾汇总）。
4. **加文章**：把 13 篇成稿（按第 3.2 节对象形状 + 第 4 节大纲）追加到 `guideArticles` 数组末尾。先写 `status: "draft"` 也可以，校验照样过且不渲染，定稿后改 `"published"`。
5. （建议）把 `GUIDE_CONTENT_VERSION` 升一版，如 `"2026-06-03-static-v2"`。
6. **不要**动 getter 函数和 `module.exports`。

### 校验（必须通过，Master C6）
```sh
node scripts/validate-guide-content.js
```
- 期望输出 `Guide content checks passed.`，退出码 0。
- 若有 `Warning: Article X is not referenced by channel Y` —— 说明文章的 `channelId` 指了某频道，但该频道 `articleIds` 没列它（漏挂接），去补 `articleIds`。Warning 不阻断，但应清零。
- 常见 `Error` 与原因：
  - `... is not in questionnaire options: <值>` → `scenes/targets/budgets` 用错枚举（最常见是 budgets 用了 giftDirections 那套 `under_100/100_300`，应改成 `under_200/200_500/...`）。
  - `.accent must be one of blue/pink/green/apricot` → 新频道 accent 用了非法值。
  - `Duplicate article id` / `... must be a valid lowercase id` → id 重复或不符合正则。
  - `.channelId points to missing channel` → 文章 channelId 拼错或频道没加。
  - block 报错（`.type is not supported` / `.items must be ...` / `.text is required`）→ block 字段不全或类型写错，对照第 2 节 block 表。

### 微信开发者工具内自测
1. 用微信开发者工具打开项目，编译。
2. 进入「送礼攻略」页（首页「送礼攻略」按钮进入，或底 tab）。
3. 横向频道条应看到 7 个频道（含「预算分档」「道歉和好」）；逐个点开。
4. 频道下 ≥2 篇时，应出现文章卡片横滑条；点不同卡片，正文区切换。
5. 逐篇核对 block 渲染：`compare` 三栏、`checklist` 带 ✓、`giftRefs` 礼物卡都正常显示，无空白块（空白块通常是 block 字段缺失但被渲染兜底）。
6. `draft` 状态的文章应**不出现**在频道里（验证发布开关生效）。

---

## 7. 边界情况与错误处理

- **新频道无已发布文章**：若 2 篇都写成 `draft`，`getPublishedGuideChannels()` 会过滤掉该频道，频道条不显示该频道——属预期，定稿改 `published` 即可。校验脚本要求「至少一个频道含已发布文章」，但不要求每个频道都有，所以全 draft 的新频道不会让校验失败（只是页面不显示）。
- **单篇频道不出现切换条**：若某频道最终只有 1 篇已发布，`articles.length > 1` 为假，文章切换条不显示，直接展示那一篇正文——属预期，不是 bug。
- **budgets/scenes/targets 留空**：schema/validator 允许空数组（只校验「数组里的每个值」合法）。但建议至少填 1 个，否则未来按 scene/target 做过滤时这篇会被漏掉。本工作流统一**都填**。
- **giftRefs 引用了不存在的礼物名**：schema 不校验 name 是否对得上真实礼物（只是字符串）。写手要自律用第 2 节真实名；用通用方向（手写卡片等）也允许。
- **同篇 block id 重复**：validator 报 `.id duplicates`；同篇内每个 block id 必须唯一。跨篇可重名。
- **readingMinutes 越界**：必须 1–15 整数；写 0 或 16 报错。
- **编辑老频道对象误删既有文章 id**：给老频道 `articleIds` 追加时只**追加**，别覆盖既有 id，否则既有文章会从频道脱挂（产生 Warning + 该文章在页面消失）。

---

## 8. 验收清单

- [ ] `guideChannels` 新增 `budget_tier`、`reconcile` 两个频道，字段齐全、accent 合法。
- [ ] 5 个老频道的 `articleIds` 已追加对应新文章 id（仅追加，未删既有）。
- [ ] `guideArticles` 新增 13 篇文章，均按第 3.2 节形状、第 4 节大纲，block 类型混搭、含开篇 paragraph 与结尾 tip。
- [ ] 所有 `scenes/targets/budgets` 用问卷枚举（特别是 budgets 用 `under_200/200_500/...`）。
- [ ] 每篇至少 1 个 `giftRefs`，name 尽量用真实礼物名。
- [ ] `node scripts/validate-guide-content.js` 输出 `Guide content checks passed.`，**零 Warning**。
- [ ] 微信开发者工具内：7 频道可见、文章可切换、各 block 正常渲染、draft 文章不显示。
- [ ] 正文符合「写作规范（去 AI 味）」：有具体数字/可执行清单/反例/口语/结尾行动建议；无套话/排比口号。
