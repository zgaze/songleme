const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { items: [], hasMore: false };

  const limit = clampInteger(event.limit, 1, 30, 20);
  const offset = clampInteger(event.offset, 0, 1000, 0);

  const response = await db.collection("recommendation_runs")
    .where({ _openid: OPENID })
    .orderBy("createdAt", "desc")
    .skip(offset)
    .limit(limit + 1)
    .get();

  const rows = response.data || [];
  return {
    items: rows.slice(0, limit).map(toHistoryItem),
    hasMore: rows.length > limit,
  };
};

function toHistoryItem(row) {
  return {
    runId: row.runId,
    answers: row.answers || {},
    candidateIds: row.candidateIds || [],
    summary: row.summary || "",
    pairings: row.pairings || [],
    modelVersion: row.modelVersion || "",
    questionnaireVersion: row.questionnaireVersion || "",
    createdAt: row.createdAt || null,
  };
}

function clampInteger(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}
