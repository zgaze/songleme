const cloud = require("wx-server-sdk");
const {
  MODEL_VERSION,
  QUESTIONNAIRE_VERSION,
  SCHEMA_VERSION,
  normalizeAnswers,
  recommendGift,
} = require("./lib/recommender");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const answers = event.answers || {};
  const result = recommendGift(answers);
  const runId = createRunId();
  const persistence = await persistRecommendationRun({
    runId,
    openid: wxContext.OPENID,
    answers,
    result,
  });

  return {
    ...result,
    meta: {
      runId,
      userScoped: Boolean(wxContext.OPENID),
      schemaVersion: SCHEMA_VERSION,
      questionnaireVersion: QUESTIONNAIRE_VERSION,
      modelVersion: MODEL_VERSION,
      persistence,
    },
  };
};

function createRunId() {
  return `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function persistRecommendationRun({ runId, openid, answers, result }) {
  if (!openid) {
    return {
      saved: false,
      reason: "missing_openid",
    };
  }

  try {
    await db.collection("recommendation_runs").add({
      data: {
        _openid: openid,
        runId,
        answers,
        normalizedAnswers: normalizeAnswers(answers),
        candidateIds: (result.candidates || []).map((candidate) => candidate.id),
        summary: result.summary || "",
        pairings: result.pairings || [],
        schemaVersion: SCHEMA_VERSION,
        questionnaireVersion: QUESTIONNAIRE_VERSION,
        modelVersion: MODEL_VERSION,
        createdAt: db.serverDate(),
      },
    });

    return {
      saved: true,
    };
  } catch (error) {
    console.error("Failed to persist recommendation run", {
      runId,
      message: error && error.message,
    });
    return {
      saved: false,
      reason: "write_failed",
    };
  }
}
