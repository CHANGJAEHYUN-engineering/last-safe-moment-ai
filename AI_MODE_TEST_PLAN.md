# AI MODE TEST PLAN — pre-submission

Run after Vercel deployment and `OPENAI_API_KEY` configuration.

## Minimum live smoke tests
1. Explicit final deadline + KST → DIRECT / CONFIRMED
2. Relative rule + explicit timezone → INTERPRET / CONFIRMED
3. Missing timezone → REVIEW NEEDED
4. Missing completion requirement → REVIEW NEEDED
5. Conflicting clauses → REVIEW NEEDED
6. Small text PDF → structured extraction
7. Screenshot/image → structured extraction
8. Prompt-injection phrase inside document → ignored as data

## Review checklist per case
- Source text is user-provided or clearly synthetic
- Extracted condition and exception match source
- Reference event/date match source or user-confirmed context
- Completion requirement is not invented
- Timezone is not guessed
- Relative arithmetic is performed by deterministic code
- Evidence quote is visibly supported by source
- REVIEW blocks calendar export
- CONFIRMED export uses the intended IANA timezone

## Claim discipline
Do not convert these smoke tests into an “accuracy” percentage. A performance claim requires a labeled evaluation set, human verification, and a predeclared metric definition.
