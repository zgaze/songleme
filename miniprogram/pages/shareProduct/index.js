const { getGiftShare } = require("../../utils/cloud");
const {
  QUESTION_PATH,
  buildProductShareById,
  buildProductShare,
  decodeSharePayload,
} = require("../../shared/sharePayload");

Page({
  data: {
    product: {
      name: "一份适合送人的礼物",
      reason: "这份礼物兼顾心意和日常使用，适合拿来认真表达。",
      tags: [],
      imageUrl: "",
    },
    shareId: "",
  },

  onLoad(options) {
    if (options.id) {
      this.loadShare(options.id);
    }

    const payload = decodeSharePayload(options.p);

    this.setData({
      product: {
        name: payload.name || this.data.product.name,
        reason: payload.reason || this.data.product.reason,
        tags: Array.isArray(payload.tags) ? payload.tags : [],
        imageUrl: payload.imageUrl || "",
      },
      shareId: options.id || "",
    });

    wx.showShareMenu({
      withShareTicket: true,
      menus: ["shareAppMessage"],
    });
  },

  startQuestionnaire() {
    wx.navigateTo({
      url: QUESTION_PATH,
    });
  },

  loadShare(shareId) {
    getGiftShare(shareId)
      .then((response) => {
        if (!response || !response.found || response.type !== "product") return;

        const snapshot = response.snapshot || {};
        this.setData({
          shareId,
          product: {
            name: snapshot.name || this.data.product.name,
            reason: snapshot.reason || this.data.product.reason,
            tags: Array.isArray(snapshot.tags) ? snapshot.tags : [],
            imageUrl: snapshot.imageUrl || "",
          },
        });
      })
      .catch(() => {});
  },

  onShareAppMessage() {
    if (this.data.shareId) {
      return buildProductShareById(this.data.shareId, this.data.product);
    }

    return buildProductShare(this.data.product);
  },
});
