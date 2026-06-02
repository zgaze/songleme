Component({
  data: {
    selected: 0,
    list: [
      {
        pagePath: "/pages/home/index",
        text: "首页",
      },
      {
        pagePath: "/pages/profile/index",
        text: "我的",
      },
    ],
  },

  methods: {
    switchTab(event) {
      const { index, path } = event.currentTarget.dataset;
      wx.switchTab({ url: path });
      this.setData({ selected: index });
    },
  },
});
