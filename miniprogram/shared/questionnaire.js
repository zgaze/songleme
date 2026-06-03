// This file is generated from questionnaire.config.json.
// Edit questionnaire.config.json, then run: node scripts/validate-questionnaire.js --write-runtime

const QUESTIONNAIRE_CONFIG = {
  "$schema": "../../schemas/questionnaire.schema.json",
  "version": "2026-06-03-tags-v3",
  "startQuestionId": "target",
  "resultNode": "result",
  "questions": [
    {
      "id": "target",
      "title": "送给谁",
      "type": "single",
      "defaultNext": "gender",
      "options": [
        {
          "value": "partner",
          "label": "恋人",
          "size": "xl"
        },
        {
          "value": "parents",
          "label": "爸妈",
          "size": "xl"
        },
        {
          "value": "bestie",
          "label": "闺蜜",
          "size": "xl"
        }
      ]
    },
    {
      "id": "gender",
      "title": "TA 是",
      "type": "single",
      "defaultNext": "scene",
      "options": [
        {
          "value": "female",
          "label": "女生",
          "size": "xl"
        },
        {
          "value": "male",
          "label": "男生",
          "size": "xl"
        }
      ]
    },
    {
      "id": "scene",
      "title": "什么场合",
      "type": "single",
      "defaultNext": "occupation",
      "options": [
        {
          "value": "birthday",
          "label": "生日",
          "size": "xl"
        },
        {
          "value": "anniversary",
          "label": "纪念日",
          "size": "lg"
        },
        {
          "value": "festival",
          "label": "节日",
          "size": "lg"
        },
        {
          "value": "apology",
          "label": "道歉/和好",
          "size": "md"
        },
        {
          "value": "daily",
          "label": "日常关心",
          "size": "md"
        }
      ]
    },
    {
      "id": "occupation",
      "title": "TA 大概做什么的",
      "type": "single",
      "defaultNext": "recipientStyle",
      "options": [
        {
          "value": "office",
          "label": "坐办公室的",
          "size": "lg"
        },
        {
          "value": "tech",
          "label": "程序员/互联网",
          "size": "lg"
        },
        {
          "value": "creative",
          "label": "设计/创意/媒体",
          "size": "md"
        },
        {
          "value": "medical_education",
          "label": "医生/老师",
          "size": "md"
        },
        {
          "value": "student",
          "label": "学生",
          "size": "lg"
        },
        {
          "value": "freelance",
          "label": "自由职业/创业",
          "size": "md"
        },
        {
          "value": "homemaker",
          "label": "在家/退休",
          "size": "sm"
        }
      ]
    },
    {
      "id": "recipientStyle",
      "title": "TA 平时偏哪种",
      "type": "single",
      "defaultNext": "budget",
      "options": [
        {
          "value": "practical",
          "label": "实用派，喜欢好用的东西",
          "size": "xl"
        },
        {
          "value": "aesthetic",
          "label": "颜值控，喜欢好看的",
          "size": "lg"
        },
        {
          "value": "experiential",
          "label": "体验派，喜欢新鲜感",
          "size": "lg"
        },
        {
          "value": "quality",
          "label": "品质党，在意质感和品牌",
          "size": "md"
        }
      ]
    },
    {
      "id": "budget",
      "title": "大概想花多少",
      "type": "single",
      "defaultNext": "emotionalTags",
      "options": [
        {
          "value": "under_200",
          "label": "200 以内",
          "size": "md"
        },
        {
          "value": "200_500",
          "label": "200-500",
          "size": "xl"
        },
        {
          "value": "500_1000",
          "label": "500-1000",
          "size": "lg"
        },
        {
          "value": "1000_2000",
          "label": "1000-2000",
          "size": "lg"
        },
        {
          "value": "2000_plus",
          "label": "2000 以上",
          "size": "sm"
        }
      ]
    },
    {
      "id": "emotionalTags",
      "title": "想表达什么心意",
      "type": "multi",
      "max": 3,
      "allowCustom": true,
      "defaultNext": "visualStyle",
      "options": [
        {
          "value": "romantic",
          "label": "浪漫表达"
        },
        {
          "value": "company",
          "label": "陪伴感"
        },
        {
          "value": "care",
          "label": "贴心实用"
        },
        {
          "value": "surprise",
          "label": "有惊喜"
        },
        {
          "value": "memory",
          "label": "纪念感"
        },
        {
          "value": "gratitude",
          "label": "感恩感谢"
        },
        {
          "value": "encourage",
          "label": "鼓励打气"
        },
        {
          "value": "healing",
          "label": "治愈解压"
        },
        {
          "value": "playful",
          "label": "有趣好玩"
        },
        {
          "value": "prestige",
          "label": "有面子"
        },
        {
          "value": "sincere",
          "label": "走心用心"
        },
        {
          "value": "ritual",
          "label": "仪式感"
        }
      ]
    },
    {
      "id": "visualStyle",
      "title": "偏好什么风格",
      "type": "multi",
      "max": 3,
      "allowCustom": true,
      "defaultNext": "result",
      "options": [
        {
          "value": "minimal",
          "label": "简洁耐看"
        },
        {
          "value": "warm",
          "label": "温柔治愈"
        },
        {
          "value": "delicate",
          "label": "包装精美"
        },
        {
          "value": "tech",
          "label": "科技感"
        },
        {
          "value": "classic",
          "label": "质感高级"
        },
        {
          "value": "cute",
          "label": "可爱有趣"
        },
        {
          "value": "retro",
          "label": "复古怀旧"
        },
        {
          "value": "natural",
          "label": "自然清新"
        },
        {
          "value": "elegant",
          "label": "优雅气质"
        },
        {
          "value": "festive",
          "label": "节日氛围"
        }
      ]
    }
  ]
};

const QUESTIONS = QUESTIONNAIRE_CONFIG.questions;
const RESULT_NODE = QUESTIONNAIRE_CONFIG.resultNode;
const START_QUESTION_ID = QUESTIONNAIRE_CONFIG.startQuestionId;

module.exports = {
  QUESTIONNAIRE_CONFIG,
  QUESTIONS,
  RESULT_NODE,
  START_QUESTION_ID,
};
