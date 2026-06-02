"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { validate, stripMeta, formMeta } = require("./schema");

/** 一条最小合法 v3 方向（只含硬必填 + 几个软字段） */
function legalDirection(overrides = {}) {
  return {
    id: "counter-lipstick-gift-box",
    name: "专柜口红礼盒",
    category: "beauty_personal_care",
    target: ["partner", "bestie"],
    scene: ["birthday", "festival"],
    budget: ["200_500"],
    recommendReason: "包装体面有仪式感，适合表达审美与用心。",
    toneFit: ["romantic", "surprise"],
    searchKeywords: ["口红礼盒", "YSL 口红套装"],
    ...overrides,
  };
}

test("合法对象通过校验", () => {
  const { valid, errors } = validate(legalDirection());
  assert.equal(valid, true, errors.join("\n"));
});

test("缺硬必填字段被拒（删掉 category）", () => {
  const obj = legalDirection();
  delete obj.category;
  const { valid, errors } = validate(obj);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("category")), errors.join("\n"));
});

test("非法枚举被拒：budget 填旧值 100_300", () => {
  const { valid, errors } = validate(legalDirection({ budget: ["100_300"] }));
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("100_300")), errors.join("\n"));
});

test("非法枚举被拒：category 非法值", () => {
  const { valid } = validate(legalDirection({ category: "not_a_category" }));
  assert.equal(valid, false);
});

test("安全规则：romantic + apology 被拒", () => {
  const { valid, errors } = validate(
    legalDirection({ toneFit: ["romantic"], scene: ["apology", "daily"] })
  );
  assert.equal(valid, false, "romantic 不应允许出现在 apology 场景");
  assert.ok(errors.length > 0);
});

test("安全规则：非 romantic 时 apology 合法", () => {
  const { valid, errors } = validate(
    legalDirection({ toneFit: ["sincere"], scene: ["apology", "daily"] })
  );
  assert.equal(valid, true, errors.join("\n"));
});

test("additionalProperties:false —— 残留的 _* 元字段会被拒（证明导出/保存前必须剥离）", () => {
  const withMeta = { ...legalDirection(), _status: "approved", _source: "deepseek" };
  const { valid } = validate(withMeta);
  assert.equal(valid, false);
});

test("stripMeta 去掉 _* 字段后即合法", () => {
  const withMeta = {
    ...legalDirection(),
    _status: "approved",
    _source: "deepseek",
    _updatedAt: "2026-06-03T00:00:00.000Z",
    _note: "ok",
  };
  const clean = stripMeta(withMeta);
  assert.ok(!("_status" in clean));
  assert.ok(!("_note" in clean));
  assert.equal(clean.id, withMeta.id);
  const { valid, errors } = validate(clean);
  assert.equal(valid, true, errors.join("\n"));
});

test("name 长度约束（minLength 2 / maxLength 24）", () => {
  assert.equal(validate(legalDirection({ name: "x" })).valid, false);
  assert.equal(validate(legalDirection({ name: "好礼" })).valid, true);
});

test("id 必须 kebab-case", () => {
  assert.equal(validate(legalDirection({ id: "Bad_ID" })).valid, false);
  assert.equal(validate(legalDirection({ id: "good-id-123" })).valid, true);
});

test("formMeta 暴露枚举供前端表单使用", () => {
  const { fields, required } = formMeta();
  const byKey = Object.fromEntries(fields.map((f) => [f.key, f]));
  assert.ok(required.includes("name") && required.includes("category"));
  assert.equal(byKey.category.kind, "enum");
  assert.ok(byKey.category.options.includes("beauty_personal_care"));
  assert.equal(byKey.target.kind, "enumArray");
  assert.deepEqual(byKey.budget.options, [
    "under_200",
    "200_500",
    "500_1000",
    "1000_2000",
    "2000_plus",
  ]);
  assert.equal(byKey.searchKeywords.kind, "stringArray");
  assert.equal(byKey.requiresKnownPreference.kind, "boolean");
});
