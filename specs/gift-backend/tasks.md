# Implementation Plan

- [x] 1. Stabilize backend plan
  - Document backend requirements, architecture, data collections, function contracts, and permissions.
  - _Requirement: 1, 5, 7, 8_

- [x] 2. Align recommendation schema with the current questionnaire
  - Add normalization for current answer IDs.
  - Add compatibility for legacy gift budget tags.
  - Add scoring support for `gender`, `occupation`, and `recipientStyle` where data exists or can be derived.
  - _Requirement: 1, 2, 3, 4_

- [x] 3. Add focused recommendation regression checks
  - Cover current budget values.
  - Cover `bestie` and `apology` fallback behavior.
  - Cover stale or unsupported answer values.
  - _Requirement: 1, 2, 3, 4_

- [x] 4. Add recommendation run metadata
  - Generate `runId`.
  - Return `schemaVersion`, `questionnaireVersion`, and `modelVersion`.
  - Keep the result page contract backward compatible.
  - _Requirement: 5_

- [x] 5. Prepare persistence layer
  - Create CloudBase collections.
  - Configure owner-scoped permission rules.
  - Write recommendation runs from `recommendGift`.
  - _Requirement: 6, 7_

- [x] 6. Add user data functions
  - Implement feedback writes.
  - Implement recommendation history reads.
  - Implement recipient profile CRUD.
  - Implement user preference read/write.
  - _Requirement: 2, 3, 4, 7_

- [ ] 7. Deploy and verify
  - [x] Deploy updated functions to `zane-d8goe9f34c3d31dec`.
  - [x] Invoke deployed functions through CloudBase management tooling.
  - [ ] Verify result page calls in WeChat Developer Tools with real Mini Program `OPENID`.
  - [x] Check CloudBase logs for successful management-tool calls and metadata.
  - _Requirement: 1, 5, 6_
