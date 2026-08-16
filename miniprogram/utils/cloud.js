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

function aiPickGift(answers) {
  return callCloudFunction("recommendGift", {
    action: "aiPick",
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
  aiPickGift,
  callCloudFunction,
  createGiftShare,
  getGiftShare,
  recommendGift,
};
