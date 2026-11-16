# Specification-driven workflow

## Purpose and authority

Use explicit behavior and evidence to guide AI-assisted changes. This process reduces ambiguity; it does not guarantee defect-free software.

- `AGENTS.md` defines project-wide engineering rules.
- `ROADMAP.md` records priorities and delivery status.
- `docs/specs/<feature>.md` defines feature behavior, scope, acceptance scenarios, the implementation plan and validation evidence.
- `docs/architecture/` records significant architecture decisions and their trade-offs.
- `docs/versions/` explains delivered behavior, migration and recovery instructions.

Do not copy the same rule into every document. Link to its authoritative location. Repository files and observed behavior take precedence over assumptions about the current implementation. When behavior contradicts an agreed requirement, report the mismatch and fix or explicitly revise the requirement; do not silently rewrite it to match the code.

## Scale the process to the change

Use the [feature template](../specs/_template.md) for new user flows, schema/storage changes, security-sensitive work and changes crossing feature boundaries. Keep specification, plan and tasks together unless their size justifies separate files.

For a small copy/style fix, a concise problem statement, expected result and appropriate validation in the change description are enough. For a bug, capture a concrete reproduction and add a regression test when behavior or data integrity warrants one. Do not generate ceremonial documents or tests that merely repeat implementation details.

## Delivery loop

1. **Inspect:** read `AGENTS.md`, `ROADMAP.md`, affected modules, contracts, styles, storage and existing tests. Record the baseline commit and the current behavior. Do not infer feature completeness from checked roadmap boxes alone.
2. **Specify:** state the user outcome, in/out of scope, data/security rules, failure/recovery behavior and measurable acceptance criteria with stable IDs. Describe observable behavior before implementation choices. Record unresolved questions and distinguish user decisions from proposed defaults.
3. **Plan:** identify responsible modules and boundaries, dependencies, migration/rollback consequences, meaningful tests and small implementation tasks. Use an ADR for significant architecture/security decisions. Resolve consequential unknowns before dependent work; routine implementation decisions do not require repeated permission.
4. **Implement:** work in a temporary branch. For critical business rules and reproduced bugs, write a failing test first where practical, confirm it fails for the intended reason, then implement the smallest correction and refactor with tests passing. Do not weaken an assertion merely to make the implementation pass.
5. **Validate:** map every acceptance criterion to automated or manual evidence. Run the checks required by `AGENTS.md` for the affected code. Exercise meaningful failure paths, compatibility and recovery, including desktop/mobile when UI changes. Keep tests tied to observable outcomes rather than component structure.
6. **Review and deliver:** inspect the complete diff for scope, dead code, dependencies, accessibility and data preservation. Reconcile code, specification and evidence. Validate a delivered patch against its declared baseline. Report remaining limitations and checks that could not run. Commit/PR/merge follow the existing Git workflow and user authorization.

If validation exposes a bug, return to the responsible step and repeat the affected checks. A passing existing suite does not replace testing new acceptance criteria. Never mark work complete from a plan or a test that was not executed. Avoid endless speculative review: finish when agreed criteria pass and no confirmed blocking defect remains; list residual risks honestly.

## States and evidence

Use `Draft`, `Ready`, `In progress` and `Delivered` in a feature specification.

- **Draft:** behavior or consequential decisions are incomplete; independent research may continue.
- **Ready:** scope, acceptance scenarios, implementation approach and material decisions are clear enough to implement. This is a readiness statement, not a mandatory approval ceremony.
- **In progress:** implementation and validation are underway; discoveries update the specification explicitly.
- **Delivered:** acceptance evidence is recorded, required checks passed and limitations are stated. Record the relevant commit/PR; distinguish local validation from merged/released status.

For each criterion, record a test path/name or manual procedure, the actual outcome and environment/commit. Use `Not run` for unexecuted checks and explain why. Record the observed failure for test-first work when available. Do not invent coverage or claim that mock tests replace real API/database verification.

Keep delivered specs accurate when their behavior changes. Historical validation remains tied to its original commit; newer claims require newer evidence.

## Applying this to Tomohu

The [mandatory-account draft](../specs/mandatory-accounts.md) is the first example. It records the requested login gate while keeping session architecture and legacy-data migration decisions explicit. It does not authorize bundling settings navigation or custom card ordering into the same implementation.

No external toolkit or runtime dependency is required. Consider tooling only when it solves a concrete maintenance problem in this workflow.
