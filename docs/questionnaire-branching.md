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
