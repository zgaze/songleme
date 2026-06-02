# 礼物推荐协议 v3

> v3 取代 [gift-protocol-v2.md](./gift-protocol-v2.md)（v2 标记为废弃，仅作历史参考）。
>
> **设计原则**：一个字段必须有明确消费方——`字段 = 问卷产出 ∪ 卡片消费 ∪ 排序/安全所需`。
> 没有消费方的字段不进 schema，只在文末「未来钩子」里登记启用条件。这样数据可生成、可手改、可校验，不再像 v2 那样 40 字段里 26 个常年为空。

本协议有三个对象，v3 聚焦前两个：

1. `RecommendationContext` —— 用户这次送礼的意图（来自问卷）。
2. `GiftDirection` —— 礼物方向（我们维护/AI 生成，不绑定具体商品）。
3. `ProductOffer` —— 结构化商品供给（名称/链接/价格）。**v3 不做，且已决定不引入商品两层模型**（见下）。

> **2026-06-03 决定（品牌/爆品）**：推荐品保持**单层**，颗粒度到方向（如"面膜"），**不**引入 `ProductOffer` 商品层、**不**把品牌塞进方向（否则破坏方向定义边界）。改为在 `GiftDirection` 上加一个软字段 `searchKeywords`：让 DeepSeek 顺带产出几个爆品/经典款/品牌名作为**下游电商搜索的种子**。这些关键词**不参与问卷匹配/打分**，只供后续用电商平台 API 检索真实商品。

数据层一律存机器值（英文枚举 value）；中文 label 只在问卷和运营工具里维护。

---

## 1. 枚举字典

### Target 送礼对象
| value | 中文 |
|---|---|
| `partner` | 恋人 |
| `parents` | 爸妈 |
| `bestie` | 闺蜜 |

### Gender 性别（可选软信号）
| value | 中文 |
|---|---|
| `female` | 女生 |
| `male` | 男生 |

> 留空 = 通用/不限性别。**不要**为了"填满字段"硬塞性别；只在品类有明显性别倾向时标注（如香水试香→`female`，剃须护理→`male`）。性别只参与排序软加权，**永不进入推荐理由文案**。

### Scene 场景
| value | 中文 |
|---|---|
| `birthday` | 生日 |
| `anniversary` | 纪念日 |
| `festival` | 节日 |
| `apology` | 道歉/和好 |
| `daily` | 日常关心 |

### RecipientStyle 偏好风格
| value | 中文 |
|---|---|
| `practical` | 实用派 |
| `aesthetic` | 颜值控 |
| `experiential` | 体验派 |
| `quality` | 品质党 |

### ToneFit 情绪/语气（替代 v1 的 emotionalTags + visualStyle）
| value | 中文 | 典型场景 |
|---|---|---|
| `romantic` | 浪漫 | 520/七夕/情人节/恋人纪念日 |
| `memory` | 纪念感 | 纪念日、共同经历 |
| `surprise` | 惊喜 | 生日、节日 |
| `playful` | 俏皮/有趣 | 闺蜜、生日、年轻人 |
| `warm` | 温暖陪伴 | 日常、父母、家居 |
| `sincere` | 真诚/郑重 | 道歉、父母、长辈 |

> **安全规则**：标了 `romantic` 的礼物**不要**把 `apology` 写进 `scene`（道歉送暧昧礼物会翻车）。生成与入库都按此校验。

### PersonaTags 收礼人特点（多选，替代 v1 的 occupation）
混合职业 / 爱好 / 生活习惯，多选。**这是 v3 里最容易迭代的枚举**——先用下表起步，跑完第一批生成结果后再增删。

| value | 标签 | 主要礼物方向 |
|---|---|---|
| `tech_geek` | 数码控/程序猿 | 数码配件、机械键盘、桌面、护眼 |
| `office_pro` | 白领/上班族 | 通勤、桌面、解压、保温 |
| `creative` | 设计/创意人 | 文具、影像、灵感工具、审美 |
| `student` | 学生党 | 宿舍、平价质感、备考、数码 |
| `night_owl` | 夜猫子 | 助眠、暖光、护眼、香薰 |
| `homebody` | 宅家党 | 居家小家电、影音、香薰、游戏 |
| `outdoorsy` | 户外控 | 露营、便携、水壶、防晒 |
| `fitness` | 健身党 | 运动、筋膜放松、运动水壶 |
| `coffee_tea` | 咖啡/茶星人 | 咖啡器具、精品豆、茶具 |
| `foodie` | 吃货 | 甜品礼盒、巧克力、厨房小物 |
| `pet_owner` | 铲屎官 | 宠物友好生活、宠物肖像 |
| `beauty_lover` | 美妆护肤控 | 彩妆礼盒、护肤、香水 |
| `fandom_gamer` | 追星/游戏迷 | 周边收纳、应援、外设 |
| `bookish` | 文艺/阅读控 | 书影音、阅读灯、黑胶 |

### Budget 预算（统一为新枚举；旧 `under_100/100_300/300_800/800_plus` 废弃）
| value | 中文 |
|---|---|
| `under_200` | 200 元以内 |
| `200_500` | 200-500 元 |
| `500_1000` | 500-1000 元 |
| `1000_2000` | 1000-2000 元 |
| `2000_plus` | 2000 元以上 |

### CommerceType 履约类型（可选）
| value | 中文 |
|---|---|
| `ecommerce` | 电商可买（默认） |
| `o2o` | 本地/到店/预约 |

> v3 的核心履约约束是**生成阶段**：只产出"能在主流电商平台直接搜索下单的实物，或可线上预约的本地服务"。明显不可电商履约的（大件家具、装修建材、需上门安装/维护、纯线下不可买、二手、核心专业装备）**不生成**。

### RiskLevel 风险等级
| value | 中文 |
|---|---|
| `low` | 低风险 |
| `medium` | 中风险（看偏好/渠道） |
| `high` | 高风险（强依赖参数/尺码/型号） |

### Category 一级品类（用于排序破平局 + 生成去重配额）
`beauty_personal_care` 美妆个护 / `fragrance` 香水香氛 / `bags_accessories` 包袋配饰 / `digital_accessories` 数码配件 / `desk_office` 桌面办公 / `fashion_wear` 服饰鞋帽 / `food_dessert` 食品甜品 / `coffee_tea` 咖啡茶饮 / `nutrition_wellness` 营养滋补 / `home_appliance` 居家小家电 / `travel_commute` 旅行通勤 / `sports_outdoor` 运动户外 / `fandom_ip` 追星/IP/潮玩 / `books_music_video` 书影音 / `pet_lifestyle` 宠物友好生活 / `o2o_experience` 本地体验 / `custom_craft` 定制手作

### SpecificOccasion 具体节日（可选）
`none` / `520` / `qixi` / `valentines_day` / `mothers_day` / `fathers_day` / `graduation` / `new_year` / `spring_festival` / `mid_autumn` / `christmas`

### Season 季节（可选）
`spring` / `summer` / `autumn` / `winter`

---

## 2. GiftDirection v3

字段分三档：**硬必填**（缺则丢弃，不可伪造）、**软字段**（生成器尽量产出，缺失=该维度中性、不参与匹配，绝不回填假值）、**展示字段**。

| 字段 | 中文 | 类型 | 档位 | 说明 |
|---|---|---|---|---|
| `id` | ID | `string` | 硬（缺则由 name 生成） | kebab-case，全局唯一 |
| `name` | 名称 | `string` | **硬必填** | 4-12 汉字，具体到可搜索购买 |
| `category` | 一级品类 | `Category` | **硬必填** | 配额/去重/破平局 |
| `target` | 适合对象 | `Target[]` | **硬必填** | 1-3 个 |
| `scene` | 适合场景 | `Scene[]` | **硬必填** | 1-3 个；浪漫礼物勿含 `apology` |
| `budget` | 预算区间 | `Budget[]` | **硬必填** | 由商品自然决定，1-3 个 |
| `recommendReason` | 推荐理由 | `string` | **硬必填** | ≤32 字（营养滋补类 ≤40）；说明"为什么是好礼物" |
| `recipientStyle` | 适合风格 | `RecipientStyle[]` | 软 | 0-3 个 |
| `toneFit` | 情绪/语气 | `ToneFit[]` | 软 | 0-3 个，驱动场景排序与情境句 |
| `personaTags` | 适合特点 | `PersonaTags[]` | 软 | 0-4 个 |
| `gender` | 性别倾向 | `Gender[]` | 软 | 留空=通用 |
| `commerceType` | 履约 | `CommerceType` | 软 | 默认 `ecommerce` |
| `riskLevel` | 风险等级 | `RiskLevel` | 软 | 默认 `low` |
| `riskTags` | 风险短标签 | `string[]` | 软 | 存储不限量，展示取前 2；如 `看色号`/`正品渠道` |
| `requiresKnownPreference` | 需已知偏好 | `boolean` | 软 | 香水/尺码/专业品类为 true |
| `tags` | 展示标签 | `string[]` | 展示 | 2-3 个，每个 ≤6 字 |
| `pairingTags` | 搭配建议 | `string[]` | 展示 | 0-3 个，每个 ≤6 字，驱动"建议搭配" |
| `searchKeywords` | 搜索关键词 | `string[]` | 软 | 0-8 个；爆品/经典款/品牌名，**仅作下游电商搜索种子，不参与问卷匹配/打分** |
| `specificOccasions` | 具体节日 | `SpecificOccasion[]` | 软 | 仅节日相关礼物才标 |
| `seasons` | 适合季节 | `Season[]` | 软 | 留空=四季皆可 |

> 注意：v3 砍掉了 v1 的 `highlights`（并入 `tags`）、`visualStyle`/`emotionalTags`（并入 `toneFit`）、`occupation`（换成 `personaTags`），以及 v2 那批无消费方字段。前端卡片消费的 5 项是 `name` / `tags` / `recommendReason` / `pairingTags` / `imageUrl`(可选)。

### 示例

```json
{
  "id": "counter-lipstick-gift-box",
  "name": "专柜口红礼盒",
  "category": "beauty_personal_care",
  "target": ["partner", "bestie"],
  "scene": ["birthday", "festival"],
  "budget": ["500_1000"],
  "recipientStyle": ["aesthetic", "quality"],
  "toneFit": ["romantic", "surprise"],
  "personaTags": ["beauty_lover"],
  "gender": ["female"],
  "commerceType": "ecommerce",
  "riskLevel": "medium",
  "riskTags": ["看色号", "正品渠道"],
  "requiresKnownPreference": true,
  "tags": ["专柜感", "包装体面"],
  "pairingTags": ["手写卡片"],
  "searchKeywords": ["口红礼盒", "圣诞限定口红", "YSL 口红套装"],
  "specificOccasions": ["520", "qixi"],
  "seasons": [],
  "recommendReason": "有礼盒仪式感、开箱体面，适合想表达审美和用心的亲密关系。"
}
```

---

## 3. RecommendationContext（问卷答案）

与问卷 1:1 对齐——问卷 `option.value` == 这里的 value == GiftDirection 匹配字段枚举 == 打分 key。**没有派生、没有别名表。**

| 字段 | 来源问题 | 类型 | 说明 |
|---|---|---|---|
| `target` | 送给谁 | `Target` | 单选 |
| `gender` | TA 是 | `Gender` | 单选 |
| `scene` | 什么场合 | `Scene` | 单选 |
| `personaTags` | TA 的特点 | `PersonaTags[]` | **多选**（≤3） |
| `recipientStyle` | TA 平时偏哪种 | `RecipientStyle` | 单选 |
| `budget` | 大概想花多少 | `Budget` | 单选 |

> `toneFit` / `specificOccasion` / `season` 不直接问用户：`toneFit` 由 `scene` 推出偏好语气，`specificOccasion`/`season` 由服务端按当前日期推断。

---

## 4. 推荐过程

**过滤（硬）**：`target`、`budget`。其余维度只排序、不淘汰（数据集小，过度过滤会空）。

**加权排序**（建议初始权重，迁移后实测再调）：
`target 22` · `scene 18` · `recipientStyle 14` · `toneFit 12` · `personaTags 12` · `budget 10` · `gender 4`（软加权，送男生命中 female 倾向品类减分而非过滤）。

**场景安全规则**：
- `scene = apology`：排除 `toneFit` 含 `romantic` 的礼物（道歉不送暧昧）。
- `specificOccasion`/`season` 命中加分；明显反季节降权。

**破平局**（解决"一堆礼物同分"）：先比 `riskLevel`（低优先），再做 `category` 配额（top 结果同品类不超过 N 个），最后才用数组顺序。

**相关性下限**：低于阈值的进入"兜底区"，与高相关项分区或降级文案展示，避免凑数项混排。

---

## 5. 推荐理由设计（两段式）

| 段 | 字段/来源 | 何时算 | 用途 |
|---|---|---|---|
| 固有理由 | `recommendReason`（存储） | 生成时一次 | 卡片 `shortReason`（≤32 字） |
| 情境句 | 后端按命中维度现算（**不存储**） | 每次请求 | `summary` / 卡片情境行 |

**情境句不是无脑模板拼接**，按 `target × scene` 分模板组 + 白名单短语 + 槽位三级降级（命中值 → 维度默认语 → 整段省略；命中槽位 < 2 则回退纯 `recommendReason`）。例：
- 父母模板语气走「体面/日常关心/舍不得买」；
- 闺蜜模板不用恋人式暧昧词；
- `apology` 模板单独的真诚语气。

> 合规（保健品禁疗效等）**v3 暂不做**强校验，作为后续增量。

---

## 6. 弃用 v2 / 未来钩子（不进 schema，仅登记启用条件）

| 字段/概念 | 启用条件 |
|---|---|
| `ProductOffer` + `productOfferIds` + `commerceTypes`/`deliveryModes`/`searchQueries`/`offerMatchRules` | 接入真实商品供给时 |
| `subCategory` + 各 `*Label` | 需要二级品类运营时 |
| `complianceFlags` / `medical_claim` 禁词校验 | 上线保健品/营养滋补品类前 |
| `relationshipCloseness`（普通朋友/好闺蜜）、`intimacyRequired` | 闺蜜私密品类需要门控时（问卷加可选一题） |
| `ageStage` / `personalityType` / `packagingLevel` / `purchaseChannels` | 暂无消费方，不实现 |
