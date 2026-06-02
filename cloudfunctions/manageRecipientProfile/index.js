const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const ALLOWED_TARGETS = new Set(["partner", "parents", "bestie"]);
const ALLOWED_GENDERS = new Set(["female", "male"]);
const ALLOWED_OCCUPATIONS = new Set(["office", "tech", "creative", "medical_education", "student", "freelance", "homemaker"]);
const ALLOWED_STYLES = new Set(["practical", "aesthetic", "experiential", "quality"]);

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return fail("UNAUTHENTICATED", "Missing user identity.");

  const action = String(event.action || "list");
  if (action === "list") return listRecipients(OPENID);
  if (action === "create") return createRecipient(OPENID, event.recipient || {});
  if (action === "update") return updateRecipient(OPENID, event.recipientId, event.patch || {});
  if (action === "delete") return deleteRecipient(OPENID, event.recipientId);
  return fail("INVALID_ACTION", "Unsupported recipient action.");
};

async function listRecipients(openid) {
  const response = await db.collection("recipients")
    .where({ _openid: openid })
    .orderBy("updatedAt", "desc")
    .limit(50)
    .get();

  return {
    ok: true,
    items: (response.data || []).map(toPublicRecipient),
  };
}

async function createRecipient(openid, input) {
  const recipient = cleanRecipient(input);
  const recipientId = createId("rp");

  await db.collection("recipients").add({
    data: {
      _openid: openid,
      recipientId,
      ...recipient,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate(),
    },
  });

  return {
    ok: true,
    recipientId,
  };
}

async function updateRecipient(openid, recipientId, patch) {
  const cleanId = cleanText(recipientId, 80);
  if (!cleanId) return fail("INVALID_RECIPIENT", "recipientId is required.");

  const update = cleanRecipient(patch);
  if (!Object.keys(update).length) return fail("EMPTY_PATCH", "No valid recipient fields.");

  const response = await db.collection("recipients")
    .where({
      _openid: openid,
      recipientId: cleanId,
    })
    .update({
      data: {
        ...update,
        updatedAt: db.serverDate(),
      },
    });

  return {
    ok: true,
    updated: response.stats && response.stats.updated ? response.stats.updated : 0,
  };
}

async function deleteRecipient(openid, recipientId) {
  const cleanId = cleanText(recipientId, 80);
  if (!cleanId) return fail("INVALID_RECIPIENT", "recipientId is required.");

  const response = await db.collection("recipients")
    .where({
      _openid: openid,
      recipientId: cleanId,
    })
    .remove();

  return {
    ok: true,
    deleted: response.stats && response.stats.removed ? response.stats.removed : 0,
  };
}

function cleanRecipient(input) {
  const result = {};
  const nickname = cleanText(input.nickname, 30);
  const target = cleanEnum(input.target, ALLOWED_TARGETS);
  const gender = cleanEnum(input.gender, ALLOWED_GENDERS);
  const occupation = cleanEnum(input.occupation, ALLOWED_OCCUPATIONS);
  const recipientStyle = cleanEnum(input.recipientStyle, ALLOWED_STYLES);
  const notes = cleanText(input.notes, 200);

  if (nickname) result.nickname = nickname;
  if (target) result.target = target;
  if (gender) result.gender = gender;
  if (occupation) result.occupation = occupation;
  if (recipientStyle) result.recipientStyle = recipientStyle;
  if (notes) result.notes = notes;

  return result;
}

function toPublicRecipient(row) {
  return {
    recipientId: row.recipientId,
    nickname: row.nickname || "",
    target: row.target || "",
    gender: row.gender || "",
    occupation: row.occupation || "",
    recipientStyle: row.recipientStyle || "",
    notes: row.notes || "",
    updatedAt: row.updatedAt || null,
  };
}

function cleanEnum(value, allowed) {
  const text = cleanText(value, 80);
  return allowed.has(text) ? text : "";
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function fail(code, message) {
  return {
    ok: false,
    code,
    message,
  };
}
