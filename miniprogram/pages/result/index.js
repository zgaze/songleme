const { aiPickGift, createGiftShare, recommendGift } = require("../../utils/cloud");
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
    aiPicking: false,
    aiPick: null,
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
          aiPick: null,
          result: decoratedResult,
          loading: false,
        });
        this.prepareMysteryShare(decoratedResult);
      })
      .catch(() => {
        const decoratedResult = this.decorateResult(recommendLocally(answers));
        this.setData({
          aiPick: null,
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

  formatTips(tips) {
    return (Array.isArray(tips) ? tips : [tips])
      .filter(Boolean)
      .map((tip) => String(tip).trim())
      .filter(Boolean)
      .slice(0, 3);
  },

  refreshPlan() {
    this.loadRecommendation(this.data.answers);
  },

  aiPick() {
    if (this.data.aiPicking) return;
    const candidates = (this.data.result && this.data.result.candidates) || [];
    if (!candidates.length) {
      wx.showToast({ title: "先生成推荐", icon: "none" });
      return;
    }

    this.setData({ aiPicking: true });
    aiPickGift(this.data.answers)
      .then((response) => {
        const pick = this.decorateAiPick(response && response.pick);
        this.setData({
          aiPick: pick,
          aiPicking: false,
        });
        if (pick.source === "local_fallback") {
          wx.showToast({ title: "已用本地结果兜底", icon: "none" });
        }
      })
      .catch(() => {
        this.setData({
          aiPick: this.decorateAiPick(null),
          aiPicking: false,
        });
        wx.showToast({ title: "AI服务暂不可用", icon: "none" });
      });
  },

  decorateAiPick(rawPick) {
    const candidates = (this.data.result && this.data.result.candidates) || [];
    const pick = rawPick || {};
    const matched = candidates.find((item) => String(item.id) === String(pick.giftId))
      || candidates[0]
      || {};
    const tips = this.formatTips(pick.tips || []);
    return {
      source: pick.source || "local_fallback",
      giftId: matched.id || pick.giftId || "",
      giftName: pick.giftName || matched.name || "这款礼物",
      headline: pick.headline || "先选这款更稳",
      reason: pick.reason || matched.recommendReason || "它和当前答案匹配度最高，送礼风险也相对可控。",
      pairingText: pick.pairingText || (matched.pairingTags || [])[0] || "",
      tips,
    };
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
