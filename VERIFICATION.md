# MVP verification — October 28, 2026

- 20 Vitest domain tests passed. Tests were written before the domain implementation; the first run failed on the missing module.
- Both browser and Worker TypeScript configurations passed.
- Vite production build and Wrangler deployment passed.
- Local and deployed HTTP smoke tests passed: create/join, unauthorized dashboard rejection, answer redaction, concurrent retry deduplication, conflicting request rejection, equivalent correct answer, labeled simulation, close, immutable repeated report, and late-write rejection.
- TLC v2.19 (pinned TLA+ distribution v1.7.4) explored 913 generated / 240 distinct states with no invariant or temporal-property violations. This validates the finite abstract model, not the full runtime or pending integrations.
- Chrome checks on the deployed site: room creation, seat join, actual wrong-answer hint, correct-answer advancement, live dashboard update, labeled simulated students, pause simulation, and student layout at 390 × 844. Viewport reset after verification.
- Full dashboard capture: `artifacts/mvp-dashboard.jpg`.
- No partner API calls, emails, calendar writes, or hackathon submissions were made. All four integration statuses remain pending.

Future work and validation obligations are in `IMPLEMENTATION_PLAN.md`. This file records performed checks, not a claim of production readiness.

## Student support update

- 22 domain tests now pass, including message ownership, retry deduplication, closed-period behavior, handoff inclusion, tutor scope isolation, and per-seat request pacing.
- Deployed HTTP smoke checks cover message delivery/retry, unauthorized message/tutor requests, message inclusion in the handoff, and the tutor's missing-credentials response.
- Parasail chat is implemented behind server-side key/model configuration, but has not been exercised against the real provider without credentials. The existing TLA+ model does not cover the new message queue or provider requests; these have runtime checks and tests.

## You.com video search update

- 25 tests pass, including three video-search contract tests: You.com endpoint/auth/body, safe YouTube URL filtering and canonicalization, deduplication, empty results, malformed responses, and throttling.
- The video-search route authenticates the teacher capability before making a provider request. Search returns only YouTube video watch links, not arbitrary web results. Missing credentials produce an explicit unavailable state with a direct YouTube fallback.
- Real You.com searches remain unverified until `YDC_API_KEY` is supplied. No fixture results are shown as live search results.

## Credentials connected

The owner supplied keys in ignored `.env.local`. `YOU_API_KEY` was mapped to the runtime's `YDC_API_KEY`; a matching ignored `.dev.vars` was created with owner-only file permissions. YDC and Parasail values were installed as Cloudflare Worker secrets without printing their values. `parasail-glm-53-flash` was selected after confirming it appears in the live model catalog.

Live deployed checks now passed: You.com returned six normalized YouTube videos, and Parasail returned a short guiding response to a synthetic fraction question. These checks supersede the earlier credential-blocked status for video search and direct student help. Grounded prep, automatic model grading, embeddings, CrewAI, and One delivery remain unfinished.

## Conversation layout update

- 26 tests and both TypeScript checks pass. The added test validates bounded follow-up history and rejects injected message roles.
- Tutor output now appears in a labeled conversation above the composer. The thread has a capped scrolling height on phones; the input is cleared on send and restored if a request fails. Drafts typed while waiting are preserved.
- Tutor requests include at most four prior turns, each bounded to 600 characters; no other seat's history is fetched. The model is instructed to keep replies within 70 words and one next step. This word count is a prompt constraint, not a formal guarantee.
- Deployed Chrome QA at 390 × 844 verified a real Parasail reply above the composer. The conversation stays in the current page session rather than being saved to the room or handoff.
- A live follow-up initially failed; the response budget was restored to 400 tokens and the request deadline extended to 30 seconds. Retrying then returned a contextual answer referring to the prior exchange. The failed request restored the draft, and the successful retry displayed above the composer. Capture: `artifacts/student-conversation.jpg`.

## Fraction-bar lesson

- 28 tests pass. New tests require both equivalent fractions before combining, prevent regrouping before the combine step, and check back/reset behavior.
- Browser QA at 390 × 844 exercised the deployed first-question lesson: equal-length thirds/fourths bars, split into twelfths, incorrect-choice guidance, correct-choice confirmation, and combining the pieces. Both TypeScript checks and the production build passed.
- This is an authored model for the first problem only. It makes no provider calls, does not auto-submit or fill the answer, and reveals the final mixed-number representation only after the learner chooses to regroup.

## SuperSubstitute name and pre class plan

The visible product name, page title, report filename, package name, and documentation now use SuperSubstitute. Browser storage reads the former key names as a migration fallback. The deployed Worker name and address remain stable to preserve current rooms and QR links.

All 28 tests, both TypeScript checks, and the production build passed. Browser checks confirmed continued access to the existing teacher room and student session. The new header fits a 390 × 844 viewport.

`PRE_CLASS_IMPLEMENTATION_PLAN.md` specifies future absence intake, asset preparation, coverage, and substitute preparation. `data/scenarios/prep-cases.json` contains ten unique sandbox input scenarios and a fixed evaluation clock. JSON structure and local documentation links passed inspection. The plan passed the available technical writing structural checks. These artifacts do not implement the new preparation pipeline or evaluation UI. No administrator or substitute notification was sent.

## Implemented pre-class workflow

This section supersedes the prior plan-only status. The deployed app now has `/plan`, `/absence`, `/substitute`, `/invitation`, `/coverage`, and `/prep-lab` views. Cloudflare Workflows persist generation stages; separate Durable Objects own absence state and coverage reservations. The classroom consumes immutable published packs instead of the fixed fraction set.

- 36 automated tests pass. Both TypeScript checks and the production build pass.
- TLC checked 240 classroom states, 24 preparation states, and 4 coverage states with no violations. These finite models do not prove all runtime behavior.
- Live You.com/Parasail generation passed for mixed-number addition, mixed-number subtraction, decimals, rectangle area/perimeter, and multiplication. The initial multiplication run required adult source review. Compact fraction runs produced four questions and two tools with exact quoted-source matches.
- Published decimal, rectangle, and multiplication packs passed the actual classroom handoff: room initialization, correct question/pack identity, a student answer, and a frozen report.
- Coverage HTTP checks passed atomic concurrent acceptance, idempotent retry, cross-timezone conflict rejection, cancellation, and reservation release. No model calls or external messages occurred during those checks.
- The actual CrewAI Flow and designer/reviewer Crew produced a four-question lesson through Parasail in a local authenticated-service check. The service is exposed through an authenticated demo tunnel and depends on this host remaining awake. The fast demo path uses direct structured design; additional CrewAI review is optional.
- Initial compact division and volume generation hit provider rate limits. Provider pacing and longer backoff now exist. Those topics have components and math tests, but are not the critical path for the submission video.
- Deterministic validation failures no longer consume repeated automatic retries. The adult sees an actionable review/error state and can revise the absence.
- One Gmail is now connected. Explicit email delivery is implemented with sandbox isolation, persisted pre-send state, provider receipts, and no automatic retry of uncertain writes. Calendar integration remains outside the MVP.

Public repository: https://github.com/gonzalj3/supersubstitute. Credentials, local service state, test tokens, and screenshots remain excluded.

## One Gmail delivery

39 unit tests pass, including sandbox isolation, checkpoint-before-send, duplicate-click protection, and no blind retry after an ambiguous failure. The server uses the exact send action discovered from One and keeps credentials in Cloudflare secrets. Live deployed delivery passed after recipient approval: one synthetic administrator notice sent to the project owner, Gmail receipt `1a1852bf8942cb64`. A second send request returned zero sent messages. Deployed sandbox-send rejection and unauthenticated-send rejection also passed.

## Automatic end-of-day reporting and header correction

42 unit tests pass. Added report aggregation checks for all-period completion, teacher/administrator recipient deduplication, sandbox isolation, and report-only email delivery. The deployed smoke test passed: unauthorized settings rejected, a frozen classroom handoff posted through a Durable Object alarm to its absence day, two sandbox report messages appeared, and repeated closure did not duplicate them. No external emails were sent during this report smoke test; the prior live One Gmail test verified the send connection.

Fixed the prepared lesson header selector: grade/objective text now updates `.lesson-description` rather than the fraction icon. A deployed browser check confirmed the icon remains `½` and the description bounds stay inside the header; visually inspected screenshot is kept locally in ignored artifacts.
