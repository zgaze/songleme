const recipientRepo = require("../../shared/recipientRepo");
const { getPersonaLabel } = require("../../shared/recipientTags");

// 中文标签字典（列表摘要展示用，value 与 master/schema 完全一致）
const RELATION_LABELS = {
  partner: "伴侣",
  parents: "父母",
  bestie: "好友",
};
const GENDER_LABELS = {
  female: "女",
  male: "男",
};
// 把 repo 返回的原始行包成 { recipientId, nickname, summary, raw }
function formatRecipientForList(item) {
  const parts = [];
  if (item.target && RELATION_LABELS[item.target]) {
    parts.push(RELATION_LABELS[item.target]);
  }
  if (item.gender && GENDER_LABELS[item.gender]) {
    parts.push(GENDER_LABELS[item.gender]);
  }
  const tags = Array.isArray(item.personaTags) ? item.personaTags : [];
  const tagLabels = tags
    .map((t) => getPersonaLabel(t))
    .filter(Boolean)
    .slice(0, 3);
  if (tagLabels.length) {
    parts.push(tagLabels.join("·"));
  }
  return {
    recipientId: item.recipientId,
    nickname: item.nickname || "未命名",
    summary: parts.join(" · "),
    raw: item,
  };
}

// 从 recipient 取可预填的轻量基础信息，逐个非空才写入。
function buildPrefill(recipient) {
  const prefill = {};
  ["target", "gender"].forEach((k) => {
    if (recipient[k]) prefill[k] = recipient[k];
  });
  return prefill;
}

Page({
  data: {
    mode: "manage", // "manage" | "pick"
    loading: true,
    items: [],
    error: "",
  },

  onLoad(options) {
    this.setData({ mode: options.mode === "pick" ? "pick" : "manage" });
  },

  onShow() {
    // onShow 而非 onLoad，保证从编辑页返回后刷新
    this.loadList();
  },

  loadList() {
    this.setData({ loading: true, error: "" });
    recipientRepo
      .listRecipients()
      .then((rows) => {
        const items = (rows || []).map(formatRecipientForList);
        this.setData({ loading: false, items });
        // 管理模式下空列表 → 直接进新建（首次使用更顺）
        if (this.data.mode === "manage" && items.length === 0) {
          this.goCreate();
        }
      })
      .catch(() => this.setData({ loading: false, error: "加载失败，请重试" }));
  },

  goCreate() {
    wx.navigateTo({ url: "/pages/contactEdit/index" });
  },

  goEdit(e) {
    // 管理模式：点行进编辑
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/contactEdit/index?recipientId=${id}` });
  },

  onDelete(e) {
    // 管理模式：删除（带二次确认）
    const id = e.currentTarget.dataset.id;
    wx
      .showModal({
        title: "删除联系人",
        content: "确定删除该联系人？",
        confirmColor: "#6e334c",
      })
      .then((r) => {
        if (!r.confirm) return;
        return recipientRepo.deleteRecipient(id).then(() => {
          wx.showToast({ title: "已删除", icon: "none" });
          this.loadList();
        });
      })
      .catch(() => wx.showToast({ title: "删除失败", icon: "none" }));
  },

  onPick(e) {
    // 选择模式：选用 → 跳问卷（C2/C3）
    const id = e.currentTarget.dataset.id;
    const matched = this.data.items.find((it) => it.recipientId === id) || {};
    const recipient = matched.raw;
    if (!recipient) return;
    const prefill = buildPrefill(recipient);
    const skip = "target,gender";
    const url = `/pages/question/index?prefill=${encodeURIComponent(
      JSON.stringify(prefill)
    )}&skip=${skip}`;
    wx.navigateTo({ url });
  },

  onSkip() {
    // 选择模式：跳过 / 匿名送（无参，走完整问卷）
    wx.navigateTo({ url: "/pages/question/index" });
  },
});
