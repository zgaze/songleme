const recipientRepo = require("../../shared/recipientRepo");

// 选项字典（value 必须与 master/schema 完全一致）
const RELATION_OPTIONS = [
  { value: "partner", label: "伴侣" },
  { value: "parents", label: "父母" },
  { value: "bestie", label: "好友" },
];
const GENDER_OPTIONS = [
  { value: "female", label: "女" },
  { value: "male", label: "男" },
];
const OCCUPATION_OPTIONS = [
  { value: "office", label: "职场白领" },
  { value: "tech", label: "技术" },
  { value: "creative", label: "创意设计" },
  { value: "medical_education", label: "医护/教育" },
  { value: "student", label: "学生" },
  { value: "freelance", label: "自由职业" },
  { value: "homemaker", label: "全职照护" },
];
const STYLE_OPTIONS = [
  { value: "practical", label: "实用派" },
  { value: "aesthetic", label: "颜值控" },
  { value: "experiential", label: "体验型" },
  { value: "quality", label: "品质感" },
];
// personaTags —— 14 值，中文标签按 master C1（权威）
const PERSONA_OPTIONS = [
  { value: "tech_geek", label: "数码极客" },
  { value: "office_pro", label: "职场人" },
  { value: "creative", label: "创意工作者" },
  { value: "student", label: "学生党" },
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
const MAX_PERSONA = 5;

Page({
  data: {
    recipientId: "", // 空 = 新建
    nickname: "",
    target: "",
    gender: "",
    occupation: "",
    recipientStyle: "",
    personaTags: [], // value 数组
    notes: "",
    relationOptions: RELATION_OPTIONS,
    genderOptions: GENDER_OPTIONS,
    occupationOptions: OCCUPATION_OPTIONS,
    styleOptions: STYLE_OPTIONS,
    personaOptions: PERSONA_OPTIONS,
    maxPersona: MAX_PERSONA,
    saving: false,
  },

  onLoad(options) {
    if (options.recipientId) {
      this.setData({ recipientId: options.recipientId });
      this.loadOne(options.recipientId);
    }
  },

  loadOne(id) {
    recipientRepo
      .getRecipient(id)
      .then((r) => {
        if (!r) return; // 已被删/不存在：静默，按空表渲染
        this.setData({
          nickname: r.nickname || "",
          target: r.target || "",
          gender: r.gender || "",
          occupation: r.occupation || "",
          recipientStyle: r.recipientStyle || "",
          personaTags: Array.isArray(r.personaTags) ? r.personaTags : [],
          notes: r.notes || "",
        });
      })
      .catch(() => {});
  },

  onNickname(e) {
    this.setData({ nickname: e.detail.value });
  },

  onNotes(e) {
    this.setData({ notes: e.detail.value });
  },

  // 单选维度：再次点选中项 = 取消（关系/性别/职业/风格均非必填）
  pickSingle(e) {
    const { field, value } = e.currentTarget.dataset;
    this.setData({ [field]: this.data[field] === value ? "" : value });
  },

  // personaTags 多选，最多 5
  togglePersona(e) {
    const value = e.currentTarget.dataset.value;
    const cur = this.data.personaTags;
    const idx = cur.indexOf(value);
    if (idx >= 0) {
      this.setData({ personaTags: cur.filter((v) => v !== value) });
      return;
    }
    if (cur.length >= this.data.maxPersona) {
      wx.showToast({ title: `最多选${this.data.maxPersona}个`, icon: "none" });
      return;
    }
    this.setData({ personaTags: cur.concat(value) });
  },

  // 「完成」= 自动保存：组装 recipient → create/update → 成功后 navigateBack
  onSave() {
    if (this.data.saving) return;
    const recipient = {
      nickname: this.data.nickname.trim(),
      target: this.data.target,
      gender: this.data.gender,
      occupation: this.data.occupation,
      recipientStyle: this.data.recipientStyle,
      personaTags: this.data.personaTags, // 始终带上（含空数组，配合 repo hasOwnProperty 语义）
      notes: this.data.notes.trim(),
    };
    if (!recipient.nickname) {
      wx.showToast({ title: "请填写称呼", icon: "none" });
      return;
    }

    this.setData({ saving: true });
    const op = this.data.recipientId
      ? recipientRepo.updateRecipient(this.data.recipientId, recipient)
      : recipientRepo.createRecipient(recipient);
    op
      .then(() => {
        this.setData({ saving: false });
        wx.showToast({ title: "已保存", icon: "success" });
        setTimeout(() => wx.navigateBack(), 350);
      })
      .catch(() => {
        this.setData({ saving: false });
        wx.showToast({ title: "保存失败", icon: "none" });
      });
  },
});
