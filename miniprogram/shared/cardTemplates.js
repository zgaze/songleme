// 贺卡模板数据（WS3 贺卡 MVP）
// 纯数据模块 + 取值函数，CommonJS 导出（与 guideContent.js 风格一致）。
//
// 注意：本文件内的颜色值必须为「字面色值」（hex / 渐变字符串），
// 因为 JS 与 canvas 都无法读取 CSS 变量；取色与 master 调色板同源
// （primary blue #30628a / rose #ffb0cd / gold #fac477 / mint #b7e4c7，
// 文字色与 app.wxss 的 --on-* 同源）。
//
// MVP 决策：palette.bg 一律使用「纯色 hex」，保证预览与 canvas 导出一致。

const CARD_TEMPLATES = [
  {
    id: "warm-blush",
    name: "暖粉信笺",
    animationClass: "anim-float",
    defaultPaletteId: "blush",
    palettes: [
      { id: "blush", name: "粉", bg: "#ffd9e4", text: "#6e334c", accent: "#ffb0cd" },
      { id: "gold", name: "暖金", bg: "#ffddb2", text: "#5f4006", accent: "#fac477" },
    ],
    fields: [
      { key: "salutation", label: "收礼人称呼", placeholder: "亲爱的 / 给最好的你", maxLen: 12, default: "" },
      { key: "blessing", label: "一句祝福", placeholder: "愿你被这个世界温柔以待", maxLen: 40, default: "" },
    ],
  },
  {
    id: "calm-sky",
    name: "静蓝晴空",
    animationClass: "anim-shine",
    defaultPaletteId: "sky",
    palettes: [
      { id: "sky", name: "蓝", bg: "#cde5ff", text: "#1d4f74", accent: "#30628a" },
      { id: "mint", name: "薄荷", bg: "#c9efd9", text: "#2f6b42", accent: "#b7e4c7" },
    ],
    fields: [
      { key: "salutation", label: "收礼人称呼", placeholder: "亲爱的 / 给最好的你", maxLen: 12, default: "" },
      { key: "blessing", label: "一句祝福", placeholder: "愿你天朗气清，万事顺意", maxLen: 40, default: "" },
    ],
  },
  {
    id: "fresh-mint",
    name: "清新薄荷",
    animationClass: "anim-float",
    defaultPaletteId: "mint",
    palettes: [
      { id: "mint", name: "绿", bg: "#c9efd9", text: "#2f6b42", accent: "#b7e4c7" },
      { id: "sky", name: "蓝", bg: "#cde5ff", text: "#1d4f74", accent: "#30628a" },
    ],
    fields: [
      { key: "salutation", label: "收礼人称呼", placeholder: "亲爱的 / 给最好的你", maxLen: 12, default: "" },
      { key: "blessing", label: "一句祝福", placeholder: "愿你的日子像新叶一样清新", maxLen: 40, default: "" },
    ],
  },
  {
    id: "golden-hour",
    name: "暖阳时刻",
    animationClass: "anim-shine",
    defaultPaletteId: "gold",
    palettes: [
      { id: "gold", name: "金", bg: "#ffddb2", text: "#5f4006", accent: "#fac477" },
      { id: "blush", name: "粉", bg: "#ffd9e4", text: "#6e334c", accent: "#ffb0cd" },
    ],
    fields: [
      { key: "salutation", label: "收礼人称呼", placeholder: "亲爱的 / 给最好的你", maxLen: 12, default: "" },
      { key: "blessing", label: "一句祝福", placeholder: "愿你被温暖的光照亮每一天", maxLen: 40, default: "" },
    ],
  },
];

function getCardTemplates() {
  return CARD_TEMPLATES;
}

function getCardTemplateById(id) {
  return CARD_TEMPLATES.find((t) => t.id === id) || null;
}

function getTemplatePalette(template, paletteId) {
  if (!template) return null;
  return (
    template.palettes.find((p) => p.id === paletteId) ||
    template.palettes.find((p) => p.id === template.defaultPaletteId) ||
    template.palettes[0] ||
    null
  );
}

module.exports = {
  CARD_TEMPLATES,
  getCardTemplates,
  getCardTemplateById,
  getTemplatePalette,
};
