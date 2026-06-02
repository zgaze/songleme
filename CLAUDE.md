# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**送了么 (Songleme)** — a WeChat Mini Program for gift recommendation. Users answer a branching questionnaire (recipient, occasion, budget, emotional intent, visual style) and receive curated gift suggestions.

- **Platform**: Native WeChat Mini Program (no Taro/uni-app)
- **Backend**: Tencent CloudBase (云开发) cloud functions
- **AppID**: `wx43cf0d470eee0883`
- **CloudBase Env**: `zane-d8goe9f34c3d31dec`
- **Base Library**: 3.15.2

## Commands

There is no root `package.json` or CI pipeline. Build/preview/upload happens through **WeChat Developer Tools** (微信开发者工具).

```sh
# Validate questionnaire config (structure, branching, cycles)
node scripts/validate-questionnaire.js

# Validate + regenerate the runtime questionnaire.js
node scripts/validate-questionnaire.js --write-runtime
```

The cloud function has its own dependencies:
```sh
cd cloudfunctions/recommendGift && npm install
```

## Architecture

### Frontend (`miniprogram/`)

4 pages, custom 2-tab layout (Home / My):

- **home** — Minimal landing: brand name + "开始选礼物" button
- **question** — Config-driven branching questionnaire. Supports single-select (auto-advance) and multi-select (manual next, max limit). Per-option branching via `option.next`. Back-navigation prunes stale answers.
- **result** — Calls `recommendGift` cloud function; falls back to `localRecommender.js` on failure. Shows candidates in 2-column `result-card` grid with pairing suggestions.
- **profile** — Placeholder "My" page (preferences, recipients, history — all toast-only currently)

### Questionnaire System

The questionnaire is config-driven. Edit `miniprogram/shared/questionnaire.config.json`, then run the validation script with `--write-runtime` to regenerate `questionnaire.js` (do not edit `questionnaire.js` manually).

Branching flow: `target → scene → (preparationTime if birthday/anniversary) → budget → emotionalTags → visualStyle → result`

Schema: `schemas/questionnaire.schema.json` (JSON Schema draft-07)
Docs: `docs/questionnaire-config.md`, `docs/questionnaire-branching.md`

### Recommendation Engine (dual-layer)

**Cloud function** (`cloudfunctions/recommendGift/`):
1. Hard filter: eliminates gifts mismatching `target`, `budget`, or `preparationTime`
2. Weighted scoring: scene (18), emotionalTags (14), visualStyle (10), target (8), budget (8), preparationTime (8)
3. Returns top 6 candidates; falls back to all gifts if nothing passes filter

**Local fallback** (`miniprogram/shared/localRecommender.js`):
Same logic, different weights (target 24, scene 18, budget 18, preparationTime 18, visualStyle 10, emotionalTags 12). Used when cloud call fails.

Both engines consume the same 6 gift directions data (`giftDirections.js`), kept in sync between `miniprogram/shared/` and `cloudfunctions/recommendGift/data/`.

### Design System

"Matte Clay Aesthetic" — claymorphism with soft pastels, triple-layer shadows, organic border-radius. See `stitch/introduction/DESIGN.md` for full spec.

Colors: primary blue `#30628a`, rose `#ffb0cd`, gold `#fac477`, mint `#b7e4c7`

## Key Files

| File | Purpose |
|------|---------|
| `miniprogram/shared/questionnaire.config.json` | Questionnaire definition (editable) |
| `miniprogram/shared/questionnaire.js` | Generated runtime (do not edit) |
| `miniprogram/shared/giftDirections.js` | Gift data (client copy) |
| `cloudfunctions/recommendGift/data/giftDirections.js` | Gift data (server copy — keep in sync) |
| `cloudfunctions/recommendGift/lib/recommender.js` | Server recommendation engine |
| `miniprogram/shared/localRecommender.js` | Client fallback recommender |
| `docs/superpowers/specs/2026-05-29-gift-miniapp-home-design.md` | Full design spec |

## Conventions

- Vanilla JavaScript, no TypeScript
- WeChat Mini Program APIs (`wx.*`, `wx.cloud.*`)
- Custom tab bar (not the native one) — see `miniprogram/custom-tab-bar/`
- Gift directions data exists in 3 places (client, server, seed) — changes must be synchronized
- The seed data (`data/gift-directions.seed.json`) uses a different field naming convention than the runtime data and is not directly consumed by the app
