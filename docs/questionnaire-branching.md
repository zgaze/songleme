# 问卷分支配置

小程序问答流程由 `miniprogram/shared/questionnaire.config.json` 配置。

使用和校验方式见 `docs/questionnaire-config.md`。

## 基本字段

```js
{
  id: "scene",
  title: "这次是什么场景",
  type: "single",
  defaultNext: "budget",
  options: [
    { value: "birthday", label: "生日", next: "preparationTime" },
    { value: "daily", label: "日常关心", next: "budget" }
  ]
}
```

- `id`：题目唯一标识，会进入最终答案。
- `type`：`single` 单选，选中后自动进入下一题；`multi` 多选，需要点击下一步。
- `defaultNext`：默认下一题 ID。
- `option.next`：单选项级别的下一题，会覆盖 `defaultNext`。
- `max`：可选，只对多选生效；不写则不限数量。
- `size`：可选，控制选项气球大小，支持 `xl` / `lg` / `md` / `sm`；不写时页面会按选项数量自动分配。

## 当前分支

```text
target -> scene

scene=生日/纪念日 -> preparationTime -> budget
scene=节日/日常关心 -> budget

budget -> emotionalTags -> visualStyle -> result
```

如果用户回到前面改答案，已经跳过的分支答案会自动从结果 payload 中移除。例如先选生日填写了时间，再回到场景改成日常关心，最终答案里不会保留 `preparationTime`。

`emotionalTags`（想表达什么心意）与 `visualStyle`（偏好什么风格）均为多选题（`max: 3`），并开启 `allowCustom`，用户可通过「＋自定义」输入自由文本标签；自定义值会随答案进入推荐请求，由推荐引擎做子串软匹配。

从联系人选择进入问卷时，主页会带上 `prefill`（部分答案对象）与 `skip`（CSV，固定 `target,gender,occupation,recipientStyle`）两个 query 参数：问卷页据此预置身份题答案、从第一道未跳过题（通常是 `scene`）开始，返回上一题不会回到被跳过的身份题，最终答案仍包含被预填的字段。无参数进入则走完整问卷，行为不变。
