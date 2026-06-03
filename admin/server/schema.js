"use strict";

/**
 * 字段契约的唯一来源 = schemas/gift-direction.schema.json。
 *
 * 这里实现一个 JSON-Schema (draft-07) 的子集校验器，只覆盖该 schema 实际用到的
 * 关键字（type/enum/const/required/properties/additionalProperties/items/
 * minItems/maxItems/minLength/maxLength/pattern/allOf/if-then-else/contains/not/$ref）。
 *
 * 为什么不用 ajv：保持「零运行时依赖」——`npm i` 不需要联网，断网全程可用，
 * 也不引入供应链。校验规则全部由 schema 文件驱动，schema 改了校验就跟着改。
 */

const fs = require("fs");
const path = require("path");

const SCHEMA_PATH = path.resolve(__dirname, "../../schemas/gift-direction.schema.json");

let cachedSchema = null;

function loadSchema() {
  if (!cachedSchema) {
    cachedSchema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
  }
  return cachedSchema;
}

/** 测试用：清掉缓存（理论上 schema 不变，留个口子） */
function _resetSchemaCache() {
  cachedSchema = null;
}

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value; // "string" | "number" | "boolean" | "object" | "undefined"
}

function matchesType(value, type) {
  const t = typeOf(value);
  if (type === "integer") return t === "number" && Number.isInteger(value);
  return t === type;
}

/** 解析本地 $ref（仅支持 "#/definitions/xxx" 形式，schema 里只用到这种） */
function resolveRef(ref, root) {
  if (!ref.startsWith("#/")) {
    throw new Error(`unsupported $ref: ${ref}`);
  }
  const parts = ref.slice(2).split("/");
  let node = root;
  for (const p of parts) {
    node = node && node[p];
  }
  if (node === undefined) throw new Error(`$ref not found: ${ref}`);
  return node;
}

/**
 * 校验 value 是否满足 subSchema。把错误信息推进 errors 数组（带 instancePath）。
 * 返回 true/false。
 */
function validateNode(value, subSchema, root, instancePath, errors) {
  if (subSchema === true) return true;
  if (subSchema === false) {
    errors.push(`${instancePath || "(root)"}: 不允许出现该值`);
    return false;
  }

  if (subSchema.$ref) {
    return validateNode(value, resolveRef(subSchema.$ref, root), root, instancePath, errors);
  }

  let ok = true;

  // type
  if (subSchema.type !== undefined) {
    const types = Array.isArray(subSchema.type) ? subSchema.type : [subSchema.type];
    if (!types.some((t) => matchesType(value, t))) {
      errors.push(`${instancePath || "(root)"}: 类型应为 ${types.join("|")}，实际为 ${typeOf(value)}`);
      ok = false;
    }
  }

  // const
  if (Object.prototype.hasOwnProperty.call(subSchema, "const")) {
    if (value !== subSchema.const) {
      errors.push(`${instancePath}: 应等于常量 ${JSON.stringify(subSchema.const)}`);
      ok = false;
    }
  }

  // enum
  if (subSchema.enum) {
    if (!subSchema.enum.includes(value)) {
      errors.push(`${instancePath}: 非法枚举值 ${JSON.stringify(value)}，允许：${subSchema.enum.join(", ")}`);
      ok = false;
    }
  }

  // string constraints
  if (typeof value === "string") {
    if (subSchema.minLength !== undefined && value.length < subSchema.minLength) {
      errors.push(`${instancePath}: 字符串过短（最少 ${subSchema.minLength}，实际 ${value.length}）`);
      ok = false;
    }
    if (subSchema.maxLength !== undefined && value.length > subSchema.maxLength) {
      errors.push(`${instancePath}: 字符串过长（最多 ${subSchema.maxLength}，实际 ${value.length}）`);
      ok = false;
    }
    if (subSchema.pattern !== undefined && !new RegExp(subSchema.pattern).test(value)) {
      errors.push(`${instancePath}: 不符合格式 /${subSchema.pattern}/`);
      ok = false;
    }
  }

  // array constraints
  if (Array.isArray(value)) {
    if (subSchema.minItems !== undefined && value.length < subSchema.minItems) {
      errors.push(`${instancePath}: 数组元素过少（最少 ${subSchema.minItems}，实际 ${value.length}）`);
      ok = false;
    }
    if (subSchema.maxItems !== undefined && value.length > subSchema.maxItems) {
      errors.push(`${instancePath}: 数组元素过多（最多 ${subSchema.maxItems}，实际 ${value.length}）`);
      ok = false;
    }
    if (subSchema.items) {
      value.forEach((item, i) => {
        if (!validateNode(item, subSchema.items, root, `${instancePath}[${i}]`, errors)) ok = false;
      });
    }
    if (subSchema.contains) {
      const hit = value.some((item) => validateNode(item, subSchema.contains, root, "", []));
      if (!hit) {
        errors.push(`${instancePath}: 数组未包含满足约束的元素`);
        ok = false;
      }
    }
  }

  // object constraints
  if (value && typeof value === "object" && !Array.isArray(value)) {
    if (subSchema.required) {
      for (const key of subSchema.required) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) {
          errors.push(`${instancePath}: 缺少必填字段 "${key}"`);
          ok = false;
        }
      }
    }
    if (subSchema.properties) {
      for (const [key, propSchema] of Object.entries(subSchema.properties)) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          if (!validateNode(value[key], propSchema, root, `${instancePath}.${key}`, errors)) ok = false;
        }
      }
    }
    if (subSchema.additionalProperties === false) {
      const allowed = new Set(Object.keys(subSchema.properties || {}));
      for (const key of Object.keys(value)) {
        if (!allowed.has(key)) {
          errors.push(`${instancePath}.${key}: 不允许的额外字段`);
          ok = false;
        }
      }
    }
  }

  // not
  if (subSchema.not) {
    const sub = [];
    if (validateNode(value, subSchema.not, root, instancePath, sub)) {
      errors.push(`${instancePath}: 不应满足 "not" 约束`);
      ok = false;
    }
  }

  // allOf
  if (subSchema.allOf) {
    for (const sub of subSchema.allOf) {
      if (!validateNode(value, sub, root, instancePath, errors)) ok = false;
    }
  }

  // if / then / else
  if (subSchema.if) {
    const condErrors = [];
    const condOk = validateNode(value, subSchema.if, root, instancePath, condErrors);
    if (condOk && subSchema.then) {
      if (!validateNode(value, subSchema.then, root, instancePath, errors)) ok = false;
    } else if (!condOk && subSchema.else) {
      if (!validateNode(value, subSchema.else, root, instancePath, errors)) ok = false;
    }
  }

  return ok;
}

/**
 * 校验一条 GiftDirection（应当是已剥离 _* 元字段的纯 v3 对象）。
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validate(obj) {
  const root = loadSchema();
  const errors = [];
  const valid = validateNode(obj, root, root, "", errors);
  return { valid, errors };
}

/** 元字段前缀：catalog 用 _status/_source/_updatedAt/_note，导出/校验前剥离 */
const META_PREFIX = "_";

/** 返回剥离了所有 `_*` 元字段的浅拷贝（不改原对象） */
function stripMeta(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!k.startsWith(META_PREFIX)) out[k] = v;
  }
  return out;
}

/**
 * 给前端表单用：从 schema 抽出每个字段的枚举选项与基本形态。
 * 返回 { fields: [{ key, kind: 'enum'|'enumArray'|'string'|'boolean'|'stringArray', options?, required }] }
 */
function formMeta() {
  const root = loadSchema();
  const required = new Set(root.required || []);
  const fields = [];

  const enumOf = (node) => {
    if (!node) return null;
    if (node.enum) return node.enum;
    if (node.$ref) return enumOf(resolveRef(node.$ref, root));
    return null;
  };

  for (const [key, prop] of Object.entries(root.properties)) {
    let kind;
    let options = null;
    if (prop.$ref) {
      const opts = enumOf(prop);
      kind = opts ? "enum" : "string";
      options = opts;
    } else if (prop.type === "array") {
      const opts = enumOf(prop.items);
      kind = opts ? "enumArray" : "stringArray";
      options = opts;
    } else if (prop.type === "boolean") {
      kind = "boolean";
    } else {
      kind = "string";
    }
    fields.push({
      key,
      kind,
      options,
      required: required.has(key),
      minItems: prop.minItems,
      maxItems: prop.maxItems,
      maxLength: prop.maxLength,
      minLength: prop.minLength,
    });
  }
  return { fields, required: [...required] };
}

module.exports = {
  SCHEMA_PATH,
  loadSchema,
  validate,
  stripMeta,
  formMeta,
  _resetSchemaCache,
};
