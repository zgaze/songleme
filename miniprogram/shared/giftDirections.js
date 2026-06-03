const GIFT_DIRECTIONS = [
  {
    id: "photo-book",
    name: "定制照片书",
    target: [
      "partner"
    ],
    scene: [
      "birthday",
      "anniversary"
    ],
    budget: [
      "100_300",
      "300_800"
    ],
    preparationTime: [
      "within_7_days",
      "after_7_days"
    ],
    emotionalTags: [
      "company",
      "memory",
      "sincere"
    ],
    visualStyle: [
      "warm",
      "classic"
    ],
    highlights: [
      "有回忆",
      "能保存"
    ],
    riskTags: [
      "需提前"
    ],
    pairingTags: [
      "手写卡片",
      "鲜花"
    ],
    recommendReason: "适合把共同经历变成实体纪念，表达稳定陪伴。"
  },
  {
    id: "same-day-flowers-dessert",
    name: "鲜花甜品组合",
    target: [
      "partner",
      "parents"
    ],
    scene: [
      "birthday",
      "festival",
      "daily"
    ],
    budget: [
      "under_100",
      "100_300"
    ],
    preparationTime: [
      "today",
      "tomorrow",
      "within_3_days"
    ],
    emotionalTags: [
      "care",
      "surprise",
      "romantic",
      "ritual"
    ],
    visualStyle: [
      "warm",
      "delicate",
      "festive"
    ],
    highlights: [
      "当天送",
      "仪式感"
    ],
    riskTags: [
      "看审美"
    ],
    pairingTags: [
      "卡片",
      "晚餐"
    ],
    recommendReason: "适合当天制造心意感，轻巧但不敷衍。"
  },
  {
    id: "massage-device",
    name: "肩颈按摩仪",
    target: [
      "parents"
    ],
    scene: [
      "birthday",
      "festival",
      "daily"
    ],
    budget: [
      "300_800",
      "800_plus"
    ],
    preparationTime: [
      "tomorrow",
      "within_3_days",
      "within_7_days"
    ],
    emotionalTags: [
      "care",
      "company"
    ],
    visualStyle: [
      "minimal",
      "tech"
    ],
    highlights: [
      "高实用",
      "长期用"
    ],
    riskTags: [
      "需确认习惯"
    ],
    pairingTags: [
      "祝福卡片"
    ],
    recommendReason: "适合表达日常照顾，父母也容易理解价值。"
  },
  {
    id: "coffee-gift-box",
    name: "咖啡礼盒",
    target: [
      "partner",
      "parents"
    ],
    scene: [
      "birthday",
      "festival",
      "daily"
    ],
    budget: [
      "100_300",
      "300_800"
    ],
    preparationTime: [
      "tomorrow",
      "within_3_days",
      "within_7_days"
    ],
    emotionalTags: [
      "care",
      "surprise"
    ],
    visualStyle: [
      "minimal",
      "delicate",
      "classic"
    ],
    highlights: [
      "日常消耗",
      "不贵重"
    ],
    riskTags: [
      "口味风险"
    ],
    pairingTags: [
      "杯子",
      "手写卡片"
    ],
    recommendReason: "适合偏实用的关系表达，体面又不容易过重。"
  },
  {
    id: "digital-membership",
    name: "数字会员礼物",
    target: [
      "partner"
    ],
    scene: [
      "daily",
      "festival"
    ],
    budget: [
      "under_100",
      "100_300"
    ],
    preparationTime: [
      "today"
    ],
    emotionalTags: [
      "company",
      "surprise"
    ],
    visualStyle: [
      "minimal",
      "tech"
    ],
    highlights: [
      "即时送",
      "低压力"
    ],
    riskTags: [
      "需知道偏好"
    ],
    pairingTags: [
      "消息祝福"
    ],
    recommendReason: "适合临时但不随便的表达，重点是贴近日常喜好。"
  },
  {
    id: "home-textile",
    name: "舒适家居织物",
    target: [
      "parents",
      "partner"
    ],
    scene: [
      "birthday",
      "festival",
      "daily"
    ],
    budget: [
      "100_300",
      "300_800"
    ],
    preparationTime: [
      "tomorrow",
      "within_3_days",
      "within_7_days"
    ],
    emotionalTags: [
      "care",
      "company"
    ],
    visualStyle: [
      "warm",
      "classic"
    ],
    highlights: [
      "改善生活",
      "低调"
    ],
    riskTags: [
      "看审美"
    ],
    pairingTags: [
      "卡片"
    ],
    recommendReason: "适合表达长期关心，使用频率高，负担感低。"
  },
  {
    id: "aroma-night-light",
    name: "香氛小夜灯",
    target: [
      "partner"
    ],
    scene: [
      "birthday",
      "anniversary",
      "daily"
    ],
    budget: [
      "100_300",
      "300_800"
    ],
    preparationTime: [
      "tomorrow",
      "within_3_days",
      "within_7_days"
    ],
    emotionalTags: [
      "romantic",
      "care",
      "healing"
    ],
    visualStyle: [
      "warm",
      "delicate"
    ],
    highlights: [
      "氛围感",
      "不占地方"
    ],
    riskTags: [],
    pairingTags: [
      "卡片",
      "甜点"
    ],
    recommendReason: "适合把日常空间变得更柔和，也容易搭配祝福。"
  },
  {
    id: "craft-experience",
    name: "手作体验券",
    target: [
      "partner",
      "parents"
    ],
    scene: [
      "birthday",
      "anniversary",
      "daily"
    ],
    budget: [
      "100_300",
      "300_800"
    ],
    preparationTime: [
      "within_3_days",
      "within_7_days",
      "after_7_days"
    ],
    emotionalTags: [
      "company",
      "memory",
      "surprise",
      "encourage"
    ],
    visualStyle: [
      "warm",
      "classic"
    ],
    highlights: [
      "一起完成",
      "有记忆点"
    ],
    riskTags: [],
    pairingTags: [
      "照片",
      "晚餐"
    ],
    recommendReason: "适合把礼物变成一段共同时间，而不是只交付一个物件。"
  },
  {
    id: "wellness-tea-box",
    name: "养生茶礼盒",
    target: [
      "parents"
    ],
    scene: [
      "birthday",
      "festival",
      "daily"
    ],
    budget: [
      "under_100",
      "100_300",
      "300_800"
    ],
    preparationTime: [
      "today",
      "tomorrow",
      "within_3_days",
      "within_7_days"
    ],
    emotionalTags: [
      "care",
      "gratitude"
    ],
    visualStyle: [
      "classic",
      "minimal",
      "natural"
    ],
    highlights: [
      "日常可用",
      "轻负担"
    ],
    riskTags: [],
    pairingTags: [
      "祝福卡片"
    ],
    recommendReason: "适合表达照顾身体和生活节奏的心意。"
  },
  {
    id: "soft-scarf",
    name: "质感围巾",
    target: [
      "partner",
      "parents"
    ],
    scene: [
      "birthday",
      "festival"
    ],
    budget: [
      "100_300",
      "300_800",
      "800_plus"
    ],
    preparationTime: [
      "tomorrow",
      "within_3_days",
      "within_7_days"
    ],
    emotionalTags: [
      "care",
      "romantic",
      "gratitude"
    ],
    visualStyle: [
      "classic",
      "delicate",
      "elegant"
    ],
    highlights: [
      "贴身实用",
      "季节感"
    ],
    riskTags: [],
    pairingTags: [
      "花束",
      "卡片"
    ],
    recommendReason: "适合有温度的节日表达，既体面也容易被使用。"
  },
  {
    id: "digital-photo-frame",
    name: "电子相框",
    target: [
      "parents",
      "partner"
    ],
    scene: [
      "birthday",
      "festival",
      "anniversary"
    ],
    budget: [
      "300_800",
      "800_plus"
    ],
    preparationTime: [
      "within_3_days",
      "within_7_days",
      "after_7_days"
    ],
    emotionalTags: [
      "memory",
      "company"
    ],
    visualStyle: [
      "tech",
      "classic"
    ],
    highlights: [
      "承载回忆",
      "长期陪伴"
    ],
    riskTags: [],
    pairingTags: [
      "照片包",
      "卡片"
    ],
    recommendReason: "适合把照片和陪伴感放进日常空间里。"
  },
  {
    id: "handmade-chocolate",
    name: "手工巧克力",
    target: [
      "partner"
    ],
    scene: [
      "birthday",
      "anniversary",
      "festival",
      "daily"
    ],
    budget: [
      "under_100",
      "100_300"
    ],
    preparationTime: [
      "today",
      "tomorrow",
      "within_3_days"
    ],
    emotionalTags: [
      "romantic",
      "surprise",
      "ritual"
    ],
    visualStyle: [
      "delicate",
      "warm",
      "festive"
    ],
    highlights: [
      "轻仪式",
      "好搭配"
    ],
    riskTags: [],
    pairingTags: [
      "鲜花",
      "卡片"
    ],
    recommendReason: "适合轻巧地补上仪式感，也方便和其它小礼物组合。"
  },
  {
    id: "perfume-discovery-set",
    name: "香水小样套装",
    target: [
      "partner"
    ],
    scene: [
      "birthday",
      "anniversary",
      "festival",
      "daily"
    ],
    budget: [
      "100_300",
      "300_800"
    ],
    preparationTime: [
      "tomorrow",
      "within_3_days",
      "within_7_days"
    ],
    emotionalTags: [
      "romantic",
      "surprise",
      "prestige"
    ],
    visualStyle: [
      "delicate",
      "classic",
      "elegant"
    ],
    highlights: [
      "选择感",
      "精致"
    ],
    riskTags: [],
    pairingTags: [
      "鲜花",
      "卡片"
    ],
    recommendReason: "适合不知道具体香型时降低选择压力，也有精致感。"
  },
  {
    id: "skincare-travel-set",
    name: "护肤旅行套装",
    target: [
      "partner",
      "parents"
    ],
    scene: [
      "birthday",
      "festival",
      "daily"
    ],
    budget: [
      "100_300",
      "300_800"
    ],
    preparationTime: [
      "today",
      "tomorrow",
      "within_3_days",
      "within_7_days"
    ],
    emotionalTags: [
      "care"
    ],
    visualStyle: [
      "minimal",
      "delicate"
    ],
    highlights: [
      "好携带",
      "实用"
    ],
    riskTags: [],
    pairingTags: [
      "收纳袋",
      "卡片"
    ],
    recommendReason: "适合把照顾感放进日常使用里，不显得太重。"
  },
  {
    id: "smart-speaker",
    name: "智能音箱",
    target: [
      "parents",
      "partner"
    ],
    scene: [
      "birthday",
      "festival",
      "daily"
    ],
    budget: [
      "300_800",
      "800_plus"
    ],
    preparationTime: [
      "tomorrow",
      "within_3_days",
      "within_7_days"
    ],
    emotionalTags: [
      "company",
      "care",
      "prestige"
    ],
    visualStyle: [
      "tech",
      "minimal"
    ],
    highlights: [
      "陪伴感",
      "易使用"
    ],
    riskTags: [],
    pairingTags: [
      "使用说明卡"
    ],
    recommendReason: "适合把陪伴感做成每天都能用到的小工具。"
  },
  {
    id: "heated-eye-mask",
    name: "蒸汽眼罩礼盒",
    target: [
      "parents",
      "partner"
    ],
    scene: [
      "birthday",
      "festival",
      "daily"
    ],
    budget: [
      "under_100",
      "100_300"
    ],
    preparationTime: [
      "today",
      "tomorrow",
      "within_3_days"
    ],
    emotionalTags: [
      "care",
      "healing"
    ],
    visualStyle: [
      "warm",
      "minimal"
    ],
    highlights: [
      "放松",
      "低负担"
    ],
    riskTags: [],
    pairingTags: [
      "睡眠喷雾"
    ],
    recommendReason: "适合表达休息和照顾，轻巧但不随便。"
  },
  {
    id: "desk-plant",
    name: "桌面绿植",
    target: [
      "partner",
      "parents"
    ],
    scene: [
      "birthday",
      "daily"
    ],
    budget: [
      "under_100",
      "100_300"
    ],
    preparationTime: [
      "today",
      "tomorrow",
      "within_3_days"
    ],
    emotionalTags: [
      "care",
      "company",
      "encourage"
    ],
    visualStyle: [
      "warm",
      "minimal",
      "cute",
      "natural"
    ],
    highlights: [
      "有生命感",
      "日常陪伴"
    ],
    riskTags: [],
    pairingTags: [
      "小卡片"
    ],
    recommendReason: "适合日常关心场景，让桌面多一点持续的陪伴感。"
  },
  {
    id: "dinner-voucher",
    name: "餐厅礼券",
    target: [
      "partner",
      "parents"
    ],
    scene: [
      "birthday",
      "anniversary",
      "festival"
    ],
    budget: [
      "300_800",
      "800_plus"
    ],
    preparationTime: [
      "within_3_days",
      "within_7_days",
      "after_7_days"
    ],
    emotionalTags: [
      "company",
      "romantic",
      "prestige"
    ],
    visualStyle: [
      "classic",
      "delicate",
      "elegant"
    ],
    highlights: [
      "共同时间",
      "体面"
    ],
    riskTags: [],
    pairingTags: [
      "鲜花",
      "照片"
    ],
    recommendReason: "适合把礼物变成一次相处，而不是只送一个物品。"
  },
  {
    id: "custom-mug",
    name: "定制马克杯",
    target: [
      "partner",
      "parents"
    ],
    scene: [
      "birthday",
      "daily",
      "anniversary"
    ],
    budget: [
      "under_100",
      "100_300"
    ],
    preparationTime: [
      "within_7_days",
      "after_7_days"
    ],
    emotionalTags: [
      "memory",
      "care",
      "sincere"
    ],
    visualStyle: [
      "warm",
      "classic",
      "cute"
    ],
    highlights: [
      "可定制",
      "日常用"
    ],
    riskTags: [],
    pairingTags: [
      "咖啡",
      "卡片"
    ],
    recommendReason: "适合把小回忆做成可日常使用的物件。"
  },
  {
    id: "sleep-pillow",
    name: "助眠枕",
    target: [
      "parents",
      "partner"
    ],
    scene: [
      "birthday",
      "festival",
      "daily"
    ],
    budget: [
      "100_300",
      "300_800"
    ],
    preparationTime: [
      "tomorrow",
      "within_3_days",
      "within_7_days"
    ],
    emotionalTags: [
      "care",
      "healing"
    ],
    visualStyle: [
      "minimal",
      "warm"
    ],
    highlights: [
      "提升睡眠",
      "长期用"
    ],
    riskTags: [],
    pairingTags: [
      "眼罩"
    ],
    recommendReason: "适合把关心落到睡眠和休息这类高频生活里。"
  },
  {
    id: "music-box",
    name: "八音盒",
    target: [
      "partner"
    ],
    scene: [
      "birthday",
      "anniversary"
    ],
    budget: [
      "100_300",
      "300_800"
    ],
    preparationTime: [
      "within_3_days",
      "within_7_days",
      "after_7_days"
    ],
    emotionalTags: [
      "romantic",
      "memory",
      "sincere",
      "ritual"
    ],
    visualStyle: [
      "classic",
      "delicate",
      "retro"
    ],
    highlights: [
      "纪念感",
      "温柔"
    ],
    riskTags: [],
    pairingTags: [
      "手写卡片"
    ],
    recommendReason: "适合偏纪念和浪漫的表达，体积小但情绪明确。"
  },
  {
    id: "wool-blanket",
    name: "羊毛毯",
    target: [
      "parents",
      "partner"
    ],
    scene: [
      "birthday",
      "festival",
      "daily"
    ],
    budget: [
      "300_800",
      "800_plus"
    ],
    preparationTime: [
      "tomorrow",
      "within_3_days",
      "within_7_days"
    ],
    emotionalTags: [
      "care",
      "company"
    ],
    visualStyle: [
      "warm",
      "classic"
    ],
    highlights: [
      "温暖",
      "耐用"
    ],
    riskTags: [],
    pairingTags: [
      "卡片"
    ],
    recommendReason: "适合天气和生活场景里的长期陪伴感。"
  },
  {
    id: "art-print",
    name: "装饰画",
    target: [
      "partner"
    ],
    scene: [
      "birthday",
      "anniversary",
      "daily"
    ],
    budget: [
      "100_300",
      "300_800"
    ],
    preparationTime: [
      "within_3_days",
      "within_7_days",
      "after_7_days"
    ],
    emotionalTags: [
      "memory",
      "surprise"
    ],
    visualStyle: [
      "minimal",
      "warm",
      "classic",
      "elegant"
    ],
    highlights: [
      "空间感",
      "有品味"
    ],
    riskTags: [],
    pairingTags: [
      "相框"
    ],
    recommendReason: "适合把审美和回忆放进空间里，表达更含蓄。"
  },
  {
    id: "fruit-gift-box",
    name: "水果礼盒",
    target: [
      "parents"
    ],
    scene: [
      "festival",
      "daily",
      "birthday"
    ],
    budget: [
      "under_100",
      "100_300"
    ],
    preparationTime: [
      "today",
      "tomorrow",
      "within_3_days"
    ],
    emotionalTags: [
      "care",
      "gratitude"
    ],
    visualStyle: [
      "classic",
      "warm",
      "natural",
      "festive"
    ],
    highlights: [
      "好入口",
      "稳妥"
    ],
    riskTags: [],
    pairingTags: [
      "祝福卡片"
    ],
    recommendReason: "适合需要稳妥送达的关心表达，接受度比较高。"
  },
  {
    id: "bath-care-set",
    name: "沐浴护理套装",
    target: [
      "partner",
      "parents"
    ],
    scene: [
      "birthday",
      "festival",
      "daily"
    ],
    budget: [
      "100_300",
      "300_800"
    ],
    preparationTime: [
      "today",
      "tomorrow",
      "within_3_days",
      "within_7_days"
    ],
    emotionalTags: [
      "care",
      "surprise",
      "healing"
    ],
    visualStyle: [
      "delicate",
      "warm"
    ],
    highlights: [
      "放松",
      "好看"
    ],
    riskTags: [],
    pairingTags: [
      "香薰"
    ],
    recommendReason: "适合把放松感和精致感一起送出去。"
  },
  {
    id: "travel-storage-set",
    name: "旅行收纳套装",
    target: [
      "partner",
      "parents"
    ],
    scene: [
      "birthday",
      "festival",
      "daily"
    ],
    budget: [
      "under_100",
      "100_300"
    ],
    preparationTime: [
      "today",
      "tomorrow",
      "within_3_days"
    ],
    emotionalTags: [
      "care"
    ],
    visualStyle: [
      "minimal",
      "classic"
    ],
    highlights: [
      "实用",
      "轻巧"
    ],
    riskTags: [],
    pairingTags: [
      "护照夹"
    ],
    recommendReason: "适合偏实用的表达，尤其适合常出门的人。"
  },
  {
    id: "instant-camera",
    name: "拍立得相机",
    target: [
      "partner"
    ],
    scene: [
      "birthday",
      "anniversary"
    ],
    budget: [
      "300_800",
      "800_plus"
    ],
    preparationTime: [
      "within_3_days",
      "within_7_days"
    ],
    emotionalTags: [
      "memory",
      "surprise",
      "playful"
    ],
    visualStyle: [
      "tech",
      "classic",
      "retro"
    ],
    highlights: [
      "制造回忆",
      "互动感"
    ],
    riskTags: [],
    pairingTags: [
      "相纸",
      "照片册"
    ],
    recommendReason: "适合把之后的相处也变成可以保存的回忆。"
  },
  {
    id: "fountain-pen",
    name: "钢笔礼盒",
    target: [
      "partner",
      "parents"
    ],
    scene: [
      "birthday",
      "festival"
    ],
    budget: [
      "100_300",
      "300_800",
      "800_plus"
    ],
    preparationTime: [
      "tomorrow",
      "within_3_days",
      "within_7_days"
    ],
    emotionalTags: [
      "care",
      "memory",
      "gratitude",
      "prestige"
    ],
    visualStyle: [
      "classic",
      "minimal",
      "retro"
    ],
    highlights: [
      "体面",
      "耐用"
    ],
    riskTags: [],
    pairingTags: [
      "手写卡片"
    ],
    recommendReason: "适合更正式、低调的表达，质感容易被感知。"
  },
  {
    id: "sleep-spray",
    name: "助眠喷雾",
    target: [
      "partner",
      "parents"
    ],
    scene: [
      "daily",
      "birthday"
    ],
    budget: [
      "under_100",
      "100_300"
    ],
    preparationTime: [
      "today",
      "tomorrow",
      "within_3_days"
    ],
    emotionalTags: [
      "care",
      "healing"
    ],
    visualStyle: [
      "delicate",
      "minimal"
    ],
    highlights: [
      "轻松",
      "低压力"
    ],
    riskTags: [],
    pairingTags: [
      "眼罩"
    ],
    recommendReason: "适合日常关心，用很轻的方式表达照顾。"
  },
  {
    id: "hobby-kit",
    name: "兴趣体验套装",
    target: [
      "partner",
      "parents"
    ],
    scene: [
      "birthday",
      "daily",
      "festival"
    ],
    budget: [
      "100_300",
      "300_800"
    ],
    preparationTime: [
      "within_3_days",
      "within_7_days",
      "after_7_days"
    ],
    emotionalTags: [
      "company",
      "surprise",
      "encourage",
      "playful"
    ],
    visualStyle: [
      "warm",
      "classic"
    ],
    highlights: [
      "可参与",
      "有新鲜感"
    ],
    riskTags: [],
    pairingTags: [
      "陪伴时间"
    ],
    recommendReason: "适合鼓励对方尝试兴趣，也能自然延伸出陪伴。"
  },
  {
    id: "couple-bracelet",
    name: "情侣手链",
    target: [
      "partner"
    ],
    scene: [
      "birthday"
    ],
    budget: [
      "100_300"
    ],
    preparationTime: [
      "within_3_days",
      "within_7_days"
    ],
    emotionalTags: [
      "romantic",
      "surprise",
      "ritual"
    ],
    visualStyle: [
      "delicate",
      "warm"
    ],
    highlights: [
      "刻字专属",
      "一对设计"
    ],
    riskTags: [],
    pairingTags: [
      "贺卡"
    ],
    recommendReason: "送情侣手链，把你们的名字刻在一起，低调又甜蜜，他/她一定会感动。"
  },
  {
    id: "star-projector-light",
    name: "星空投影灯",
    target: [
      "partner"
    ],
    scene: [
      "birthday"
    ],
    budget: [
      "100_300"
    ],
    preparationTime: [
      "today",
      "tomorrow"
    ],
    emotionalTags: [
      "romantic",
      "surprise",
      "playful"
    ],
    visualStyle: [
      "warm",
      "classic",
      "cute"
    ],
    highlights: [
      "浪漫星空",
      "氛围神器"
    ],
    riskTags: [],
    pairingTags: [
      "蓝牙音箱"
    ],
    recommendReason: "把星空搬到卧室，打开投影灯，两人一起看星河，浪漫到冒泡。"
  },
  {
    id: "custom-calendar",
    name: "定制日历",
    target: [
      "partner"
    ],
    scene: [
      "birthday"
    ],
    budget: [
      "100_300"
    ],
    preparationTime: [
      "within_7_days",
      "after_7_days"
    ],
    emotionalTags: [
      "memory",
      "care",
      "sincere"
    ],
    visualStyle: [
      "minimal",
      "warm"
    ],
    highlights: [
      "专属照片",
      "每月惊喜"
    ],
    riskTags: [],
    pairingTags: [
      "便签"
    ],
    recommendReason: "用你们的合照做成日历，每个月翻开都是回忆，天天都能想到你。"
  }
];

module.exports = {
  GIFT_DIRECTIONS,
};
