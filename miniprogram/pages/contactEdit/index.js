const recipientRepo = require("../../shared/recipientRepo");
const { getPersonaOptions } = require("../../shared/recipientTags");

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
const MAX_PERSONA = 5;

function filterPersonaTags(selectedTags, target) {
  const selected = Array.isArray(selectedTags) ? selectedTags : [];
  const allowed = getPersonaOptions(target).map((option) => option.value);
  return selected.filter((value) => allowed.indexOf(value) >= 0);
}

function buildPersonaOptions(selectedTags, target) {
  const selected = filterPersonaTags(selectedTags, target);
  return getPersonaOptions(target).map((option) => ({
    ...option,
    selected: selected.indexOf(option.value) >= 0,
  }));
}

Page({
  data: {
    recipientId: "", // 空 = 新建
    nickname: "",
    target: "",
    gender: "",
    personaTags: [], // value 数组
    notes: "",
    relationOptions: RELATION_OPTIONS,
    genderOptions: GENDER_OPTIONS,
    personaOptions: buildPersonaOptions([], ""),
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
        const target = r.target || "";
        const personaTags = filterPersonaTags(r.personaTags, target);
        this.setData({
          nickname: r.nickname || "",
          target,
          gender: r.gender || "",
          personaTags,
          personaOptions: buildPersonaOptions(personaTags, target),
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

  // 单选维度：再次点选中项 = 取消（关系/性别均非必填）
  pickSingle(e) {
    const { field, value } = e.currentTarget.dataset;
    const nextValue = this.data[field] === value ? "" : value;

    if (field === "target") {
      const personaTags = filterPersonaTags(this.data.personaTags, nextValue);
      this.setData({
        target: nextValue,
        personaTags,
        personaOptions: buildPersonaOptions(personaTags, nextValue),
      });
      return;
    }

    this.setData({ [field]: nextValue });
  },

  // personaTags 多选，最多 5
  togglePersona(e) {
    const value = e.currentTarget.dataset.value;
    const cur = Array.isArray(this.data.personaTags) ? this.data.personaTags : [];
    const idx = cur.indexOf(value);
    if (idx >= 0) {
      const next = cur.filter((v) => v !== value);
      this.setData({
        personaTags: next,
        personaOptions: buildPersonaOptions(next, this.data.target),
      });
      return;
    }
    if (cur.length >= this.data.maxPersona) {
      wx.showToast({ title: `最多选${this.data.maxPersona}个`, icon: "none" });
      return;
    }
    const next = cur.concat(value);
    this.setData({
      personaTags: next,
      personaOptions: buildPersonaOptions(next, this.data.target),
    });
  },

  // 「完成」= 自动保存：组装 recipient → create/update → 成功后 navigateBack
  onSave() {
    if (this.data.saving) return;
    const recipient = {
      nickname: this.data.nickname.trim(),
      target: this.data.target,
      gender: this.data.gender,
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
