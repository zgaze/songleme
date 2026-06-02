const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const ALLOWED_BUDGETS = new Set(["under_200", "200_500", "500_1000", "1000_2000", "2000_plus"]);
const ALLOWED_STYLES = new Set(["minimal", "warm", "delicate", "tech", "classic"]);

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return fail("UNAUTHENTICATED", "Missing user identity.");

  const action = String(event.action || "get");
  if (action === "get") return getPreference(OPENID);
  if (action === "save") return savePreference(OPENID, event.preference || {});
  return fail("INVALID_ACTION", "Unsupported preference action.");
};

async function getPreference(openid) {
  try {
    const response = await db.collection("user_preferences").doc(openid).get();
    return {
      ok: true,
      preference: toPublicPreference(response.data || {}),
    };
  } catch (error) {
    return {
      ok: true,
      preference: {},
    };
  }
}

async function savePreference(openid, input) {
  const preference = cleanPreference(input);

  await db.collection("user_preferences").doc(openid).set({
    data: {
      _openid: openid,
      ...preference,
      updatedAt: db.serverDate(),
    },
  });

  return {
    ok: true,
    preference,
  };
}

function cleanPreference(input) {
  return {
    defaultBudget: cleanEnum(input.defaultBudget, ALLOWED_BUDGETS),
    preferredStyles: cleanEnumArray(input.preferredStyles, ALLOWED_STYLES, 5),
    avoidTags: cleanTextArray(input.avoidTags, 10, 20),
  };
}

function toPublicPreference(row) {
  return {
    defaultBudget: row.defaultBudget || "",
    preferredStyles: Array.isArray(row.preferredStyles) ? row.preferredStyles : [],
    avoidTags: Array.isArray(row.avoidTags) ? row.avoidTags : [],
    updatedAt: row.updatedAt || null,
  };
}

function cleanEnum(value, allowed) {
  const text = cleanText(value, 80);
  return allowed.has(text) ? text : "";
}

function cleanEnumArray(values, allowed, limit) {
  return cleanTextArray(values, limit, 80).filter((value) => allowed.has(value));
}

function cleanTextArray(values, limit, maxLength) {
  const source = Array.isArray(values) ? values : [];
  return Array.from(new Set(source.map((value) => cleanText(value, maxLength)).filter(Boolean))).slice(0, limit);
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function fail(code, message) {
  return {
    ok: false,
    code,
    message,
  };
}
