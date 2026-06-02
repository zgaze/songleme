const { ENV_ID } = require("./shared/constants");

App({
  globalData: {
    envId: ENV_ID,
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error("wx.cloud is unavailable. Please use WeChat base library 2.2.3 or later.");
      return;
    }

    wx.cloud.init({
      env: ENV_ID,
      traceUser: true,
    });
  },
});
