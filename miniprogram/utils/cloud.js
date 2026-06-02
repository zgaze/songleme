function callCloudFunction(name, data) {
  return wx.cloud.callFunction({
    name,
    data,
  }).then((response) => response.result);
}

function recommendGift(answers) {
  return callCloudFunction("recommendGift", {
    answers,
  });
}

function createGiftShare(data) {
  return callCloudFunction("giftShare", {
    ...data,
    action: "create",
  });
}

function getGiftShare(shareId) {
  return callCloudFunction("giftShare", {
    action: "get",
    shareId,
  });
}

module.exports = {
  callCloudFunction,
  createGiftShare,
  getGiftShare,
  recommendGift,
};
