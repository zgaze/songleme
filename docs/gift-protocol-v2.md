# 礼物推荐协议 v2 草案

本文定义礼物推荐系统的三层协议：

1. `RecommendationContext`：问询/用户意图上下文。
2. `GiftDirection`：推荐品/礼物方向，由我们维护和生成，不绑定具体商品。
3. `ProductOffer`：商品供给，来自电商/本地电商/O2O，第一版只保留名称、链接、价格。

设计目标：

- 推荐逻辑、前端展示、商品供给解耦。
- 所有字段都有中文名，枚举都有中文 label，方便运营、标注和前端展示。
- 保留当前 v1 字段兼容，但为品类、履约、渠道、风险、节日、季节、专业门槛预留结构化字段。

## 关系模型

推荐品和商品表推荐使用 **一对多** 作为主关系：

```text
GiftDirection 1 -> N ProductOffer
```

例如：

- `专柜口红礼盒` 是一个 `GiftDirection`
- 它可以挂多个 `ProductOffer`：不同平台、不同价位、不同店铺的口红礼盒

同时，系统允许一个 `ProductOffer` 被多个 `GiftDirection` 引用，但这不是主建模方向。例如“某款护手霜礼盒”既可挂到 `护手霜礼盒`，也可挂到 `妈妈身体护理礼盒`。如果后续需要显式管理这种多对多关系，可以增加中间表 `GiftOfferBinding`。

第一阶段建议：

- `GiftDirection.productOfferIds?: string[]`
- `ProductOffer.giftDirectionIds?: string[]`

但推荐流程仍以 `GiftDirection -> ProductOffer[]` 为主。

## 枚举字典约定

业务数据中存机器值，协议文档和运营工具使用中文 label。

示例：

```json
{
  "budget": ["500_1000"],
  "budgetLabel": "500-1000 元"
}
```

建议：

- 数据层必存机器值。
- 关键运营字段可冗余中文名，例如 `categoryLabel`、`subCategoryLabel`。
- 推荐结果可返回 `display`，降低前端查字典成本。

## 核心枚举

### Target 送礼对象

| 值 | 中文名 |
|---|---|
| `partner` | 恋人 |
| `parents` | 爸妈 |
| `bestie` | 闺蜜 |

### Gender 性别

| 值 | 中文名 |
|---|---|
| `female` | 女生 |
| `male` | 男生 |
| `unknown` | 不确定 |

### AgeStage 年龄/阶段

| 值 | 中文名 |
|---|---|
| `student` | 学生 |
| `young_worker` | 年轻上班族 |
| `middle_aged` | 中年 |
| `elder` | 长辈 |
| `unknown` | 不确定 |

### RelationshipCloseness 关系亲密度

| 值 | 中文名 |
|---|---|
| `normal` | 普通关系 |
| `close` | 亲近 |
| `very_close` | 很亲密 |

### Scene 场景

| 值 | 中文名 |
|---|---|
| `birthday` | 生日 |
| `anniversary` | 纪念日 |
| `festival` | 节日 |
| `apology` | 道歉/和好 |
| `daily` | 日常关心 |

### SpecificOccasion 具体节日/事件

| 值 | 中文名 |
|---|---|
| `none` | 无具体节日 |
| `520` | 520 |
| `qixi` | 七夕 |
| `valentines_day` | 情人节 |
| `mothers_day` | 母亲节 |
| `fathers_day` | 父亲节 |
| `graduation` | 毕业季 |
| `new_year` | 新年 |
| `spring_festival` | 春节 |
| `mid_autumn` | 中秋 |
| `christmas` | 圣诞 |
| `start_school` | 入学/开学 |
| `new_job` | 入职 |

### Season 季节

| 值 | 中文名 |
|---|---|
| `spring` | 春季 |
| `summer` | 夏季 |
| `autumn` | 秋季 |
| `winter` | 冬季 |
| `unknown` | 不确定 |

### PersonalityType E/I 倾向

| 值 | 中文名 |
|---|---|
| `E` | 偏 E / 外向 |
| `I` | 偏 I / 内向 |
| `unknown` | 不确定 |

### Budget 预算

| 值 | 中文名 |
|---|---|
| `under_200` | 200 元以内 |
| `200_500` | 200-500 元 |
| `500_1000` | 500-1000 元 |
| `1000_2000` | 1000-2000 元 |
| `2000_plus` | 2000 元以上 |

### PreparationTime 准备时间

| 值 | 中文名 |
|---|---|
| `today` | 今天 |
| `tomorrow` | 明天 |
| `within_3_days` | 3 天内 |
| `within_7_days` | 7 天内 |
| `after_7_days` | 7 天以上 |

### CommerceType 履约类型

| 值 | 中文名 |
|---|---|
| `ecommerce` | 电商 |
| `local_ecommerce` | 本地电商/即时零售 |
| `o2o` | O2O 到店/预约 |
| `mixed` | 多履约方式 |

### DeliveryMode 交付方式

| 值 | 中文名 |
|---|---|
| `delivery` | 快递配送 |
| `same_day` | 当日达 |
| `instant` | 即时送达 |
| `pickup` | 到店自提 |
| `reservation` | 预约核销 |
| `digital` | 数字交付 |

### PurchaseChannel 购买渠道

| 值 | 中文名 |
|---|---|
| `official_flagship` | 官方旗舰店 |
| `brand_self` | 品牌自营 |
| `counter` | 专柜 |
| `chain_pharmacy` | 连锁药房 |
| `supermarket` | 大型商超 |
| `local_store` | 本地门店 |
| `platform_store` | 平台店铺 |
| `o2o_platform` | O2O 平台 |

### PackagingLevel 包装感

| 值 | 中文名 |
|---|---|
| `gift_box` | 礼盒感强 |
| `decent` | 体面包装 |
| `normal` | 普通包装 |
| `weak` | 包装感弱 |

### RiskLevel 风险等级

| 值 | 中文名 |
|---|---|
| `low` | 低风险 |
| `medium` | 中风险 |
| `high` | 高风险 |

### RiskType 风险类型

| 值 | 中文名 |
|---|---|
| `authenticity` | 正品渠道风险 |
| `shade` | 色号风险 |
| `skin` | 肤质/成分风险 |
| `scent` | 气味偏好风险 |
| `size` | 尺码风险 |
| `style` | 风格审美风险 |
| `compatibility` | 设备兼容风险 |
| `professional_params` | 专业参数风险 |
| `reservation` | 预约时间风险 |
| `cold_chain` | 冷链/保鲜风险 |
| `allergy` | 过敏/忌口风险 |
| `maintenance` | 清洁维护风险 |
| `return_policy` | 退换风险 |
| `medical_claim` | 医疗化表达风险 |

### ProfessionalLevel 专业门槛

| 值 | 中文名 |
|---|---|
| `none` | 无专业门槛 |
| `light` | 轻专业 |
| `high` | 高专业 |

### GiftCategory 一级品类

| 值 | 中文名 |
|---|---|
| `beauty_personal_care` | 美妆个护 |
| `fragrance` | 香水香氛 |
| `bags_accessories` | 包袋配饰 |
| `digital_accessories` | 数码配件 |
| `desk_office` | 桌面办公 |
| `fashion_wear` | 服饰鞋帽 |
| `food_dessert` | 食品甜品 |
| `coffee_tea` | 咖啡茶饮 |
| `nutrition_wellness` | 营养滋补 |
| `home_appliance` | 居家小家电 |
| `travel_commute` | 旅行通勤 |
| `sports_outdoor` | 运动户外 |
| `fandom_ip` | 追星/IP/潮玩 |
| `books_music_video` | 书影音音乐 |
| `pet_lifestyle` | 宠物友好生活 |
| `o2o_experience` | 本地生活体验 |
| `custom_craft` | 定制/手作 |

## RecommendationContext 问询上下文

用户这次送礼的意图和约束。这个对象来自问卷、用户档案、系统推断和当前日期。

| 字段 | 中文名 | 类型 | 必填 | 示例 | 说明 |
|---|---|---|---|---|---|
| `target` | 送礼对象 | `Target` | 是 | `partner` | 送给谁 |
| `targetLabel` | 送礼对象名称 | `string` | 否 | `恋人` | 冗余展示 |
| `gender` | 性别 | `Gender` | 否 | `female` | 不确定可传 `unknown` |
| `genderLabel` | 性别名称 | `string` | 否 | `女生` | 冗余展示 |
| `ageStage` | 年龄/阶段 | `AgeStage` | 否 | `young_worker` | 比 occupation 更贴近礼物选择 |
| `relationshipCloseness` | 关系亲密度 | `RelationshipCloseness` | 否 | `very_close` | 区分普通朋友/好闺蜜等 |
| `scene` | 场景 | `Scene` | 是 | `festival` | 大场景 |
| `specificOccasion` | 具体节日/事件 | `SpecificOccasion` | 否 | `520` | 节日细分 |
| `season` | 季节 | `Season` | 否 | `summer` | 可由服务端按日期推断 |
| `personalityType` | E/I 倾向 | `PersonalityType` | 否 | `I` | 软权重 |
| `occupation` | 职业/状态 | `string` | 否 | `office` | 兼容 v1 |
| `recipientStyle` | 收礼人风格 | `string` | 否 | `quality` | 兼容 v1 |
| `budget` | 预算 | `Budget` | 否 | `500_1000` | 单选 |
| `preparationTime` | 准备时间 | `PreparationTime` | 否 | `within_3_days` | 影响履约 |
| `deliveryPreference` | 履约偏好 | `CommerceType | "any"` | 否 | `local_ecommerce` | 用户希望电商/同城/O2O |
| `knowsHobbyDetails` | 是否懂对方专业兴趣 | `boolean` | 否 | `false` | 控制专业品类 |
| `interestTags` | 兴趣标签 | `string[]` | 否 | `["coffee", "fandom"]` | 可来自问卷或档案 |
| `avoidTags` | 避雷标签 | `string[]` | 否 | `["fragrance"]` | 用户不想要的方向 |
| `notes` | 补充说明 | `string` | 否 | `她喜欢淡香` | 自由文本 |

示例：

```json
{
  "target": "bestie",
  "targetLabel": "闺蜜",
  "gender": "female",
  "genderLabel": "女生",
  "ageStage": "young_worker",
  "relationshipCloseness": "very_close",
  "scene": "birthday",
  "specificOccasion": "none",
  "season": "summer",
  "personalityType": "I",
  "recipientStyle": "quality",
  "budget": "500_1000",
  "preparationTime": "within_3_days",
  "deliveryPreference": "ecommerce",
  "knowsHobbyDetails": false,
  "interestTags": ["beauty", "coffee"],
  "avoidTags": ["strong_scent"],
  "notes": "喜欢淡香和简洁包装"
}
```

## GiftDirection 推荐品/礼物方向

我们维护的推荐核心对象。它不是具体商品，而是“用户应该买什么方向”。

| 字段 | 中文名 | 类型 | 必填 | 示例 | 说明 |
|---|---|---|---|---|---|
| `id` | 推荐品 ID | `string` | 是 | `counter-lipstick-gift-box` | kebab-case |
| `name` | 推荐品名称 | `string` | 是 | `专柜口红礼盒` | 中文，具体到可搜索购买 |
| `category` | 一级品类 | `GiftCategory` | 是 | `beauty_personal_care` | 用于配额和去重 |
| `categoryLabel` | 一级品类名称 | `string` | 是 | `美妆个护` | 运营可读 |
| `subCategory` | 二级品类 | `string` | 是 | `lipstick_gift_box` | 推荐细分 |
| `subCategoryLabel` | 二级品类名称 | `string` | 是 | `口红礼盒` | 运营可读 |
| `target` | 适合送礼对象 | `Target[]` | 是 | `["partner", "bestie"]` | 可多选 |
| `gender` | 适合性别 | `Gender[]` | 否 | `["female"]` | 不强行性别刻板 |
| `ageStage` | 适合年龄/阶段 | `AgeStage[]` | 否 | `["young_worker"]` | 可多选 |
| `relationshipCloseness` | 适合亲密度 | `RelationshipCloseness[]` | 否 | `["close", "very_close"]` | 区分普通朋友/好闺蜜 |
| `scene` | 适合场景 | `Scene[]` | 是 | `["birthday", "festival"]` | 大场景 |
| `specificOccasions` | 适合具体节日 | `SpecificOccasion[]` | 否 | `["520", "qixi"]` | 节日细分 |
| `seasons` | 适合季节 | `Season[]` | 否 | `["spring", "summer"]` | 空表示四季都可 |
| `avoidSeasons` | 避免季节 | `Season[]` | 否 | `["summer"]` | 反季节降权 |
| `personalityFit` | 适合 E/I | `PersonalityType[]` | 否 | `["I"]` | 软权重 |
| `budget` | 预算 | `Budget[]` | 是 | `["500_1000"]` | 适合价格区间 |
| `preparationTime` | 准备时间 | `PreparationTime[]` | 是 | `["within_3_days"]` | 与履约有关 |
| `commerceTypes` | 履约类型 | `CommerceType[]` | 是 | `["ecommerce", "local_ecommerce"]` | 电商/O2O |
| `deliveryModes` | 交付方式 | `DeliveryMode[]` | 是 | `["delivery", "same_day"]` | 快递/同城/预约 |
| `purchaseChannels` | 推荐购买渠道 | `PurchaseChannel[]` | 否 | `["official_flagship", "counter"]` | 渠道建议 |
| `packagingLevel` | 包装感 | `PackagingLevel` | 是 | `gift_box` | 礼盒感 |
| `giftSignals` | 礼物性信号 | `string[]` | 否 | `["有包装感", "可开箱"]` | 解释为什么像礼物 |
| `emotionalTags` | 情绪标签 | `string[]` | 否 | `["surprise", "care"]` | 兼容 v1 |
| `visualStyle` | 视觉风格 | `string[]` | 否 | `["delicate"]` | 兼容 v1 |
| `recipientStyle` | 收礼人风格 | `string[]` | 否 | `["quality"]` | 兼容 v1 |
| `riskLevel` | 风险等级 | `RiskLevel` | 是 | `medium` | 排序/提示 |
| `riskTypes` | 风险类型 | `RiskType[]` | 否 | `["shade", "authenticity"]` | 结构化风险 |
| `riskTags` | 风险短标签 | `string[]` | 否 | `["看色号", "看渠道"]` | 前端展示 |
| `purchaseWarnings` | 购买提醒 | `string[]` | 否 | `["优先官方渠道"]` | 较长提醒 |
| `professionalLevel` | 专业门槛 | `ProfessionalLevel` | 是 | `none` | 专业品类控制 |
| `requiresKnownPreference` | 是否需要已知偏好 | `boolean` | 是 | `true` | 香水/尺码/专业品类常为 true |
| `preferenceKeys` | 需要确认的信息 | `string[]` | 否 | `["色号", "肤质"]` | 问询/提示可用 |
| `searchQueries` | 商品搜索词 | `string[]` | 否 | `["专柜 口红 礼盒"]` | 后续匹配商品 |
| `offerMatchRules` | 商品匹配规则 | `object` | 否 | `{}` | 第一版可为空 |
| `productOfferIds` | 关联商品 ID | `string[]` | 否 | `["offer_001"]` | 一对多 |
| `highlights` | 短卖点 | `string[]` | 是 | `["有礼盒", "显用心"]` | 前端展示 |
| `tags` | 展示标签 | `string[]` | 是 | `["专柜感", "包装体面"]` | 前端展示 |
| `pairingTags` | 搭配建议 | `string[]` | 否 | `["手写卡片"]` | 搭配 |
| `recommendReason` | 推荐理由 | `string` | 是 | `适合...` | 为什么适合作为礼物 |
| `display` | 展示文案 | `object` | 否 | `{}` | 前端可直接用 |

示例：

```json
{
  "id": "counter-lipstick-gift-box",
  "name": "专柜口红礼盒",
  "category": "beauty_personal_care",
  "categoryLabel": "美妆个护",
  "subCategory": "lipstick_gift_box",
  "subCategoryLabel": "口红礼盒",
  "target": ["partner", "bestie"],
  "gender": ["female"],
  "ageStage": ["young_worker"],
  "relationshipCloseness": ["close", "very_close"],
  "scene": ["birthday", "festival"],
  "specificOccasions": ["520", "qixi"],
  "seasons": [],
  "avoidSeasons": [],
  "personalityFit": ["E", "I"],
  "budget": ["500_1000", "1000_2000"],
  "preparationTime": ["today", "tomorrow", "within_3_days"],
  "commerceTypes": ["ecommerce", "local_ecommerce"],
  "deliveryModes": ["delivery", "same_day"],
  "purchaseChannels": ["official_flagship", "counter", "brand_self"],
  "packagingLevel": "gift_box",
  "giftSignals": ["有包装感", "可开箱", "能表达审美"],
  "emotionalTags": ["surprise", "care"],
  "visualStyle": ["delicate", "classic"],
  "recipientStyle": ["aesthetic", "quality"],
  "riskLevel": "medium",
  "riskTypes": ["shade", "authenticity"],
  "riskTags": ["看色号", "看渠道"],
  "purchaseWarnings": ["优先官方旗舰店或专柜", "不建议来路不明代购"],
  "professionalLevel": "none",
  "requiresKnownPreference": true,
  "preferenceKeys": ["色号", "肤质", "常用品牌"],
  "searchQueries": ["专柜 口红 礼盒", "热门色号 口红 礼盒"],
  "offerMatchRules": {
    "includeKeywords": ["口红", "礼盒"],
    "excludeKeywords": ["代购", "临期", "分装"]
  },
  "productOfferIds": ["offer_lip_001", "offer_lip_002"],
  "highlights": ["有礼盒", "显用心"],
  "tags": ["专柜感", "包装体面", "适合亲密"],
  "pairingTags": ["手写卡片", "花束"],
  "recommendReason": "适合想表达审美和用心的亲密关系，开箱也更有仪式感。",
  "display": {
    "budgetText": "500-2000 元",
    "commerceText": "电商/同城可买",
    "riskText": "需确认色号和正品渠道"
  }
}
```

## ProductOffer 商品供给

第一版商品表只保留最小字段：名称、链接、价格。它表达“哪里可以买到具体商品”，不承担推荐理由。

| 字段 | 中文名 | 类型 | 必填 | 示例 | 说明 |
|---|---|---|---|---|---|
| `id` | 商品 ID | `string` | 是 | `offer_lip_001` | 内部 ID |
| `giftDirectionIds` | 关联推荐品 ID | `string[]` | 否 | `["counter-lipstick-gift-box"]` | 支持多对多 |
| `name` | 商品名称 | `string` | 是 | `某平台专柜口红礼盒` | 来自平台标题或人工编辑 |
| `url` | 商品链接 | `string` | 是 | `https://...` | 电商/O2O 链接 |
| `price` | 价格 | `number` | 是 | `699` | 当前价格 |
| `priceLabel` | 价格展示 | `string` | 否 | `699 元` | 可选冗余 |

示例：

```json
{
  "id": "offer_lip_001",
  "giftDirectionIds": ["counter-lipstick-gift-box"],
  "name": "专柜口红礼盒 正装礼盒装",
  "url": "https://example.com/product/123",
  "price": 699,
  "priceLabel": "699 元"
}
```

## 推荐接口 v2

### 入参

```json
{
  "context": {
    "target": "parents",
    "targetLabel": "爸妈",
    "gender": "female",
    "genderLabel": "女生",
    "ageStage": "middle_aged",
    "relationshipCloseness": "very_close",
    "scene": "festival",
    "specificOccasion": "mothers_day",
    "season": "spring",
    "personalityType": "unknown",
    "budget": "500_1000",
    "preparationTime": "within_3_days",
    "deliveryPreference": "ecommerce",
    "knowsHobbyDetails": false,
    "interestTags": ["beauty", "wellness"],
    "avoidTags": [],
    "notes": "妈妈平时舍不得买护肤品"
  }
}
```

兼容期可同时接受：

```json
{
  "answers": {}
}
```

后端将 `answers` 归一化成 `context`。

### 出参

```json
{
  "summary": "这次更适合选体面、能表达关心、渠道稳妥的礼物。",
  "boundaryNote": "已优先避开医疗化表达、来路不明渠道和反季节选择。",
  "candidates": [
    {
      "id": "mom-skincare-gift-box",
      "name": "妈妈护肤礼盒",
      "category": "beauty_personal_care",
      "categoryLabel": "美妆个护",
      "subCategory": "skincare_gift_box",
      "subCategoryLabel": "护肤礼盒",
      "commerceTypes": ["ecommerce", "local_ecommerce"],
      "deliveryModes": ["delivery", "same_day"],
      "purchaseChannels": ["official_flagship", "counter"],
      "packagingLevel": "gift_box",
      "riskLevel": "medium",
      "riskTypes": ["skin", "authenticity"],
      "riskTags": ["看肤质", "看渠道"],
      "purchaseWarnings": ["优先官方旗舰店或专柜"],
      "professionalLevel": "none",
      "requiresKnownPreference": true,
      "highlights": ["有礼盒", "显体面"],
      "tags": ["妈妈爱美", "包装体面"],
      "pairingTags": ["鲜花", "祝福卡"],
      "recommendReason": "适合把平时舍不得买的体面护理送给妈妈。",
      "display": {
        "budgetText": "500-1000 元",
        "commerceText": "电商/同城可买",
        "riskText": "需确认肤质和正品渠道"
      },
      "offers": [
        {
          "id": "offer_skin_001",
          "name": "护肤礼盒套装",
          "url": "https://example.com/product/456",
          "price": 799,
          "priceLabel": "799 元"
        }
      ]
    }
  ],
  "pairings": ["鲜花", "祝福卡"],
  "meta": {
    "schemaVersion": "gift-backend-v2",
    "modelVersion": "decision-table-v2"
  }
}
```

## 推荐过程字段使用建议

过滤优先级：

1. `target`、`scene`、`budget`、`preparationTime`
2. `specificOccasion`、`season`、`deliveryPreference`
3. `riskLevel`、`requiresKnownPreference`、`professionalLevel`
4. `category` / `subCategory` 配额和去重
5. `commerceTypes` / `deliveryModes` 履约可行性

强降权规则：

- `professionalLevel = high` 且 `context.knowsHobbyDetails = false`
- `avoidSeasons` 包含当前季节
- `riskLevel = high` 且没有明确偏好信息
- `commerceTypes` 与 `deliveryPreference` 冲突
- `category/subCategory` 在当前结果中过度集中

展示建议：

- 卡片主展示：`name`、`tags`、`recommendReason`
- 风险提示：展示 `riskTags` 或 `display.riskText`
- 购买提示：详情页展示 `purchaseWarnings`
- 商品链接：详情页或“去看看”按钮展示 `offers`

## 兼容 v1

v2 的 `GiftDirection` 保留这些 v1 字段：

- `target`
- `gender`
- `scene`
- `occupation`
- `recipientStyle`
- `budget`
- `preparationTime`
- `emotionalTags`
- `visualStyle`
- `highlights`
- `tags`
- `riskTags`
- `pairingTags`
- `recommendReason`

旧前端可以继续只消费这些字段。后端和数据层先使用新增字段做过滤、排序和去重。
