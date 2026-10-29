# SuperSubstitute implementation plan

This document covers the existing classroom foundation. [The pre-class workflow plan](PRE_CLASS_IMPLEMENTATION_PLAN.md) adds absence intake, lesson preparation, substitute assignment, and broader math support. It supersedes the earlier exclusion of those features.

The product scope and narrative remain in `SUPERSUBSTITUTE_BRIEF.md`. This plan translates that brief into incrementally verifiable software. First deliver a working Cloudflare classroom without credentials, then replace explicitly labeled local fallbacks with the four partner capabilities.

## Research and decisions (October 28, 2026)

- [Event guide](https://youdotcom-oss.github.io/halloween-hack-2026/): Track 3 uses Track 2's 25/25/20/20/10 rubric. Working interactions, reproducibility, genuine integrations, and honest simulation matter. Submit through the linked Google Form before the organizer deadline; confirm the exact cutoff at the event. The event ends at 8:30 PM.
- The updated guide warns against One **Discord dispatch in Track 1**. SuperSubstitute is Track 3 and uses One for email/calendar, so that warning does not remove our One integration.
- [Workers static assets](https://developers.cloudflare.com/workers/static-assets/) serve the web client and API from one origin. [SQLite Durable Objects](https://developers.cloudflare.com/durable-objects/get-started/) provide one persistent authority per classroom, avoiding divergent per-isolate memory.
- Keep Python CrewAI outside the Worker: a Python 3.12 FastAPI orchestration service called server-to-server. Do not pretend a TypeScript state machine is CrewAI. The first slice requires no Python service; introduce it in milestone 2.
- Two-second polling is sufficient. No WebSockets, SIS integration, district authentication, or additional subjects in this demo.

## Architecture

Browser (dashboard or seat-scoped student session) → Cloudflare Worker → room Durable Object → pure domain transitions. Static assets share the same origin. Each room is created with an opaque ID, a separate teacher capability, and separate per-seat tokens. These are demo capabilities, not production school authentication.

The next slice adds an authenticated Worker → Python orchestration boundary: CrewAI prep Flow runs researcher/designer crews; lightweight per-student tutor calls use only that student's history; monitor receives aggregate errors; coach receives clusters and examples; reporter receives the frozen end-of-period snapshot. You.com supplies researched sources; Parasail supplies schema-validated classification/hints, prep/report inference, and batched embeddings; One delivers the actual generated handoff and calendar action.

## Formal specification before expansion

`spec/Classroom.tla` models finite students, request IDs, hint levels, answer acceptance, closing, report snapshot, and delivery reservation/completion. TLC exhaustively explores the configured finite instance. It is an abstraction, not a proof of JavaScript, fraction parsing, network behavior, or privacy.

Safety properties and implementation obligations:

| Property | Runtime mechanism | Evidence |
| --- | --- | --- |
| A request contributes at most one attempt | Request ID bound to student/item/value, cached result | Retry and conflicting replay tests |
| Hints stay in 0..3 | Saturating per-item counter | Five wrong attempts test |
| No new answers after close | Lifecycle gate before mutation | Closed-room test and TLC |
| Report reflects exactly the closed log | Atomic close + immutable snapshot | Snapshot test and TLC |
| Student cannot mutate another seat | Server-side seat token comparison | Isolation test; not modeled by TLC |
| No incorrect arithmetic acceptance | Exact normalized rational arithmetic, bounded input | Equivalence/invalid input tests; not modeled by TLC |
| No duplicate external delivery under retry | Durable outbox, reservation ID, explicit unknown outcome | Model now; runtime delivery in milestone 3 |

Use fairness only where the environment actually guarantees progress. Do not claim unconditional delivery liveness: provider failure and ambiguous timeouts are real. Never blindly resend an ambiguous email result. Add model traces as regression tests when TLC finds a counterexample. Future refinement: model submission in flight during close and test that the generation/phase check rejects late completions.

## TDD and milestones

1. **Cloudflare-first MVP (current work):** write failing tests for exact grading, retries, closed-room behavior, isolation, bounded hints, honest mastery denominators. Implement pure domain operations, persistent room APIs, student page, QR join, dashboard, rule-based misconception coaching, simulation through the same answer operation, frozen downloadable handoff. Run tests, typecheck, build, Worker integration checks, browser QA, and TLC. Deploy when Cloudflare auth is available. Acceptance: phone answers alter the projected room; no keys required; every simulated seat is labeled.
2. **Grounded adaptive tutoring:** contract tests with recorded/synthetic provider fixtures before HTTP clients. You.com generic state/grade/skill queries only; fetch 2–4 authoritative sources; cache versioned bundles; show citations and evidence freshness. Discover Parasail model IDs, validate configured model, classify wrong answers only, enforce schema, bounded queues/concurrency, request timeout and one retry with Retry-After. Stream hints with cancellation. Add student-scoped memory and CrewAI prep/report Flow. Acceptance: a wrong answer gets a tailored hint supported by grounding, with provider error visibly degraded.
3. **Room intelligence and delivery:** test aggregate-only monitor inputs, batch embeddings every 10 seconds, coach outputs tied to worked examples. Generate handoff from closed snapshot. One discovery → action docs → validated payload → durable per-action outbox. Teacher email, principal digest, optional calendar. Test success, partial failure, timeout/unknown, duplicate clicks, missing write scopes, and manual export. Acceptance: actual inbox/calendar evidence, runtime content, no false sent statuses.
4. **Demo hardening:** eight seats, a judge on a real phone, one state selected live, slow/429/offline provider runs, room close while answers arrive, restart persistence, responsive and keyboard checks, three-minute rehearsal. README maps why each partner is irreplaceable. No credential-free fallback is presented as the completed agent system.

## Deployment and secrets

`npm install && npm run dev` runs the full first slice locally. `npm run deploy` builds static assets and deploys Worker + SQLite Durable Object migration to your Cloudflare account. No KV/D1 provisioning needed for this single-room aggregate. Wrangler login is required if no existing credentials are present. Avoid provisioning paid resources without a demonstrated need.

Use `.dev.vars` locally and `wrangler secret put` remotely. Never ship keys in client code or query strings. Configure the Python service URL and a shared server secret later. Restrict CORS on that service and authenticate every request. Add CI checks for tests/typecheck/build/TLC. Production work must add district authorization, retention/deletion, abuse limits, and reviewed FERPA/COPPA handling; this is a pseudonymous hackathon demo.

## Current boundaries

The first slice's fraction items and hint library are authored fixtures, not generated partner output. The source link is a reference, not a completed You.com grounding run. Grouping uses deterministic error categories, not Parasail embeddings. Report export does not send email. Each integration must show its real status in the interface. Remaining milestones are explicit rather than simulated as complete.
