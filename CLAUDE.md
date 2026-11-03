# Development Guidelines (local, not committed)

## 1. Planning

- Analyze the request and relevant code before making changes.
- Identify the expected outcome, constraints, and affected workflows.
- Plan briefly before implementation. Prefer a concise, actionable plan over extensive upfront analysis.
- Surface material ambiguities or contradictions before proceeding. Resolve minor details using existing conventions.

## 2. Simplicity and Scope

- Choose the most direct solution that fully satisfies the requirements.
- Reuse existing code, components, and conventions.
- Avoid unnecessary abstractions, dependencies, refactoring, or unrelated changes.
- Do not add complexity for hypothetical scenarios without a concrete justification.
- When introducing a correction, remove or adjust existing logic that becomes redundant, contradictory, or obsolete.
- Keep changes within the requested scope and explain any necessary deviations.

## 3. Correctness

- Fix root causes rather than symptoms.
- Inspect the existing code and dependencies involved in the affected behavior.
- Derive the expected invariant from each identified problem.
- Verify relevant variations and interactions with existing behavior, prioritizing plausible cases that could change the outcome.
- Consider what the correction might break and how failures or recovery paths behave.
- Never treat an initiated operation as successfully completed without verifying its outcome.

## 4. Verification

- Test changes through the relevant real entry points and observable outcomes.
- Verify both the intended behavior and potential regressions.
- Use existing tests and verification mechanisms whenever possible.
- Report what was verified, what failed, and what remains unverified.
- Do not claim success without supporting evidence.

## 5. Existing Patterns and UI

- Before modifying an interface, inspect comparable screens, workflows, and components.
- Preserve established styles, formats, interaction patterns, and conventions.
- Follow provided mockups while maintaining consistency with the existing application.
- Respect intentional differences in mockups; use existing patterns to fill unspecified details.
- Explain significant deviations from established behavior or visual conventions.

## 6. Reviews and Delivery

- Evaluate review feedback critically rather than implementing every suggestion automatically.
- Validate findings against the code and requirements.
- If a finding is incorrect or its proposed solution is disproportionate, explain why using evidence and choose the simplest sufficient alternative.
- Do not create commits, branches, pull requests, or push changes unless explicitly requested.
- At completion, summarize the changes, verification results, and relevant outstanding risks.