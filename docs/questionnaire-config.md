# 问卷配置使用说明

题库的人工/AI 编辑入口是：

```text
miniprogram/shared/questionnaire.config.json
```

小程序运行时读取的是：

```text
miniprogram/shared/questionnaire.js
```

`questionnaire.js` 是生成文件，不要手改。编辑 JSON 后运行校验脚本，脚本会验证配置并同步生成运行时文件。

## 常用命令

只校验：

```sh
node scripts/validate-questionnaire.js
```

校验并同步生成小程序运行文件：

```sh
node scripts/validate-questionnaire.js --write-runtime
```

## 配置结构

```json
{
  "version": "2026-05-30-local-v1",
  "startQuestionId": "target",
  "resultNode": "result",
  "questions": []
}
```

- `version`：题库版本，方便以后追踪。
- `startQuestionId`：问卷起点题目 ID。
- `resultNode`：结果节点名称，默认用 `result`。
- `questions`：题目数组。

## 题目字段

```json
{
  "id": "scene",
  "title": "这次是什么场景",
  "type": "single",
  "defaultNext": "budget",
  "options": []
}
```

- `id`：题目唯一 ID，只能使用字母、数字、下划线，且以字母开头。
- `title`：页面显示的问题。
- `type`：`single` 或 `multi`。
- `defaultNext`：默认下一题 ID，也可以是 `result`。
- `max`：可选，只对多选题生效；不写则不限选择数量。
- `options`：选项数组。

## 选项字段

```json
{
  "value": "birthday",
  "label": "生日",
  "size": "xl",
  "next": "preparationTime"
}
```

- `value`：答案值，会进入最终推荐请求。
- `label`：页面显示文字。
- `size`：可选，气球大小：`xl` / `lg` / `md` / `sm`；不写则页面自动分配。
- `next`：可选，只建议用于单选题，表示选中该选项后跳到哪一题。
- `min` / `max`：可选，适合预算类选项。

## 分支规则

单选题：

- 优先走 `option.next`
- 如果选项没有 `next`，走题目的 `defaultNext`
- 如果都没有，进入 `result`

多选题：

- 只走题目的 `defaultNext`
- 选项上的 `next` 不生效，校验脚本会报错

## 校验内容

脚本会检查：

- JSON 是否能解析
- 题目 ID 是否唯一
- 起点是否存在
- `defaultNext` / `option.next` 是否指向真实题目或 `result`
- 是否存在循环
- 是否至少有一条路径到结果页
- 多选 `max` 是否超过选项数量
- 选项 `value` 是否重复
- `size` 是否只使用 `xl` / `lg` / `md` / `sm`
- 运行时 `questionnaire.js` 是否与 JSON 同步

## 推荐编辑流程

1. 修改 `miniprogram/shared/questionnaire.config.json`
2. 运行 `node scripts/validate-questionnaire.js --write-runtime`
3. 在微信开发者工具里重新编译
4. 如果只是检查是否同步，运行 `node scripts/validate-questionnaire.js`
