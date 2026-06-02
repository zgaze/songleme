#!/usr/bin/env node

const assert = require("assert");
const { QUESTIONNAIRE_CONFIG } = require("../miniprogram/shared/questionnaire");
const {
  MODEL_VERSION,
  QUESTIONNAIRE_VERSION,
  SCHEMA_VERSION,
  normalizeAnswers,
  recommendGift,
} = require("../cloudfunctions/recommendGift/lib/recommender");

const REQUIRED_META = {
  schemaVersion: "gift-backend-v1",
  questionnaireVersion: QUESTIONNAIRE_CONFIG.version,
  modelVersion: "decision-table-v1",
};

function assertRecommendation(name, answers, options = {}) {
  const result = recommendGift(answers);

  assert(result, `${name}: result is required`);
  assert(Array.isArray(result.candidates), `${name}: candidates must be an array`);
  assert(result.candidates.length > 0, `${name}: should return candidates`);
  assert(result.candidates.length <= 24, `${name}: should respect result limit`);
  assert(result.summary, `${name}: summary is required`);

  if (options.minTopScore !== undefined) {
    assert(
      result.candidates[0].score >= options.minTopScore,
      `${name}: top score should be at least ${options.minTopScore}`
    );
  }

  if (options.avoidFirstNames) {
    assert(
      options.avoidFirstNames.indexOf(result.candidates[0].name) < 0,
      `${name}: first candidate should not be ${result.candidates[0].name}`
    );
  }

  return result;
}

function main() {
  assert.strictEqual(SCHEMA_VERSION, REQUIRED_META.schemaVersion);
  assert.strictEqual(QUESTIONNAIRE_VERSION, REQUIRED_META.questionnaireVersion);
  assert.strictEqual(MODEL_VERSION, REQUIRED_META.modelVersion);

  assert.deepStrictEqual(normalizeAnswers({ budget: "100_300" }).budget, ["under_200", "200_500"]);
  assert.deepStrictEqual(normalizeAnswers({ budget: "not_real" }), {});

  assertRecommendation(
    "current questionnaire answer set",
    {
      target: "partner",
      gender: "female",
      scene: "birthday",
      occupation: "creative",
      recipientStyle: "aesthetic",
      budget: "200_500",
    },
    { minTopScore: 50 }
  );

  assertRecommendation(
    "bestie fallback",
    {
      target: "bestie",
      gender: "female",
      scene: "birthday",
      occupation: "student",
      recipientStyle: "aesthetic",
      budget: "200_500",
    },
    {
      minTopScore: 40,
      avoidFirstNames: ["情侣手链"],
    }
  );

  assertRecommendation(
    "apology scene",
    {
      target: "partner",
      scene: "apology",
      occupation: "office",
      recipientStyle: "practical",
      budget: "200_500",
    },
    { minTopScore: 40 }
  );

  assertRecommendation(
    "invalid stale answers",
    {
      target: "stranger",
      scene: "unknown",
      budget: "too_much",
    }
  );

  QUESTIONNAIRE_CONFIG.questions
    .find((question) => question.id === "budget")
    .options.forEach((option) => {
      assertRecommendation(`budget ${option.value}`, { target: "partner", budget: option.value });
    });

  console.log("Recommender checks passed.");
}

main();
