const GUIDE_CONTENT_VERSION = "2026-05-31-static-v1";

const guideChannels = [
  {
    id: "flowers",
    name: "花语",
    summary: "鲜花适合表达仪式感，花色和数量会让语气变得更明确。",
    note: "不确定对方偏好时，选浅色混搭花束和短卡片，比大束红玫瑰更稳。",
    accent: "blue",
    articleIds: ["flower-language-basics"],
  },
  {
    id: "chocolate",
    name: "巧克力",
    summary: "巧克力是甜度很高的礼物，适合表达偏亲密或轻松的好感。",
    note: "如果不确定口味，优先选小份多口味礼盒，避免一次送太甜太重。",
    accent: "pink",
    articleIds: ["chocolate-gift-basics"],
  },
  {
    id: "wearables",
    name: "穿戴",
    summary: "穿戴类礼物会进入对方日常生活，亲密度和尺码风险都更高。",
    note: "越贴身越需要了解偏好。刚认识时不要送带强烈占有感的穿戴品。",
    accent: "green",
    articleIds: ["wearable-boundaries"],
  },
  {
    id: "jewelry",
    name: "饰品",
    summary: "饰品会被长期看见，适合表达审美理解和关系承诺。",
    note: "饰品不一定越贵越好，日常能戴、不过度强调价格，反而更柔和。",
    accent: "apricot",
    articleIds: ["jewelry-signal-guide"],
  },
  {
    id: "closeness",
    name: "亲密等级",
    summary: "礼物的关键不是贵，而是和关系阶段匹配，不越界也不敷衍。",
    note: "越早期越适合可分享、可消耗、低负担；越亲密越适合定制和长期陪伴。",
    accent: "blue",
    articleIds: ["relationship-stage-guide"],
  },
];

const guideArticles = [
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
    blocks: [
      {
        id: "opening",
        type: "paragraph",
        text: "花不是越大束越好。真正影响感受的，是颜色、花材含义和你写在卡片里的理由。",
      },
      {
        id: "common-flowers",
        type: "compare",
        title: "常见花材信号",
        items: [
          {
            label: "红玫瑰",
            good: "热烈、明确的爱意",
            caution: "适合关系确定的恋人，不适合刚认识就送。",
          },
          {
            label: "白玫瑰",
            good: "认真、珍惜、克制",
            caution: "适合温柔表达，卡片不要写得太沉重。",
          },
          {
            label: "向日葵",
            good: "鼓励、明亮、陪伴",
            caution: "适合朋友、同事和低落时的轻关心。",
          },
          {
            label: "百合",
            good: "祝福、顺利、庄重",
            caution: "适合长辈和正式场合，注意香味是否过重。",
          },
        ],
      },
      {
        id: "safe-choice",
        type: "tip",
        title: "稳妥选择",
        text: "浅色混搭花束 + 一句具体祝福，通常比单一强烈花材更不容易出错。",
      },
      {
        id: "checklist",
        type: "checklist",
        title: "下单前检查",
        items: ["对方是否花粉过敏", "收花地点是否方便", "卡片文案是否过度暧昧", "配送时间是否赶得上场合"],
      },
      {
        id: "gift-refs",
        type: "giftRefs",
        title: "可以搭配的礼物方向",
        items: [
          {
            name: "小份甜品",
            note: "让花束从纯仪式感变成可以一起分享的惊喜。",
          },
          {
            name: "手写卡片",
            note: "写清楚为什么选这束花，比堆砌情话更有效。",
          },
        ],
      },
    ],
  },
  {
    id: "chocolate-gift-basics",
    channelId: "chocolate",
    status: "published",
    title: "巧克力礼盒怎么不显得随手",
    subtitle: "甜食礼物的重点是口味、份量和保存方式。",
    summary: "适合暧昧期、朋友生日、节日小礼和轻庆祝。",
    updatedAt: "2026-05-31",
    readingMinutes: 2,
    tags: ["巧克力", "轻礼物", "口味"],
    scenes: ["birthday", "festival", "daily"],
    targets: ["partner", "bestie"],
    budgets: ["under_200", "200_500"],
    blocks: [
      {
        id: "opening",
        type: "paragraph",
        text: "巧克力容易被理解为甜蜜和好感，但如果包装普通、份量太大或口味太单一，也会显得像临时凑数。",
      },
      {
        id: "choices",
        type: "compare",
        title: "口味怎么选",
        items: [
          {
            label: "黑巧",
            good: "成熟、克制、低甜",
            caution: "适合喜欢咖啡或少糖口味的人。",
          },
          {
            label: "牛奶巧克力",
            good: "温暖、亲近、接受度高",
            caution: "安全但普通，需要靠包装和卡片补足心意。",
          },
          {
            label: "手工巧克力",
            good: "认真准备、独特",
            caution: "注意保存时间和配送温度。",
          },
        ],
      },
      {
        id: "portion",
        type: "tip",
        title: "份量建议",
        text: "不确定口味时，优先选小份多口味礼盒。甜食礼物不用追求量大，精致和好分享更重要。",
      },
      {
        id: "avoid",
        type: "list",
        title: "容易踩坑",
        items: ["临期或运输易融化", "只选自己爱吃的口味", "包装太隆重导致关系压力", "没有确认对方是否控糖或忌口"],
      },
    ],
  },
  {
    id: "wearable-boundaries",
    channelId: "wearables",
    status: "published",
    title: "穿戴类礼物的边界",
    subtitle: "越贴身，越需要确认关系和偏好。",
    summary: "适合判断围巾、帽子、香水、睡衣这类礼物是否合适。",
    updatedAt: "2026-05-31",
    readingMinutes: 3,
    tags: ["穿戴", "尺码", "边界感"],
    scenes: ["birthday", "anniversary", "festival", "daily"],
    targets: ["partner", "parents", "bestie"],
    budgets: ["200_500", "500_1000", "1000_2000"],
    blocks: [
      {
        id: "opening",
        type: "paragraph",
        text: "穿戴类礼物会进入对方日常，因此它比摆件、食品更容易带有亲密信号。选之前先确认对方是否真的会用。",
      },
      {
        id: "levels",
        type: "compare",
        title: "亲密信号强弱",
        items: [
          {
            label: "帽子、手套",
            good: "轻照顾、低负担",
            caution: "适合朋友、同事和普通关系。",
          },
          {
            label: "围巾",
            good: "温暖、保护、冬天的在意",
            caution: "适合亲密朋友、恋人和家人。",
          },
          {
            label: "香水",
            good: "记忆感、暧昧感",
            caution: "口味风险高，优先小样或对方明确喜欢的味道。",
          },
          {
            label: "睡衣",
            good: "居家、亲密、私人",
            caution: "只适合非常亲密的人。",
          },
        ],
      },
      {
        id: "fit",
        type: "checklist",
        title: "确认信息",
        items: ["尺码或头围是否确定", "材质是否会过敏", "颜色是否符合对方常穿风格", "礼物是否需要退换货空间"],
      },
      {
        id: "safe-choice",
        type: "tip",
        title: "稳妥选择",
        text: "不确定尺码时，围巾、手套、帽子比衣服和鞋更稳；不确定气味时，香水小样比正装更稳。",
      },
    ],
  },
  {
    id: "jewelry-signal-guide",
    channelId: "jewelry",
    status: "published",
    title: "饰品代表的关系信号",
    subtitle: "饰品不是越贵越好，关键是对方愿不愿意日常佩戴。",
    summary: "适合判断戒指、项链、手链、耳饰等礼物的适用关系。",
    updatedAt: "2026-05-31",
    readingMinutes: 3,
    tags: ["饰品", "承诺感", "审美"],
    scenes: ["birthday", "anniversary", "festival"],
    targets: ["partner", "bestie", "parents"],
    budgets: ["200_500", "500_1000", "1000_2000", "2000_plus"],
    blocks: [
      {
        id: "opening",
        type: "paragraph",
        text: "饰品会被长期看见，也容易被别人问起。它适合表达珍视，但不适合用价格制造压力。",
      },
      {
        id: "signals",
        type: "compare",
        title: "常见饰品信号",
        items: [
          {
            label: "戒指",
            good: "承诺、关系确认、强信号",
            caution: "除非关系明确，否则容易让对方压力很大。",
          },
          {
            label: "项链",
            good: "珍视、靠近、日常陪伴",
            caution: "比戒指温和，但款式要克制。",
          },
          {
            label: "手链",
            good: "陪伴、祝愿、轻承诺",
            caution: "注意金属过敏和手腕尺寸。",
          },
          {
            label: "耳饰",
            good: "审美、精致、个人风格",
            caution: "需要确认是否有耳洞和材质偏好。",
          },
        ],
      },
      {
        id: "quality",
        type: "list",
        title: "比价格更重要的细节",
        items: ["材质是否低敏", "款式是否能日常佩戴", "包装是否体面但不过度", "是否方便售后和调节尺寸"],
      },
      {
        id: "card",
        type: "tip",
        title: "卡片写法",
        text: "可以写选择理由，比如“觉得这个颜色很像你常穿的那件外套”，比泛泛写“很适合你”更具体。",
      },
    ],
  },
  {
    id: "relationship-stage-guide",
    channelId: "closeness",
    status: "published",
    title: "不同关系阶段送什么更舒服",
    subtitle: "礼物要让对方觉得被理解，而不是被要求回应。",
    summary: "适合从刚认识、暧昧期、稳定恋人、父母长辈等关系快速定位。",
    updatedAt: "2026-05-31",
    readingMinutes: 3,
    tags: ["关系阶段", "送礼边界", "低压力"],
    scenes: ["birthday", "anniversary", "festival", "apology", "daily"],
    targets: ["partner", "parents", "bestie"],
    budgets: ["under_200", "200_500", "500_1000", "1000_2000"],
    blocks: [
      {
        id: "opening",
        type: "paragraph",
        text: "礼物不是关系进度条。早期礼物要轻，亲密关系礼物要准，长辈礼物要稳定可靠。",
      },
      {
        id: "stages",
        type: "compare",
        title: "按关系阶段选",
        items: [
          {
            label: "刚认识",
            good: "小份、可分享、低负担",
            caution: "咖啡、甜品、小文具比贵重物更舒服。",
          },
          {
            label: "暧昧期",
            good: "有一点特别，但留有余地",
            caution: "避免戒指、睡衣这类强暗示礼物。",
          },
          {
            label: "稳定恋人",
            good: "懂偏好，也懂生活",
            caution: "可以选择定制、共同回忆或升级日用品。",
          },
          {
            label: "父母长辈",
            good: "实用、安心、有照顾感",
            caution: "避免太花哨、难维护或学习成本高的东西。",
          },
        ],
      },
      {
        id: "apology",
        type: "tip",
        title: "道歉场景",
        text: "道歉礼物要克制，不要用价格替代表达。先把话说清楚，再用小而具体的礼物补上行动。",
      },
      {
        id: "decision",
        type: "checklist",
        title: "最后确认",
        items: ["这件礼物是否符合当前关系", "对方是否真的会用", "是否需要对方立刻给出回应", "你是否能说清选择理由"],
      },
    ],
  },
];

function getPublishedGuideChannels() {
  const publishedArticleIds = new Set(
    guideArticles.filter((article) => article.status === "published").map((article) => article.id)
  );

  return guideChannels
    .map((channel) => ({
      ...channel,
      articleIds: channel.articleIds.filter((articleId) => publishedArticleIds.has(articleId)),
    }))
    .filter((channel) => channel.articleIds.length > 0);
}

function getPublishedGuideArticles() {
  return guideArticles.filter((article) => article.status === "published");
}

function getGuideArticleById(articleId) {
  return guideArticles.find((article) => article.id === articleId && article.status === "published") || null;
}

function getPublishedGuideArticlesByChannel(channelId) {
  const channel = guideChannels.find((item) => item.id === channelId);
  if (!channel) return [];

  return channel.articleIds
    .map((articleId) => getGuideArticleById(articleId))
    .filter(Boolean);
}

function getGuideContentPayload() {
  return {
    version: GUIDE_CONTENT_VERSION,
    channels: getPublishedGuideChannels(),
    articles: getPublishedGuideArticles(),
  };
}

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
