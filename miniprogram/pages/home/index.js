const { selectTab } = require("../../utils/tabbar");
const { buildHomeShare } = require("../../shared/sharePayload");

Page({
  onShow() {
    selectTab(this, 0);
    wx.showShareMenu({
      withShareTicket: true,
      menus: ["shareAppMessage", "shareTimeline"],
    });
  },

  startQuestionnaire() {
    wx.navigateTo({
      url: "/pages/question/index",
    });
  },

  openGuide() {
    wx.navigateTo({
      url: "/pages/guide/index",
    });
  },

  onShareAppMessage() {
    return buildHomeShare();
  },

  onShareTimeline() {
    return {
      title: buildHomeShare().title,
      query: "fromShare=timeline",
    };
  },
});
