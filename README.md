# 送了么

送礼推荐微信小程序，第一期采用原生小程序 + CloudBase 云函数。

## 项目结构

- `miniprogram/`：微信小程序前端源码
- `miniprogram/shared/`：小程序端公共枚举、问卷配置、本地兜底推荐
- `cloudfunctions/`：CloudBase 云函数
- `data/`：离线建库种子数据
- `docs/`：产品方案与接口说明
- `schemas/`：本地配置格式说明
- `scripts/`：本地校验与同步脚本

## 开发方式

Codex 负责代码编辑、结构整理和云端资源操作；微信开发者工具负责小程序编译预览、真机调试、上传体验版和提交审核。

根目录的 `project.config.json` 是微信小程序工具链识别项目所需的配置，已经写入 AppID：

```text
wx43cf0d470eee0883
```

当前 CloudBase 环境：

```text
zane-d8goe9f34c3d31dec
```

## 问卷配置

题库编辑入口是 `miniprogram/shared/questionnaire.config.json`。

编辑后运行：

```sh
node scripts/validate-questionnaire.js --write-runtime
```

详细说明见 `docs/questionnaire-config.md`。

## 攻略内容

攻略内容入口是 `miniprogram/shared/guideContent.js`，页面按结构化 blocks 渲染，不直接渲染 HTML。

编辑后运行：

```sh
node scripts/validate-guide-content.js
```

详细说明见 `docs/guide-tips-config.md`。

后端函数说明见 `docs/api/recommend-gift.md` 和 `docs/api/backend-functions.md`。

## 推荐检查

修改推荐规则或礼物数据后运行：

```sh
node scripts/check-recommender.js
```
