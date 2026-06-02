const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const ALLOWED_ACTIONS = new Set(["refresh", "view_more", "click_gift", "favorite", "dislike"]);

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return fail("UNAUTHENTICATED", "Missing user identity.");

  const action = String(event.action || "").trim();
  if (!ALLOWED_ACTIONS.has(action)) {
    return fail("INVALID_ACTION", "Unsupported feedback action.");
  }

  const runId = cleanText(event.runId, 80);
  const giftId = cleanText(event.giftId, 80);

  await db.collection("recommendation_feedback").add({
    data: {
      _openid: OPENID,
      runId,
      giftId,
      action,
      context: cleanObject(event.context),
      createdAt: db.serverDate(),
    },
  });

  return {
    ok: true,
  };
};

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function cleanObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.keys(value).slice(0, 20).reduce((result, key) => {
    const cleanKey = cleanText(key, 40);
    const rawValue = value[key];
    if (!cleanKey) return result;
    if (typeof rawValue === "string" || typeof rawValue === "number" || typeof rawValue === "boolean") {
      result[cleanKey] = rawValue;
    }
    return result;
  }, {});
}

function fail(code, message) {
  return {
    ok: false,
    code,
    message,
  };
}
