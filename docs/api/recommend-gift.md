# recommendGift 云函数

## 入参

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
