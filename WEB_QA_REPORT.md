# WEB QA REPORT — V4

## Scope
This QA report covers code-level and deterministic-safety checks for the contest prototype. It is **not** an AI accuracy benchmark.

## Automated checks
`node tests.mjs` passes all checks below:

- Home CTA present
- File input UI present
- Free-text analysis lab present
- AI endpoint client wired
- REVIEW blocks calendar save
- `.ics` export path present
- IANA timezone input present
- API key referenced server-side only
- OpenAI Responses API endpoint configured
- Structured Outputs JSON schema configured
- `store:false` configured
- Default model set through environment fallback
- Prompt-injection guard present
- File / image API inputs present
- Text/base64 input size limits present
- Text evidence substring verification present
- Server file extension/MIME allowlist present
- Base64 data URL validation present
- Upstream API timeout present
- Privacy confirmation UI present
- Evidence provenance UI present
- Deterministic safety unit checks pass

## Deterministic safety cases
- Relative rule + explicit timezone → CONFIRMED, 2026-09-23 18:00
- Same rule with timezone missing → REVIEW
- Conflicting clauses → REVIEW
- Explicit directly applicable deadline → DIRECT / CONFIRMED
- Local KST parse → IANA timezone `Asia/Seoul`
- REVIEW or missing IANA timezone → calendar export blocked

## Not yet validated
- Live OpenAI API response quality
- Real PDF/image extraction quality
- Human-verified Wrong Confirm / Coverage / Abstention metrics
- Cross-browser visual QA on deployed URL
- Production abuse/rate-limiting behavior

These items must not be described as completed performance evidence before live deployment and human review.
