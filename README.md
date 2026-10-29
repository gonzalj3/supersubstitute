# SuperSubstitute

The teacher is away. The learning stays.

SuperSubstitute turns an elementary teacher's absence notice into a reviewed math lesson pack, substitute preparation, and a shared classroom practice session.

**Live app:** https://understudy-classroom.martin-jose-gonzalez.workers.dev  
**Absence form:** https://understudy-classroom.martin-jose-gonzalez.workers.dev/plan  
**Math preparation lab:** https://understudy-classroom.martin-jose-gonzalez.workers.dev/prep-lab

The original Cloudflare address remains stable so existing classroom and QR links continue to work.

## What works

1. A teacher supplies a date, periods, grade, state, curriculum note, and optional questions.
2. A Cloudflare Workflow uses You.com to discover official state evidence and retrieve source content.
3. Parasail creates a structured lesson draft. The exact math engine independently calculates every answer.
4. A tested component registry supplies two interactive tools: fraction bars, number lines, place value, arrays, rectangles, cube layers, and error analysis.
5. The adult previews questions, source evidence, tools, videos, and a Say/Show/Ask/Look-for guide before publication.
6. Each period starts a persistent classroom with the published questions and tools. Students join via QR code, practice, ask the tutor, or send the substitute a message.
7. The substitute sees live room progress and prepares a frozen handoff at the end.

Teacher questions are preserved, not replaced. Supplied answers are checked. Empty question lists produce 4 generated items. Unsupported objectives and invalid math stop with an explicit error.

Coverage is separate from content generation. The app creates administrator notices and substitute invitations in a visible outbox. Invitation links support acceptance and atomic schedule-conflict checks. For a live day, uncheck Sandbox notifications and use **Coverage & notices → Send pending emails through One**. One sends through the connected Gmail account and returns Gmail message receipts. Sandbox notices stay in the app. Ambiguous or interrupted sends are not retried automatically. Calendar integration is outside this MVP.

## State alignment

The pilot supports California and Texas, grades 3–5. Search queries contain generic skill/state/grade information, never student work, labels, or contact lists. Source cards distinguish retrieved content from search excerpts. An exact source quote match supports alignment review; it is not a compliance certification. An adult reviews the pack before publication. Missing or unconfirmed evidence remains visible.

Live generation checks passed for decimal operations and rectangle area/perimeter, including exact arithmetic and matched source quotes. Multiplication generated correctly and required adult source review when the quoted passage could not be confirmed. Details are in [VERIFICATION.md](VERIFICATION.md).

## Partners

| Partner | Current role |
| --- | --- |
| You.com | Official state evidence, Contents retrieval, and YouTube video discovery |
| Parasail | Structured lesson design and student-scoped question help |
| CrewAI | Authenticated Python Flow and a designer/reviewer Crew in `orchestrator/`; separate service configuration required |
| One | Live Gmail delivery of administrator notices, substitute invitations, and preparation links; persisted delivery receipts and duplicate-send protection |

Cloudflare Workflows can run the edge preparation pipeline without the Python service. The fast demo path uses direct structured design. Select **Add specialist agent review** to use the CrewAI service when `ORCHESTRATOR_URL` and `ORCHESTRATOR_SECRET` are configured. The preview reports the actual orchestrator used.

## Local run

Requires Node 22.12+ and npm.

```sh
npm ci
cp .env.example .dev.vars
# Set real values in .dev.vars, not in source files.
npm run dev
```

Open http://localhost:8787. Wrangler emulates the Worker, Durable Objects, and Workflow. Re-run the dev command after frontend changes. Local QR links work only on this computer; use the deployed URL for phones.

Required secrets: `YDC_API_KEY`, `PARASAIL_API_KEY`, `PARASAIL_MODEL`, and `PARASAIL_PREP_MODEL`. Verify model IDs against Parasail's live `/v1/models` catalog. A separate non-reasoning preparation model avoids consuming the structured-output budget on reasoning.

Live email requires server-only `ONE_API_KEY`, `ONE_GMAIL_CONNECTION_KEY`, and `ONE_GMAIL_ACTION_ID`. Resolve the connection and send action with One’s list/find tools, then upload these as Worker secrets. Never expose the One key to the browser.

`.env.local` is ignored but Wrangler uses `.dev.vars`. If your key is called `YOU_API_KEY`, map it to `YDC_API_KEY`. Never use `VITE_*` for secrets.

```sh
npm test
npm run typecheck
npm run build
npm run model:check
npm run test:smoke  # requires the local server
```

TLC requires Java 11+. The script downloads and verifies the pinned official TLA+ jar. It checks classroom, preparation revision/publication, and coverage-acceptance models. These finite abstractions are not proofs of all runtime code.

## Cloudflare deployment

```sh
npx wrangler login
npx wrangler secret put YDC_API_KEY
npx wrangler secret put PARASAIL_API_KEY
npx wrangler secret put PARASAIL_MODEL
npx wrangler secret put PARASAIL_PREP_MODEL
npm run deploy
```

`wrangler.jsonc` declares static assets, classroom/absence/coverage Durable Objects, and the preparation Workflow. Existing classrooms retain their migration and data. Generation persists independently of the browser.

## CrewAI service

Requires Python 3.12 and `uv`.

```sh
cd orchestrator
uv sync --python 3.12
.venv/bin/python run.py
```

The runner reads ignored `.dev.vars`, creates an ignored service secret, and disables telemetry. It listens on `127.0.0.1:8000`. Deploy `orchestrator/Dockerfile` to a persistent HTTPS service for unattended use, then configure the Worker service URL and matching secret. Temporary local tunnels depend on the host remaining online and suit supervised demos only.

The Flow scopes curriculum context to a practice designer and a substitute coach/reviewer. Exact arithmetic, component limits, evidence checks, and publication guards remain in the Worker. Contact lists and student records do not enter the preparation agents.

## Math evaluation

Use `/prep-lab` to load one of ten scenario inputs, change state/grade/notes, and run the same live pipeline. Notifications default to sandbox mode. Cases cover mixed-number addition/subtraction, decimals, arrays, area/perimeter, volume, preserved teacher questions, invalid fractions, and unsupported algebra. Inputs are in [data/scenarios/prep-cases.json](data/scenarios/prep-cases.json).

Interactive assets use validated parameters in tested components. The system does not deploy unchecked generated JavaScript. Tool progress is separate from answer submissions and presenter rehearsal.

## Boundaries

This is a pseudonymous hackathon pilot. Demo capability links are not district SSO. Use synthetic labels, school data, and contacts. External notification delivery, district authorization, automated retention, and production privacy review remain required before school deployment.

The original fixed fraction demo remains available from the home page. New preparation jobs produce distinct published packs for separate periods. A running classroom stays pinned to its pack. Private absence reasons and student records are unnecessary for preparation.

## Design and submission

Use [DEMO_SCRIPT.md](DEMO_SCRIPT.md) for the exact view transitions and a 2–3 minute recording script. Near the deadline, use a completed mixed-number, decimal, or rectangle lesson and avoid parallel generation runs.

- [Product brief](SUPERSUBSTITUTE_BRIEF.md)
- [Pre-class workflow plan](PRE_CLASS_IMPLEMENTATION_PLAN.md)
- [Classroom foundation plan](IMPLEMENTATION_PLAN.md)
- [Verification record](VERIFICATION.md)
- [Hack with YOU: Halloween Edition](https://youdotcom-oss.github.io/halloween-hack-2026/), Track 3

Keys, `.tools/`, `.wrangler/`, service state, access tokens, and draft screenshots are excluded from Git.
