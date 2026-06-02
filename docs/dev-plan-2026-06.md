# 送了么 · 下一步开发计划（2026-06-03）

> 目的：从「迷茫」回到「按依赖顺序推进」。先讲清楚根因，再给分阶段、可执行的任务清单，并标出**需要你拍板的分叉点**。

> **文档地图**：本文是**全局总览 + 决定记录**。两份可交给独立 agent 直接执行的简报：
> - `docs/deepseek-script-rewrite-brief.md` —— 重写 DeepSeek 生成脚本（阶段 1）。
> - `docs/admin-tool-design.md` —— 离线管理后台前后端 + 测试（阶段 3）。

---

## 0. 先看清根因：三层说三种语言

你现在的卡点不是某个功能坏了，而是**问卷 / 数据 / 推荐算法三层各说各话**，导致后面无论生成多少礼物、做不做后台，都像在流沙上盖楼。

| 层 | 现状用的字段 | 问题 |
|---|---|---|
| 问卷 `questionnaire.config.json` | target, gender, scene, **occupation(单选·旧枚举)**, recipientStyle, budget(新枚举) | 只有 6 题；没有 emotionalTags / visualStyle / preparationTime |
| 运行时数据 `giftDirections.js`（33 条） | **旧枚举**：budget=`100_300/300_800`、emotionalTags、visualStyle、preparationTime、highlights；**没有** category / toneFit / personaTags | 是 v2 之前的老数据 |
| 推荐算法 `recommender.js` | hardFilter 用 preparationTime（问卷根本不问→**空过滤**）；打分用 emotionalTags(10)/visualStyle(8)/preparationTime(8)（问卷都不问→**死权重**）；occupation 用旧枚举；**完全不消费** category/toneFit/personaTags | 一半权重是死的，新信号一个都没用上 |
| DeepSeek 新生成数据（v3，80 条） | category, toneFit, personaTags, 新 budget 枚举 | 字段最干净，但**没人消费**——推荐算法读不懂 |

**结论**：你问的"推荐算法是不是没做完"——它能跑，但有效打分其实只剩 target/budget/scene/recipientStyle，新生成的 v3 好字段一个都没接上。所以**统一数据契约（v3）是所有事情的前置**。先把语言统一，后面生成、后台、算法才有意义。

---

## 阶段规划（按依赖排序）

### 阶段 0 · 统一 v3 数据契约（最高优先，解锁一切）

这一步不做，阶段 1 生成再多礼物也是浪费（算法读不懂）。

- [ ] **拍板分叉 A：礼物模型是「单层方向」还是「方向 + 具体爆品」两层**（见下方"需要你拍板"）。
- [x] **（已定·删除）preparationTime（送达时效）**：从 schema / recommender 的 hardFilter / 运行时数据 / docs 里清除。问卷本来就不问它，删掉消除一处空过滤。
- [ ] 迁移运行时数据 `giftDirections.js`（33 条）→ v3：budget 旧枚举映射到新枚举、补 category、把 emotionalTags/visualStyle 折叠成 toneFit、occupation→personaTags。
- [ ] 问卷 `occupation(单选)` → `personaTags(多选「TA 的特点」)`，枚举对齐 v3（程序猿/咖啡星人/铲屎官/夜猫子/白领/宅家/户外…）。
- [ ] **单一数据源 + 构建脚本**：选定 catalog 存储（见阶段 3），写 `build-gift-directions.js` 把 catalog 导出成 client/server 两份 `giftDirections.js`，并跑 schema 校验。从此数据只编辑一处。

产出：三层全部讲 v3 同一种语言。

---

### 阶段 1 · 修 DeepSeek 生成脚本（你的问题 1）

#### 1.1 前缀缓存命中率低 → 成本高
**根因**：`build_common_prefix()` 把"避免重名"的清单（最近 140 个名字）放在了 **prefix 靠前位置**（安全规则第 4 条），而这个清单每次调用都在变。DeepSeek 的上下文缓存按"最长相同前缀"命中——清单一变，它后面（枚举、字段规则、few-shot 这些最贵的静态内容）全部 miss。

**修法**：
- 把 `build_common_prefix` 改成 **100% 静态**（system + 履约原则 + 枚举 + 字段规则 + few-shot，逐字节不变）。
- 把"避免重名"清单挪到 **整个 prompt 的最末尾**，并且**只放当前品类**的近义名（清单小、且只影响尾部）。
- 这样最贵的 ~1500 token 静态前缀对所有调用都命中缓存，只有便宜的尾部 miss。

#### 1.2 结果太少 + 重复多
**重新定位**（因分叉 A 已定单层）：方向层就该停在"面膜"这种颗粒度，**方向数量本不需要很多**（覆盖到位即可，约 80~150 条）；推荐池的"丰富度"靠每条方向的 `searchKeywords`（爆品/经典/品牌）下游用电商 API 扩出真实商品。所以"太少"不再靠堆方向数解决。

**仍要治的重复**：模型爱把方向名塌缩成「X 礼盒 / X 套装」。
1. 按 `品类 × 预算档`（或 `品类 × persona`）切格子生成，每次调用探索不同子区域，天然少撞车；按格子配额停采。
2. 把"具体性"放进 `searchKeywords`（真实爆品/品牌），而不是堆到方向名里——方向名保持简洁可匹配。
3. 语义去重已有（`name_key` 去 套装/礼盒）；停止条件按**覆盖度**而非绝对条数。

#### 1.3 爆品/品牌 → ✅ 已定方案
不改两层。`GiftDirection` 新增软字段 `searchKeywords`（已加进 schema/protocol）。脚本让模型每条方向额外产 3~8 个爆品/经典款/品牌关键词，仅作下游电商搜索种子。**执行细节见 `docs/deepseek-script-rewrite-brief.md`**。

---

### 阶段 2 · 推荐算法 v3 重写（你的问题 4）

依赖阶段 0。

- [ ] 删掉 `deriveScenes/deriveRecipientStyles/deriveOccupations` 等正则启发式——这些只是为了从老数据里"猜"缺失字段，v3 数据自带显式字段后就不需要了。
- [ ] 删掉 `VALUE_ALIASES`（budget 老枚举兼容）——数据迁移后没有老值了。
- [ ] 打分接上新信号：**personaTags、toneFit** 加权；去掉问卷不问的死权重（emotionalTags/visualStyle/preparationTime）。
- [ ] 落地 v3 的安全规则：romantic 语气不进 apology 场景。
- [ ] 动态"情境句"：按 target×scene 模板拼一句话，存储的 `recommendReason` 做兜底。
- [ ] **client / server 两份推荐器收敛**：现在 `recommender.js` 和 `localRecommender.js` 权重不同、易漂移。抽成一份共享逻辑，或至少让权重表同源。

---

### 阶段 3 · 本地审核后台（你的问题 2）

人工审核/维护 推荐品(方向) + 商品(爆品)，简单增删改查，本地起服务。

**存储（已定）· 完全本地离线，不接 CloudBase**：用本地 JSON/SQLite，零基建、可 git diff。审核完一键导出运行时 JS；同步到 CloudBase 是后续**手动**步骤，不在本工具范围。
详细设计见 **`docs/admin-tool-design.md`**。

**建议形态**：
- 放仓库 `admin/`（不污染 miniprogram 构建）。
- 后端：Node + Express，读写 catalog（方案 L 的 JSON/SQLite）。
- 前端：Vite + Vue/React（或极简 HTML+fetch）。表格 + 编辑表单，**枚举下拉直接来自 schema**，保存前用 ajv 跑 `gift-direction.schema.json` 校验。
- 一个"导出到运行时"按钮 → 调阶段 0 的 `build-gift-directions.js`。
- 这个后台正好是 AI 生成流水线的**人工复核出口**：AI 批量产 → 后台审核/补爆品 → 导出。

---

### 阶段 4 · 送礼攻略命题（你的问题 3）

好消息：攻略系统已存在（`guideContent.js` 有 channels + articles + blocks 结构）。所以这是**内容扩充**，不是新建基建。

**为什么花语那篇好、其它像凑数**：花语篇有①真知识（用户不知道的）②对应问卷分支③降低送礼焦虑。复制这个套路即可。下面命题按"是否复刻这三点"挑选：

#### A. 寓意/信号系列（最值得先做，复刻花语的成功）
- 玫瑰支数 / 花色含义速查（扩充现有花语篇）
- 银饰·珍珠·诞生石的寓意与挑选
- 香水调性怎么读（花香/木质/东方调各代表什么气质）
- 送礼数量的讲究（成双、避 4/13 等民俗）
- 十二星座 / 生肖 送礼偏好

#### B. 避坑/禁忌系列（焦虑驱动，传播最好）
- 这些礼物别乱送：钟、伞、鞋、梨…（谐音与民俗禁忌）
- 第一次见对方父母，送什么不踩雷
- 智商税礼物盘点（看着高级其实鸡肋）
- 送长辈的雷区（功效话术、尺寸、忌讳）

#### C. 按对象/场景选礼（直接承接问卷分支）
- 给程序员/数码控 · 给铲屎官 · 给咖啡星人（对应 personaTags）
- 给爸妈：实用又有面子
- 异地恋怎么送（可寄、物流时效）
- 道歉/和好：该送什么、绝对别送什么

#### D. 送礼方法论（建立信任与调性）
- 怎么定送礼预算（关系阶段 × 场合）
- 礼物配卡片：文案模板
- 包装基本功：让平价礼物显贵
- 男生 3 步快速选礼法

#### E. 品类入门科普（降低决策成本，承接品类页）
- 第一支香水怎么挑 · 第一份护肤礼盒怎么选 · 手冲咖啡入门买什么 · 银饰怎么挑不过敏

**建议节奏**：先做 A + B 各 3~4 篇（最容易出彩、最像花语），用 AI 按现有 `guide-content.schema.json` 的 block 结构生成，过 `validate-guide-content.js`。

---

## 需要你拍板（这几个定了我就能开干）

### 分叉 A：礼物数据模型 —— ✅ 已定：**单层方向 + `searchKeywords` 关键词**

- 推荐品保持**单层**，颗粒度到方向（如"面膜"）。**不**引入商品(Product)两层模型，**不**把品牌塞进方向表（否则破坏方向定义边界）。
- 在 `GiftDirection` 加软字段 `searchKeywords`：DeepSeek 顺带产出几个爆品/经典款/品牌名，**仅作下游电商搜索种子**，不参与问卷匹配/打分。后续用电商平台 API 拿这些词去搜真实商品。
- 已落地：`schemas/gift-direction.schema.json` + `docs/gift-protocol-v3.md` 已加该字段。

### 分叉 B：preparationTime —— ✅ 已定：删除。

### 分叉 C：后台存储 —— ✅ 已定：完全本地离线，不接 CloudBase，事后手动同步。详见 `docs/admin-tool-design.md`。

---

## 建议的执行顺序（TL;DR）

1. **阶段 0**（统一 v3 契约）——必须先做，否则全是流沙。
2. **阶段 1**（修生成脚本：缓存 + 切分 + 允许爆品）——依赖 A 拍板。
3. **阶段 3**（后台）与 **阶段 2**（算法重写）可并行——都建在阶段 0 的 catalog 上。
4. **阶段 4**（攻略）随时可插入，独立模块、不阻塞主线。
