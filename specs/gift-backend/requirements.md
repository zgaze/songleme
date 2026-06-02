# Gift Backend Requirements

## Problem

The mini program already has the main question and result experience, but the backend is still a thin recommendation function over static data. The first backend milestone should make recommendations consistent with the current questionnaire, persist enough user activity for "My" features, and leave room for offline gift data operations.

## Scope

In scope:

- Keep CloudBase Event Functions as the backend runtime.
- Use Mini Program native CloudBase identity through `OPENID`.
- Align recommendation inputs with the current questionnaire schema.
- Persist recommendation runs, user feedback, recipient profiles, and user preferences.
- Define database collections, API contracts, and permission boundaries.

Out of scope for the first milestone:

- Real-time LLM recommendation generation.
- Public HTTP APIs.
- Paid product links, checkout, or affiliate tracking.
- Admin CMS UI.
- Heavy model training or CloudRun model serving.

## User Stories

1. As a user, I want the result page to use my current questionnaire answers accurately, so the recommended gifts feel relevant.
2. As a user, I want to see past recommendations, so I can revisit ideas later.
3. As a user, I want to save recipient profiles, so I do not repeat basic information every time.
4. As a user, I want to give lightweight feedback, so future recommendations can improve.
5. As an operator, I want gift data to be structured and versioned, so I can add and review gift directions safely.

## Acceptance Criteria

1. When the result page calls `recommendGift` with the current questionnaire answer IDs, the backend shall normalize the answers before filtering and scoring.
2. When current budget values such as `200_500` or `500_1000` are submitted, the backend shall match existing legacy gift budget tags instead of treating every gift as a budget mismatch.
3. When unsupported or stale answer values are submitted, the backend shall ignore those values without throwing an error.
4. When no gift passes hard filters, the backend shall still return a ranked fallback list.
5. When a recommendation is generated in CloudBase, the backend shall include a stable `runId`, `schemaVersion`, `questionnaireVersion`, and `modelVersion` in metadata.
6. When recommendation persistence is enabled, the backend shall associate each recommendation run with the caller `OPENID` from `cloud.getWXContext()`.
7. When users access history, preferences, recipients, or feedback data, the backend shall only expose records owned by that `OPENID`.
8. When gift data is stored in the database, the backend shall only use `status: "published"` items for user-facing recommendations.

## Business Rules

- The first online recommender remains deterministic and explainable.
- Gift data may start as static JS and later move to CloudBase collections; the recommendation contract should not depend on the storage backend.
- The Mini Program does not need a login page; CloudBase injects user identity for cloud function calls.
- Existing front-end fallback behavior should remain usable if the cloud call fails.
