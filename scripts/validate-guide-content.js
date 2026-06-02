#!/usr/bin/env node

const {
  GUIDE_CONTENT_VERSION,
  guideArticles,
  guideChannels,
  getPublishedGuideArticlesByChannel,
  getPublishedGuideChannels,
} = require("../miniprogram/shared/guideContent");
const { QUESTIONNAIRE_CONFIG } = require("../miniprogram/shared/questionnaire");

const RESULT_OK = 0;
const RESULT_ERROR = 1;
const ID_PATTERN = /^[a-z][a-z0-9_]*(-[a-z0-9_]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_ACCENTS = new Set(["blue", "pink", "green", "apricot"]);
const ALLOWED_STATUSES = new Set(["published", "draft"]);
const ALLOWED_BLOCK_TYPES = new Set([
  "heading",
  "paragraph",
  "tip",
  "list",
  "checklist",
  "compare",
  "giftRefs",
]);
const ALLOWED_SCENES = new Set(getQuestionValues("scene"));
const ALLOWED_TARGETS = new Set(getQuestionValues("target"));
const ALLOWED_BUDGETS = new Set(getQuestionValues("budget"));

function validateGuideContent() {
  const errors = [];
  const warnings = [];

  if (!isNonEmptyString(GUIDE_CONTENT_VERSION)) {
    errors.push("GUIDE_CONTENT_VERSION is required.");
  }
  if (!Array.isArray(guideChannels) || !guideChannels.length) {
    errors.push("guideChannels must be a non-empty array.");
  }
  if (!Array.isArray(guideArticles) || !guideArticles.length) {
    errors.push("guideArticles must be a non-empty array.");
  }

  const channelIds = new Set();
  const articleIds = new Set();
  const articleById = new Map();

  guideChannels.forEach((channel, index) => {
    const prefix = `guideChannels[${index}]`;

    if (!isObject(channel)) {
      errors.push(`${prefix} must be an object.`);
      return;
    }
    if (!isValidId(channel.id)) {
      errors.push(`${prefix}.id must be a valid lowercase id.`);
    } else if (channelIds.has(channel.id)) {
      errors.push(`Duplicate channel id: ${channel.id}.`);
    } else {
      channelIds.add(channel.id);
    }
    if (!isNonEmptyString(channel.name)) errors.push(`${prefix}.name is required.`);
    if (!isNonEmptyString(channel.summary)) errors.push(`${prefix}.summary is required.`);
    if (!isNonEmptyString(channel.note)) errors.push(`${prefix}.note is required.`);
    if (!ALLOWED_ACCENTS.has(channel.accent)) {
      errors.push(`${prefix}.accent must be one of blue/pink/green/apricot.`);
    }
    if (!Array.isArray(channel.articleIds) || !channel.articleIds.length) {
      errors.push(`${prefix}.articleIds must be a non-empty array.`);
    }
  });

  guideArticles.forEach((article, index) => {
    const prefix = `guideArticles[${index}]`;

    if (!isObject(article)) {
      errors.push(`${prefix} must be an object.`);
      return;
    }
    if (!isValidId(article.id)) {
      errors.push(`${prefix}.id must be a valid lowercase id.`);
    } else if (articleIds.has(article.id)) {
      errors.push(`Duplicate article id: ${article.id}.`);
    } else {
      articleIds.add(article.id);
      articleById.set(article.id, article);
    }
    if (!isValidId(article.channelId)) {
      errors.push(`${prefix}.channelId must be a valid lowercase id.`);
    } else if (!channelIds.has(article.channelId)) {
      errors.push(`${prefix}.channelId points to missing channel: ${article.channelId}.`);
    }
    if (!ALLOWED_STATUSES.has(article.status)) {
      errors.push(`${prefix}.status must be published or draft.`);
    }
    if (!isNonEmptyString(article.title)) errors.push(`${prefix}.title is required.`);
    if (!isNonEmptyString(article.summary)) errors.push(`${prefix}.summary is required.`);
    if (!DATE_PATTERN.test(article.updatedAt || "")) {
      errors.push(`${prefix}.updatedAt must use YYYY-MM-DD.`);
    }
    if (!Number.isInteger(article.readingMinutes) || article.readingMinutes < 1 || article.readingMinutes > 15) {
      errors.push(`${prefix}.readingMinutes must be an integer between 1 and 15.`);
    }
    validateStringArray(article.tags, `${prefix}.tags`, errors, { min: 1, max: 6 });
    validateEnumArray(article.scenes, `${prefix}.scenes`, errors, ALLOWED_SCENES);
    validateEnumArray(article.targets, `${prefix}.targets`, errors, ALLOWED_TARGETS);
    validateEnumArray(article.budgets, `${prefix}.budgets`, errors, ALLOWED_BUDGETS);
    validateBlocks(article.blocks, `${prefix}.blocks`, errors);
  });

  guideChannels.forEach((channel, index) => {
    if (!Array.isArray(channel.articleIds)) return;

    const seen = new Set();
    channel.articleIds.forEach((articleId, articleIndex) => {
      const prefix = `guideChannels[${index}].articleIds[${articleIndex}]`;

      if (!isValidId(articleId)) {
        errors.push(`${prefix} must be a valid lowercase id.`);
        return;
      }
      if (seen.has(articleId)) {
        errors.push(`${prefix} duplicates ${articleId}.`);
        return;
      }
      seen.add(articleId);

      const article = articleById.get(articleId);
      if (!article) {
        errors.push(`${prefix} points to missing article: ${articleId}.`);
      } else if (article.channelId !== channel.id) {
        errors.push(`${prefix} points to article in another channel: ${articleId}.`);
      }
    });
  });

  guideArticles.forEach((article) => {
    const channel = guideChannels.find((item) => item.id === article.channelId);
    if (channel && channel.articleIds.indexOf(article.id) < 0) {
      warnings.push(`Article ${article.id} is not referenced by channel ${article.channelId}.`);
    }
  });

  const publishedChannels = getPublishedGuideChannels();
  if (!publishedChannels.length) {
    errors.push("At least one channel must contain a published article.");
  }

  publishedChannels.forEach((channel) => {
    const articles = getPublishedGuideArticlesByChannel(channel.id);
    if (!articles.length) {
      errors.push(`Published channel ${channel.id} has no published articles.`);
    }
  });

  return { errors, warnings };
}

function validateBlocks(blocks, prefix, errors) {
  if (!Array.isArray(blocks) || !blocks.length) {
    errors.push(`${prefix} must be a non-empty array.`);
    return;
  }

  const blockIds = new Set();

  blocks.forEach((block, index) => {
    const blockPrefix = `${prefix}[${index}]`;

    if (!isObject(block)) {
      errors.push(`${blockPrefix} must be an object.`);
      return;
    }
    if (!isValidId(block.id)) {
      errors.push(`${blockPrefix}.id must be a valid lowercase id.`);
    } else if (blockIds.has(block.id)) {
      errors.push(`${blockPrefix}.id duplicates ${block.id}.`);
    } else {
      blockIds.add(block.id);
    }
    if (!ALLOWED_BLOCK_TYPES.has(block.type)) {
      errors.push(`${blockPrefix}.type is not supported: ${block.type}.`);
      return;
    }

    if (block.type === "heading" || block.type === "paragraph") {
      if (!isNonEmptyString(block.text)) errors.push(`${blockPrefix}.text is required.`);
      return;
    }

    if (!isNonEmptyString(block.title)) {
      errors.push(`${blockPrefix}.title is required.`);
    }

    if (block.type === "tip") {
      if (!isNonEmptyString(block.text)) errors.push(`${blockPrefix}.text is required.`);
      return;
    }

    if (block.type === "list" || block.type === "checklist") {
      validateStringArray(block.items, `${blockPrefix}.items`, errors, { min: 1 });
      return;
    }

    if (block.type === "compare") {
      validateObjectArray(block.items, `${blockPrefix}.items`, errors, ["label", "good", "caution"]);
      return;
    }

    if (block.type === "giftRefs") {
      validateObjectArray(block.items, `${blockPrefix}.items`, errors, ["name", "note"]);
    }
  });
}

function validateStringArray(value, prefix, errors, options = {}) {
  const min = options.min || 0;
  const max = options.max || Infinity;

  if (!Array.isArray(value)) {
    errors.push(`${prefix} must be an array.`);
    return;
  }
  if (value.length < min) {
    errors.push(`${prefix} must contain at least ${min} item(s).`);
  }
  if (value.length > max) {
    errors.push(`${prefix} must contain at most ${max} item(s).`);
  }
  value.forEach((item, index) => {
    if (!isNonEmptyString(item)) {
      errors.push(`${prefix}[${index}] must be a non-empty string.`);
    }
  });
}

function validateEnumArray(value, prefix, errors, allowedValues) {
  validateStringArray(value, prefix, errors);
  if (!Array.isArray(value)) return;

  value.forEach((item, index) => {
    if (isNonEmptyString(item) && !allowedValues.has(item)) {
      errors.push(`${prefix}[${index}] is not in questionnaire options: ${item}.`);
    }
  });
}

function validateObjectArray(value, prefix, errors, requiredFields) {
  if (!Array.isArray(value) || !value.length) {
    errors.push(`${prefix} must be a non-empty array.`);
    return;
  }

  value.forEach((item, index) => {
    const itemPrefix = `${prefix}[${index}]`;
    if (!isObject(item)) {
      errors.push(`${itemPrefix} must be an object.`);
      return;
    }
    requiredFields.forEach((field) => {
      if (!isNonEmptyString(item[field])) {
        errors.push(`${itemPrefix}.${field} is required.`);
      }
    });
  });
}

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidId(value) {
  return isNonEmptyString(value) && ID_PATTERN.test(value);
}

function getQuestionValues(questionId) {
  const question = QUESTIONNAIRE_CONFIG.questions.find((item) => item.id === questionId);
  if (!question) return [];

  return question.options.map((option) => option.value);
}

function main() {
  const { errors, warnings } = validateGuideContent();

  warnings.forEach((warning) => {
    console.warn(`Warning: ${warning}`);
  });

  if (errors.length) {
    errors.forEach((error) => {
      console.error(`Error: ${error}`);
    });
    process.exit(RESULT_ERROR);
  }

  console.log("Guide content checks passed.");
  process.exit(RESULT_OK);
}

main();
