# recommendGift 云函数

## 入参

普通推荐：

```json
{
  "answers": {
    "target": "partner",
    "gender": "female",
    "scene": "birthday",
    "occupation": "creative",
    "recipientStyle": "aesthetic",
    "budget": "200_500"
  }
}
```

云函数会兼容旧预算值，例如 `100_300` 会被归一化到 `under_200` / `200_500`。

AI 帮选：

```json
{
  "action": "aiPick",
  "answers": {
    "target": "partner",
    "scene": "birthday",
    "budget": "200_500"
  }
}
```

`action: "aiPick"` 会在云函数内按当前答案先生成候选，再使用 `DEEPSEEK_API_KEY` 调 DeepSeek 从候选里挑 1 个。未配置 key 或请求失败时，会返回本地兜底选择。

## 出参

```json
{
  "summary": "这次更适合选低压力、能说清心意、风险可控的礼物。",
  "boundaryNote": "已优先避开过度贵重和准备周期不匹配的选择。",
  "candidates": [
    {
      "id": "same-day-flowers-dessert",
      "name": "鲜花甜品组合",
      "highlights": ["当天送", "仪式感"],
      "riskTags": ["看审美"],
      "pairingTags": ["卡片", "晚餐"],
      "recommendReason": "适合当天制造心意感，轻巧但不敷衍。"
    }
  ],
  "pairings": ["礼物 + 手写卡片：表达更完整"],
  "meta": {
    "runId": "rec_lx000000_abcd1234",
    "userScoped": true,
    "schemaVersion": "gift-backend-v1",
    "questionnaireVersion": "2026-05-30-candidate-v2",
    "modelVersion": "decision-table-v1",
    "persistence": {
      "saved": true
    }
  }
}
```

AI 帮选出参：

```json
{
  "ok": true,
  "pick": {
    "source": "deepseek",
    "giftId": "photo-book",
    "giftName": "定制照片书",
    "headline": "AI更推荐这款",
    "reason": "它更适合纪念日表达回忆感，预算和关系边界也更稳。",
    "pairingText": "手写卡片",
    "tips": ["确认照片", "预留制作期"]
  }
}
```
