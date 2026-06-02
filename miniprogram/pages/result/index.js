const { createGiftShare, recommendGift } = require("../../utils/cloud");
const { recommendLocally } = require("../../shared/localRecommender");
const {
  buildHomeShare,
  buildMysteryShare,
  buildMysteryShareById,
  buildProductShare,
} = require("../../shared/sharePayload");

Page({
  data: {
    answers: {},
    loading: true,
    result: null,
    mysteryShareId: "",
  },

  onLoad(options) {
    const answers = this.parseAnswers(options.answers);
    this.setData({ answers });
    wx.showShareMenu({
      withShareTicket: true,
      menus: ["shareAppMessage"],
    });
    this.loadRecommendation(answers);
  },

  parseAnswers(raw) {
    if (!raw) return {};

    try {
      return JSON.parse(decodeURIComponent(raw));
    } catch (error) {
      return {};
    }
  },

  loadRecommendation(answers) {
    this.setData({ loading: true });

    recommendGift(answers)
      .then((result) => {
        const decoratedResult = this.decorateResult(result);
        this.setData({
          result: decoratedResult,
          loading: false,
        });
        this.prepareMysteryShare(decoratedResult);
      })
      .catch(() => {
        const decoratedResult = this.decorateResult(recommendLocally(answers));
        this.setData({
          result: decoratedResult,
          loading: false,
        });
        this.prepareMysteryShare(decoratedResult);
      });
  },

  decorateResult(rawResult) {
    const result = rawResult || {};
    const candidates = (result.candidates || []).map((item, index) => ({
      ...item,
      toneClass: `result-card--tone-${index % 4}`,
      imageUrl: item.imageUrl || item.image || "",
      shortReason: this.shortenReason(item.recommendReason || item.highlights || ""),
      displayTags: this.formatTags(item.tags || item.recommendTags || item.highlights || []),
    }));
    const pairings = (result.pairings || []).map((text, index) => ({
      id: `pairing-${index}`,
      text: this.shortenPairing(text),
    }));

    return {
      summary: result.summary || "根据你的选择，优先展示心意明确、送达节奏稳、适合当前预算的礼物。",
      candidates,
      pairings,
      pairingText: pairings.map((item) => item.text).join(" / "),
      meta: result.meta || {},
    };
  },

  shortenPairing(text) {
    const cleanText = String(text || "").split(/[：:]/)[0].trim();
    return cleanText.length > 12 ? `${cleanText.slice(0, 12)}...` : cleanText;
  },

  shortenReason(reason) {
    const text = Array.isArray(reason) ? reason.join("，") : String(reason || "");
    return text.length > 32 ? `${text.slice(0, 32)}...` : text;
  },

  formatTags(tags) {
    return (Array.isArray(tags) ? tags : [tags])
      .filter(Boolean)
      .map((tag) => String(tag).trim())
      .filter(Boolean)
      .slice(0, 2);
  },

  refreshPlan() {
    this.loadRecommendation(this.data.answers);
  },

  aiPick() {
    this.loadRecommendation(this.data.answers);
  },

  prepareMysteryShare(result) {
    this.setData({ mysteryShareId: "" });

    createGiftShare({
      type: "mystery",
      runId: result.meta && result.meta.runId ? result.meta.runId : "",
      snapshot: {
        summary: result.summary,
        pairingText: result.pairingText,
      },
    })
      .then((response) => {
        if (response && response.shareId) {
          this.setData({ mysteryShareId: response.shareId });
        }
      })
      .catch(() => {});
  },

  onShareAppMessage(res) {
    const dataset = (res && res.target && res.target.dataset) || {};

    if (dataset.shareType === "mystery") {
      if (this.data.mysteryShareId) {
        return buildMysteryShareById(this.data.mysteryShareId);
      }
      return buildMysteryShare(this.data.result || {});
    }

    if (dataset.shareType === "product") {
      const product = this.findProductById(dataset.productId);
      return buildProductShare(product);
    }

    return buildHomeShare();
  },

  findProductById(productId) {
    const candidates = (this.data.result && this.data.result.candidates) || [];
    return candidates.find((item) => String(item.id) === String(productId)) || candidates[0] || {};
  },
});
