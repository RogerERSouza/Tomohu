# Feature: <name>

Status: Draft

Baseline: <commit and current behavior>

Delivery: <planned version or unassigned; implementation commit/PR when available>

## Outcome and scope

Describe who benefits and the observable result.

- In scope:
- Out of scope:

## Requirements and invariants

Use stable IDs such as `R1`. Include data compatibility, ownership, security, accessibility and failure/recovery requirements where relevant. Separate agreed requirements from proposed defaults.

## Acceptance scenarios

| ID  | Given / When               | Expected observable result | Verification                       |
| --- | -------------------------- | -------------------------- | ---------------------------------- |
| AC1 | <initial state and action> | <measurable outcome>       | <planned test or manual procedure> |

Include first use, existing data, invalid input, interrupted operations and repeated actions when relevant. Add explicit boundaries so tests cannot pass through an unrelated fallback.

## Decisions and open questions

- Agreed decisions:
- Proposed defaults and rationale:
- Material unresolved questions and the work they block:

## Implementation plan

List affected modules and responsibilities, contract/storage changes, dependencies, security implications and migration/recovery strategy. Link ADRs instead of duplicating them. State when no migration is required.

## Tasks

- [ ] Establish acceptance/regression coverage.
- [ ] Implement the scoped behavior.
- [ ] Review compatibility, failure paths and UI where applicable.
- [ ] Run required checks and record evidence.
- [ ] Review the complete diff and reconcile documentation.

## Validation evidence

Implementation commit/environment: Not implemented.

| Criterion/check | Test or procedure | Result  | Evidence/limitations |
| --------------- | ----------------- | ------- | -------------------- |
| AC1             | Not selected      | Not run | Specification only   |

## Delivery and remaining limitations

Record implemented behavior, known limitations, checks not executed and commit/PR/merge status. Keep planned checks separate from executed results.
