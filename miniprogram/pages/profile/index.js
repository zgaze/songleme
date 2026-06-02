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
    const title = event.currentTarget.dataset.title;
    wx.showToast({
      title,
      icon: "none",
    });
  },
});
