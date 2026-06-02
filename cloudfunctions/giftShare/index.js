const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const command = db.command;
const VALID_TYPES = new Set(["mystery", "product"]);

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();
  const action = event.action || "create";

  if (action === "get") {
    return getShare(event.shareId);
  }

  if (action === "create") {
    return createShare({
      openid: OPENID,
      type: event.type,
      runId: event.runId,
      snapshot: event.snapshot,
    });
  }

  return {
    ok: false,
    reason: "unknown_action",
  };
};

async function createShare({ openid, type, runId, snapshot }) {
  const safeType = VALID_TYPES.has(type) ? type : "mystery";
  const shareId = createShareId();
  const safeSnapshot = sanitizeSnapshot(safeType, snapshot);

  await db.collection("gift_shares").add({
    data: {
      _openid: openid || "",
      shareId,
      type: safeType,
      runId: limitText(runId, 64),
      snapshot: safeSnapshot,
      viewCount: 0,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate(),
    },
  });

  return {
    ok: true,
    shareId,
    type: safeType,
    snapshot: safeSnapshot,
  };
}

async function getShare(rawShareId) {
  const shareId = limitText(rawShareId, 80);
  if (!shareId) {
    return {
      found: false,
      reason: "missing_share_id",
    };
  }

  const response = await db.collection("gift_shares")
    .where({ shareId })
    .limit(1)
    .get();
  const row = response.data && response.data[0];

  if (!row) {
    return {
      found: false,
      reason: "not_found",
    };
  }

  try {
    await db.collection("gift_shares")
      .doc(row._id)
      .update({
        data: {
          viewCount: command.inc(1),
          updatedAt: db.serverDate(),
        },
      });
  } catch (error) {
    console.error("Failed to update share view count", {
      shareId,
      message: error && error.message,
    });
  }

  return {
    found: true,
    shareId: row.shareId,
    type: row.type,
    runId: row.runId || "",
    snapshot: row.snapshot || {},
  };
}

function createShareId() {
  return `share_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeSnapshot(type, snapshot) {
  const source = snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
    ? snapshot
    : {};

  if (type === "product") {
    return {
      id: limitText(source.id, 64),
      name: limitText(source.name, 32),
      reason: limitText(source.reason, 72),
      tags: sanitizeTags(source.tags),
      imageUrl: limitText(source.imageUrl, 240),
    };
  }

  return {
    summary: limitText(source.summary, 72),
    pairingText: limitText(source.pairingText, 42),
  };
}

function sanitizeTags(tags) {
  return (Array.isArray(tags) ? tags : [tags])
    .filter(Boolean)
    .map((tag) => limitText(tag, 12))
    .filter(Boolean)
    .slice(0, 3);
}

function limitText(value, limit) {
  const text = String(value || "").trim();
  return text.length > limit ? text.slice(0, limit) : text;
}
