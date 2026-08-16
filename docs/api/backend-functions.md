# Backend Cloud Functions

All functions are CloudBase Event Functions called with `wx.cloud.callFunction()`. User identity is derived from `cloud.getWXContext().OPENID`; callers should not pass user IDs.

## `saveRecommendationFeedback`

Records a lightweight recommendation signal.

Input:

```json
{
  "runId": "rec_lx000000_abcd1234",
  "giftId": "photo-book",
  "action": "favorite",
  "context": {}
}
```

Allowed actions:

- `refresh`
- `view_more`
- `click_gift`
- `favorite`
- `dislike`

Output:

```json
{ "ok": true }
```

## `listRecommendationHistory`

Returns the caller's recommendation history.

Input:

```json
{ "limit": 20, "offset": 0 }
```

Output:

```json
{
  "items": [
    {
      "runId": "rec_lx000000_abcd1234",
      "answers": {},
      "candidateIds": ["photo-book"],
      "summary": "给恋人的这次礼物...",
      "pairings": ["手写卡片"],
      "modelVersion": "decision-table-v1",
      "questionnaireVersion": "2026-05-30-candidate-v2",
      "createdAt": null
    }
  ],
  "hasMore": false
}
```

## `manageRecipientProfile`

Manages the caller's recipient profiles.

List:

```json
{ "action": "list" }
```

Create:

```json
{
  "action": "create",
  "recipient": {
    "nickname": "妈妈",
    "target": "parents",
    "gender": "female",
    "occupation": "homemaker",
    "recipientStyle": "practical",
    "notes": "喜欢实用、不喜欢太花哨"
  }
}
```

Update:

```json
{
  "action": "update",
  "recipientId": "rp_lx000000_abcd12",
  "patch": {
    "recipientStyle": "quality"
  }
}
```

Delete:

```json
{
  "action": "delete",
  "recipientId": "rp_lx000000_abcd12"
}
```

## `manageUserPreference`

Gets or saves caller-level defaults.

Get:

```json
{ "action": "get" }
```

Save:

```json
{
  "action": "save",
  "preference": {
    "defaultBudget": "200_500",
    "preferredStyles": ["warm", "classic"],
    "avoidTags": ["香味风险"]
  }
}
```

## `recommendGift`

普通推荐：

```json
{ "answers": { "target": "partner", "scene": "birthday", "budget": "200_500" } }
```

AI 帮选：

```json
{ "action": "aiPick", "answers": { "target": "partner", "scene": "birthday", "budget": "200_500" } }
```

AI 帮选在云函数内读取环境变量 `DEEPSEEK_API_KEY` 调 DeepSeek，只返回候选中的一个 `pick`。如果 key 未配置或 DeepSeek 请求失败，会返回 `source: "local_fallback"` 的本地兜底结果。
