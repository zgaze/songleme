const { getGiftShare } = require("../../utils/cloud");
const {
  QUESTION_PATH,
  buildMysteryShare,
  buildMysteryShareById,
  decodeSharePayload,
} = require("../../shared/sharePayload");

Page({
  data: {
    payload: {},
    shareId: "",
    summary: "有人认真想过你的喜好，给你准备了一份暂时保密的小礼物。",
    pairingText: "",
  },

  onLoad(options) {
    if (options.id) {
      this.loadShare(options.id);
    }

    const payload = decodeSharePayload(options.p);

    this.setData({
      payload,
      shareId: options.id || "",
      summary: payload.summary || this.data.summary,
      pairingText: payload.pairingText || "",
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
        if (!response || !response.found || response.type !== "mystery") return;

        const snapshot = response.snapshot || {};
        this.setData({
          shareId,
          payload: {
            runId: response.runId || "",
          },
          summary: snapshot.summary || this.data.summary,
          pairingText: snapshot.pairingText || "",
        });
      })
      .catch(() => {});
  },

  onShareAppMessage() {
    if (this.data.shareId) {
      return buildMysteryShareById(this.data.shareId);
    }

    return buildMysteryShare({
      summary: this.data.summary,
      pairingText: this.data.pairingText,
      meta: {
        runId: this.data.payload.runId || "",
      },
    });
  },
});
