#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(ROOT, "miniprogram/shared/questionnaire.config.json");
const RUNTIME_PATH = path.join(ROOT, "miniprogram/shared/questionnaire.js");
const RESULT_OK = 0;
const RESULT_ERROR = 1;
const ALLOWED_TYPES = new Set(["single", "multi"]);
const ALLOWED_SIZES = new Set(["xl", "lg", "md", "sm"]);
const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

const writeRuntime = process.argv.includes("--write-runtime");

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot parse ${path.relative(ROOT, filePath)}: ${error.message}`);
  }
}

function addIssue(list, message) {
  list.push(message);
}

function validateConfig(config) {
  const errors = [];
  const warnings = [];

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return { errors: ["Config must be a JSON object."], warnings };
  }

  if (!isNonEmptyString(config.version)) {
    addIssue(errors, "`version` is required.");
  }
  if (!isValidId(config.startQuestionId)) {
    addIssue(errors, "`startQuestionId` must be a valid id.");
  }
  if (!isValidId(config.resultNode)) {
    addIssue(errors, "`resultNode` must be a valid id.");
  }
  if (!Array.isArray(config.questions) || !config.questions.length) {
    addIssue(errors, "`questions` must be a non-empty array.");
    return { errors, warnings };
  }

  const questionIds = new Set();
  const questionById = new Map();

  config.questions.forEach((question, index) => {
    const prefix = `questions[${index}]`;

    if (!question || typeof question !== "object" || Array.isArray(question)) {
      addIssue(errors, `${prefix} must be an object.`);
      return;
    }

    if (!isValidId(question.id)) {
      addIssue(errors, `${prefix}.id must be a valid id.`);
    } else if (question.id === config.resultNode) {
      addIssue(errors, `${prefix}.id cannot equal resultNode.`);
    } else if (questionIds.has(question.id)) {
      addIssue(errors, `Duplicate question id: ${question.id}.`);
    } else {
      questionIds.add(question.id);
      questionById.set(question.id, question);
    }

    if (!isNonEmptyString(question.title)) {
      addIssue(errors, `${prefix}.title is required.`);
    }
    if (!ALLOWED_TYPES.has(question.type)) {
      addIssue(errors, `${prefix}.type must be single or multi.`);
    }
    if (question.defaultNext !== undefined && !isNonEmptyString(question.defaultNext)) {
      addIssue(errors, `${prefix}.defaultNext must be a non-empty string when present.`);
    }
    if (question.max !== undefined) {
      if (!Number.isInteger(question.max) || question.max < 1) {
        addIssue(errors, `${prefix}.max must be a positive integer.`);
      }
    }
    if (!Array.isArray(question.options) || !question.options.length) {
      addIssue(errors, `${prefix}.options must be a non-empty array.`);
      return;
    }

    if (question.type === "multi") {
      question.options.forEach((option, optionIndex) => {
        if (option && option.next !== undefined) {
          addIssue(errors, `${prefix}.options[${optionIndex}].next is not supported for multi questions.`);
        }
      });
    }

    if (question.max && question.max > question.options.length) {
      addIssue(errors, `${prefix}.max cannot be greater than options.length.`);
    }

    const optionValues = new Set();
    question.options.forEach((option, optionIndex) => {
      const optionPrefix = `${prefix}.options[${optionIndex}]`;

      if (!option || typeof option !== "object" || Array.isArray(option)) {
        addIssue(errors, `${optionPrefix} must be an object.`);
        return;
      }

      if (!isNonEmptyString(option.value)) {
        addIssue(errors, `${optionPrefix}.value is required.`);
      } else if (optionValues.has(option.value)) {
        addIssue(errors, `${prefix} has duplicate option value: ${option.value}.`);
      } else {
        optionValues.add(option.value);
      }

      if (!isNonEmptyString(option.label)) {
        addIssue(errors, `${optionPrefix}.label is required.`);
      }
      if (option.size !== undefined && !ALLOWED_SIZES.has(option.size)) {
        addIssue(errors, `${optionPrefix}.size must be one of xl/lg/md/sm.`);
      }
      if (option.next !== undefined && !isNonEmptyString(option.next)) {
        addIssue(errors, `${optionPrefix}.next must be a non-empty string when present.`);
      }
      if (option.min !== undefined && typeof option.min !== "number") {
        addIssue(errors, `${optionPrefix}.min must be a number when present.`);
      }
      if (option.max !== undefined && option.max !== null && typeof option.max !== "number") {
        addIssue(errors, `${optionPrefix}.max must be a number or null when present.`);
      }
      if (typeof option.min === "number" && typeof option.max === "number" && option.min > option.max) {
        addIssue(errors, `${optionPrefix}.min cannot be greater than max.`);
      }
    });
  });

  if (errors.length) {
    return { errors, warnings };
  }

  if (!questionById.has(config.startQuestionId)) {
    addIssue(errors, `startQuestionId points to missing question: ${config.startQuestionId}.`);
  }

  config.questions.forEach((question) => {
    getEdges(question, config.resultNode).forEach((target) => {
      if (target !== config.resultNode && !questionById.has(target)) {
        addIssue(errors, `Question ${question.id} points to missing next question: ${target}.`);
      }
    });
  });

  if (errors.length) {
    return { errors, warnings };
  }

  const reachable = collectReachableQuestions(config.startQuestionId);

  config.questions.forEach((question) => {
    if (!reachable.has(question.id)) {
      addIssue(warnings, `Question ${question.id} is not reachable from ${config.startQuestionId}.`);
    }
  });

  const pathMemo = new Map();
  reachable.forEach((questionId) => {
    if (!canReachResult(questionId, [])) {
      addIssue(errors, `Reachable question ${questionId} has no path to ${config.resultNode}.`);
    }
  });

  if (!canReachResult(config.startQuestionId, [])) {
    addIssue(errors, `No path from ${config.startQuestionId} reaches ${config.resultNode}.`);
  }

  return { errors, warnings };

  function collectReachableQuestions(startQuestionId) {
    const result = new Set();
    const stack = [];

    visit(startQuestionId);
    return result;

    function visit(questionId) {
      if (questionId === config.resultNode) return;
      if (stack.includes(questionId)) {
        addIssue(errors, `Question graph has a cycle: ${stack.concat(questionId).join(" -> ")}.`);
        return;
      }
      if (result.has(questionId)) return;

      const question = questionById.get(questionId);
      if (!question) return;

      result.add(questionId);
      stack.push(questionId);
      getEdges(question, config.resultNode).forEach(visit);
      stack.pop();
    }
  }

  function canReachResult(questionId, stack) {
    if (questionId === config.resultNode) return true;
    if (stack.includes(questionId)) return false;
    if (pathMemo.has(questionId)) return pathMemo.get(questionId);

    const question = questionById.get(questionId);
    if (!question) {
      pathMemo.set(questionId, false);
      return false;
    }

    const edges = getEdges(question, config.resultNode);
    const reaches = edges.some((target) => canReachResult(target, stack.concat(questionId)));

    pathMemo.set(questionId, reaches);
    return reaches;
  }
}

function getEdges(question, resultNode) {
  if (question.type === "single") {
    return unique(
      question.options.map((option) => normalizeNext(option.next || question.defaultNext, resultNode))
    );
  }

  return [normalizeNext(question.defaultNext, resultNode)];
}

function normalizeNext(next, resultNode) {
  return next || resultNode;
}

function unique(values) {
  return Array.from(new Set(values));
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidId(value) {
  return isNonEmptyString(value) && ID_PATTERN.test(value);
}

function buildRuntimeSource(config) {
  const serialized = JSON.stringify(config, null, 2);

  return `// This file is generated from questionnaire.config.json.\n// Edit questionnaire.config.json, then run: node scripts/validate-questionnaire.js --write-runtime\n\nconst QUESTIONNAIRE_CONFIG = ${serialized};\n\nconst QUESTIONS = QUESTIONNAIRE_CONFIG.questions;\nconst RESULT_NODE = QUESTIONNAIRE_CONFIG.resultNode;\nconst START_QUESTION_ID = QUESTIONNAIRE_CONFIG.startQuestionId;\n\nmodule.exports = {\n  QUESTIONNAIRE_CONFIG,\n  QUESTIONS,\n  RESULT_NODE,\n  START_QUESTION_ID,\n};\n`;
}

function main() {
  let config;
  try {
    config = readJson(CONFIG_PATH);
  } catch (error) {
    console.error(error.message);
    process.exit(RESULT_ERROR);
  }

  const { errors, warnings } = validateConfig(config);
  warnings.forEach((warning) => console.warn(`Warning: ${warning}`));

  if (errors.length) {
    errors.forEach((error) => console.error(`Error: ${error}`));
    process.exit(RESULT_ERROR);
  }

  const nextRuntime = buildRuntimeSource(config);
  const currentRuntime = fs.existsSync(RUNTIME_PATH)
    ? fs.readFileSync(RUNTIME_PATH, "utf8")
    : "";

  if (writeRuntime) {
    fs.writeFileSync(RUNTIME_PATH, nextRuntime);
    console.log("Questionnaire config is valid. Runtime file written.");
    return;
  }

  if (currentRuntime !== nextRuntime) {
    console.error("Error: Runtime questionnaire.js is out of sync.");
    console.error("Run: node scripts/validate-questionnaire.js --write-runtime");
    process.exit(RESULT_ERROR);
  }

  console.log("Questionnaire config is valid.");
}

main();
