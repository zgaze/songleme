const { selectTab } = require("../../utils/tabbar");

Page({
  data: {
    entries: [
      { title: "我的偏好", value: "preference" },
      { title: "收礼人档案", value: "recipients" },
      { title: "历史推荐", value: "history" },
    ],
  },

  onShow() {
    selectTab(this, 1);
  },

  openEntry(event) {
    const { title, value } = event.currentTarget.dataset;
    if (value === "recipients") {
      wx.navigateTo({ url: "/pages/contacts/index" });
      return;
    }
    wx.showToast({
      title,
      icon: "none",
    });
  },
});
