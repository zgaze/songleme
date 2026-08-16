const DEFAULT_PERSONA_OPTIONS = [
  { value: "tech_geek", label: "数码极客" },
  { value: "office_pro", label: "职场人" },
  { value: "creative", label: "创意工作者" },
  { value: "student", label: "学生党" },
  { value: "aesthetic_lover", label: "颜值控" },
  { value: "night_owl", label: "夜猫子" },
  { value: "homebody", label: "宅家派" },
  { value: "outdoorsy", label: "户外控" },
  { value: "fitness", label: "健身党" },
  { value: "coffee_tea", label: "咖啡茶饮" },
  { value: "foodie", label: "吃货" },
  { value: "pet_owner", label: "养宠人" },
  { value: "beauty_lover", label: "美妆控" },
  { value: "fandom_gamer", label: "追星/游戏" },
  { value: "bookish", label: "文艺书虫" },
];

const PARENT_PERSONA_OPTIONS = [
  { value: "parent_home_comfort", label: "居家舒服" },
  { value: "parent_daily_practical", label: "日常实用" },
  { value: "parent_tea_snacks", label: "茶饮点心" },
  { value: "parent_light_sport", label: "轻运动" },
  { value: "parent_walk_travel", label: "散步旅行" },
  { value: "parent_family_memory", label: "家庭纪念" },
  { value: "parent_garden_home", label: "花草阳台" },
  { value: "parent_simple_digital", label: "简单数码" },
  { value: "parent_cooking_life", label: "下厨生活" },
  { value: "parent_sleep_relax", label: "睡眠放松" },
  { value: "parent_visit_ready", label: "体面拜访" },
  { value: "parent_comfy_material", label: "舒适材质" },
];

const PERSONA_LABELS = DEFAULT_PERSONA_OPTIONS.concat(PARENT_PERSONA_OPTIONS).reduce(
  (labels, option) => {
    labels[option.value] = option.label;
    return labels;
  },
  {}
);

const ALLOWED_PERSONA_TAG_VALUES = Object.keys(PERSONA_LABELS);

function getPersonaOptions(target) {
  return target === "parents" ? PARENT_PERSONA_OPTIONS : DEFAULT_PERSONA_OPTIONS;
}

function getPersonaLabel(value) {
  return PERSONA_LABELS[value] || "";
}

module.exports = {
  ALLOWED_PERSONA_TAG_VALUES,
  getPersonaLabel,
  getPersonaOptions,
};
