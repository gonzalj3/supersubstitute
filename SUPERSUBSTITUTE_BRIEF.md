# SuperSubstitute — Build Brief

Scope update: [the pre-class workflow plan](PRE_CLASS_IMPLEMENTATION_PLAN.md) extends this original classroom brief with absence intake and lesson preparation. Its scope supersedes the exclusions below for teacher absence and substitute coordination.

**Hackathon:** Hack with YOU: Halloween Edition (You.com × One × Parasail × CrewAI), AWS Builder Loft SF, Wed Oct 28 2026
**Track:** Track 3 — The Open Haunt (judged on the Track 2 rubric)
**Partners (all four load-bearing):** CrewAI · You.com · Parasail · One
**Submission:** Google Form https://forms.gle/2z9dKv9gvsP3cEjW7 before the deadline (event ends 8:30 PM)
**Status:** scaffolding handoff — owner will extend from here.

---

## 1. Problem space

When a teacher is absent, the class loses a day of instruction. For schools accountable to state standards and standardized test results, every lost day raises the odds that students don't meet the standard — which is bad for students, for teachers, and for administrators whose schools are judged on those outcomes.

The reality of a sub day:

- **Substitutes don't teach.** Even experienced subs aren't hired to deliver new instruction, often aren't certified in the subject, and are effectively there to supervise.
- **The best case is practice.** If the teacher left anything, it's rote practice to reinforce prior learning. Usually it's a worksheet.
- **That practice is unsupported.** A stuck student has no one to ask; the sub can't help with content they don't know.
- **That practice is invisible.** Nobody knows who did what, who struggled, or on which skill. The teacher comes back to "they were fine."

**Thesis:** a sub day is a practice day. Today that practice is unsupported and invisible. SuperSubstitute makes it **adaptive** (each student gets a tutor), **visible** (the sub sees the room live and knows exactly what to do), and **recorded** (the teacher and principal get a standards-aligned account of the day).

Target setting: 1:1 device classrooms (Chromebooks / tablets), which are common in US K–12.

---

## 2. Product

Three users, one loop:

| User | What they get |
|---|---|
| **Student** | Standards-aligned practice on their device, aligned to how *their state* assesses the skill; an AI tutor that responds to their actual wrong answers with graduated hints |
| **Substitute** | A live room dashboard written for a non-expert: who's stuck, on what, and a plain-language action ("3 students are adding the denominators — show this worked example") |
| **Teacher & principal** | End-of-period handoff (what was practiced, mastery per student, shared misconceptions, suggested re-teach group) and a principal digest across covered rooms |

### Hackathon demo scope (build this, nothing more)

- **One skill:** adding and subtracting mixed numbers / fractions with unlike denominators (grade 5).
- **One room:** ~8 students — judges joining live on phones via QR code, plus **clearly labeled** simulated students.
- **Two screens:** student practice page (mobile-friendly) and sub dashboard (big screen).
- **Real actions via One:** handoff email to the teacher, digest to the principal, calendar block for tomorrow's re-teach group.
- **Principal view = the One digest email.** No separate admin UI.

### Out of scope (roadmap slide / README only)

Logins and roles, multi-school, rosters from SIS, integrations with sub-management platforms (Frontline, Red Rover), multiple subjects.

---

## 3. Why each partner is load-bearing

The rubric awards nothing for a passthrough partner. The README and the demo must say what breaks without each.

| Partner | Role | Without it |
|---|---|---|
| **CrewAI** | The swarm: per-student tutors with partial knowledge, a room monitor, a sub coach, a reporter | One model guessing about a whole room; no partial-knowledge design; no coordinated handoff |
| **You.com** | Grounds practice in the **state's** standard, **how that state tests it** (released items, blueprints, item formats), the teacher's curriculum, and vetted worked examples | Generic practice, invented standard codes, no link to the test the school is accountable for; no per-state variation |
| **Parasail** | Grades every answer (schema-locked JSON), streams hints, embeds errors to cluster misconceptions across the room | No tutoring, no grading, no clustering |
| **One** | Sends the handoff, the principal digest, the calendar block | The record never reaches the people who need it |

---

## 4. Architecture

```
            ┌──────────── PREP (once per sub day, cached) ────────────┐
 teacher    │ Grounding Flow                                          │
 note +  ──▶│  You.com search+contents → state standard, test format,  │
 state      │  curriculum lesson, worked examples                     │
            │  Parasail (json_schema) → practice set + misconception   │
            │  catalog + worked-example cards, each with source URLs  │
            └──────────────────────────┬──────────────────────────────┘
                                       ▼
 student devices ──answer──▶ FastAPI ──▶ Tutor agent (one per student; sees only that student)
        ▲                       │            │ Parasail: grade → {correct, error_type, ...}
        └──── hint (stream) ────┘            │ Parasail: hint (only on wrong answers)
                                             ▼
                                   Room state (in-memory store)
                                             │ every N seconds / on change
                                             ▼
                              Room Monitor agent (sees aggregates only)
                               Parasail embeddings → cluster error_types
                                             ▼
                              Sub Coach agent → plain-language action cards
                                             ▼
                                   Sub dashboard (polls every 2s)

 end of period ──▶ Reporter agent → teacher handoff + principal digest
                                  ──▶ One: email teacher, email principal,
                                           calendar block for re-teach group
```

### Agents (CrewAI)

Partial knowledge is a design feature, not a limitation — mirror Track 1's "distinct roles, distinct tools, partial knowledge."

| Agent | Sees | Tools | Output |
|---|---|---|---|
| **Curriculum Researcher** (prep) | Teacher note, state, grade | You.com search + contents | Grounding bundle with citations |
| **Practice Designer** (prep) | Grounding bundle | Parasail | Practice set + misconception catalog + worked-example cards |
| **Tutor** (×N, one per student) | One student's answers only — `Memory` scope `/student/{id}` | Parasail | Grade result + next hint |
| **Room Monitor** | Grade results for all students, not transcripts | Parasail embeddings | Clusters + students needing help |
| **Sub Coach** | Room Monitor output + worked-example cards | Parasail | Action cards for the sub |
| **Reporter** | Full room log at period end | Parasail, One | Handoff, digest, calendar event |

### CrewAI structure

- Use a **Flow** for the deterministic lifecycle: `@start` prep → live loop → `@router` period end → report.
- Use **Crews** inside steps where agents collaborate (prep: Researcher → Designer; report: Reporter).
- Keep tutors **lightweight**: a per-student function calling Parasail with that student's scoped memory. Don't spin up a full Crew per answer — latency and rate limits will kill the demo.
- Respect the budget: cap concurrently active agents; batch Room Monitor runs on a timer.

---

## 5. Data contracts

Lock these early. Everything from Parasail goes through `response_format` with a `json_schema`.

```python
# models.py (pydantic)
class Source(BaseModel):
    title: str
    url: str

class GroundingBundle(BaseModel):
    state: str                 # "CA", "TX", ...
    grade: int
    standard_code: str         # e.g. a CCSS 5.NF code or a TEKS code, as found
    standard_text: str
    assessment_notes: str      # how the state's test assesses it (formats, item types)
    curriculum_ref: str | None # e.g. "Illustrative Math G5 U3 L5", if found
    sources: list[Source]

class PracticeItem(BaseModel):
    id: str
    prompt: str                # e.g. "2 1/3 + 1 3/4 = ?"
    answer: str                # canonical form
    item_format: str           # mirrors the state's test format where possible
    skill: str

class MisconceptionCatalogEntry(BaseModel):
    error_type: str            # e.g. "adds_denominators", "ignores_whole_number",
                               # "no_common_denominator", "no_regrouping",
                               # "improper_conversion_error"
    description: str
    worked_example_id: str

class WorkedExample(BaseModel):
    id: str
    title: str                 # "How to add mixed numbers"
    steps: list[str]
    source: Source

class GradeResult(BaseModel):
    student_id: str
    item_id: str
    correct: bool
    error_type: str | None
    evidence: str              # short quote/description of what the student did
    hint_level: int            # 0 = none, 1 = nudge, 2 = strategy, 3 = worked step

class ActionCard(BaseModel):
    priority: int
    message: str               # plain language for a non-expert adult
    students: list[str]        # display names / seat labels, not full names
    worked_example_id: str | None

class Handoff(BaseModel):
    standard_code: str
    items_attempted: int
    mastery_by_student: dict[str, float]
    top_misconceptions: list[str]
    suggested_reteach_group: list[str]
    narrative: str
```

---

## 6. You.com grounding

- Auth header is `X-API-Key` (not Bearer). Endpoints: `POST https://ydc-index.io/v1/search`, `POST https://ydc-index.io/v1/contents`.
- Use `extraction: "highlights"` on search to keep context small; use Contents to pull full text of the 2–4 best pages.
- Queries to run (per state + grade + skill):
  1. the state's standard for the skill (exact code and wording)
  2. how the state test assesses it (released items, blueprint, item formats — e.g. CAASPP for CA, STAAR for TX)
  3. the teacher's curriculum lesson if named in the note
  4. vetted worked examples (e.g. Illustrative Math, Khan Academy)
- **Never put student names or student work in a search query.** Only generic skill/standard queries go to the web.
- **Cache** the grounding bundle to `data/grounding/{state}_{grade}_{skill}.json`. Demo plan: run grounding live once for a state a judge names, but use the cache for the main run so a slow search can't stall the demo.
- Show the cited sources on screen next to the practice set — visual proof that grounding is real.
- Respect rate limits: read `X-RateLimit-Remaining` / `Retry-After`; back off, don't loop.

---

## 7. Parasail

- OpenAI-compatible: `base_url="https://api.parasail.io/v1"`, `Authorization: Bearer $PARASAIL_API_KEY`.
- Verify model IDs with `GET /v1/models` before hardcoding. From the event page:
  - `parasail-glm-53-flash` — default for grading and hints (cheap, fast)
  - `parasail-deepseek-v41-flash` — balanced reasoner for prep and reporting
  - `parasail-ai/GritLM-7B-vllm` — embeddings for clustering
- Schema-locked output via `response_format` (`json_schema`) or `extra_body.guided_json`.
- If using the Responses API, **always send `store: false`** or it errors.
- Stream hints (`stream: true`) so students see them type out.

### Rate-limit strategy (critical)

Free tier is **5 RPM**; paid is 500 RPM. A room answering at once will exceed 5 RPM immediately.
1. Confirm the event credits put the key on the paid tier before building the live loop.
2. **Grade deterministically first:** parse the answer and compare to the canonical answer in code. Only call the model on **wrong** answers (to classify `error_type` and write the hint).
3. Pre-generate hints for each catalogued misconception during prep; the live call only picks and personalizes.
4. Batch embeddings for the Room Monitor on a timer (e.g. every 10s), not per answer.
5. Exponential backoff with jitter on 429s.

---

## 8. One (actions)

Setup (per the event page): free account at app.withone.ai → Pro via coupon `YOU-SF-PRO` → create API key → connect the apps with **write** access (email, calendar; Discord optional). Event skill:

```bash
mkdir -p ~/.agents/skills/one-hackathon
curl -fsSL https://hackathon.withone.ai/sf-halloween-2026/skill.md -o ~/.agents/skills/one-hackathon/SKILL.md
```

Three tools: `list_one_integrations`, `find_one_actions`, `execute_one_action`.

- `find_one_actions` takes the **intent only** ("send an email", "create a calendar event"), not the message content.
- Path parameters go in `path_variables`, never the body.
- All payloads are built from runtime state (the actual `Handoff`), never hardcoded strings.

Actions at period end:
1. Email the teacher the handoff (mastery table, misconceptions, re-teach group, sources).
2. Email the principal a short digest (room, standard, minutes of practice, % mastery).
3. Calendar block for the teacher: "Re-teach: adding mixed numbers — {students}".
4. Optional: post a one-line summary to the event Discord `#loft-incident` for visibility.

If One fails after one careful retry: show the generated handoff on screen and send it manually; note the fallback to the organizers.

---

## 9. Students: live and simulated

- **Live:** judges scan a QR code → student page → enter a seat label (no real names).
- **Simulated:** a script that drives N fake students, each with a persona carrying 1–2 misconceptions from the catalog and a response delay. Every simulated student is **labeled "SIM"** on the dashboard. The rubric penalizes fake data presented as real; labeled simulation is fine.
- Simulated students exercise the same API as real ones, so the pipeline is genuinely live either way.

---

## 10. Repo layout

```
supersubstitute/
├── README.md                  # problem, demo GIF, why-each-partner, privacy, run steps
├── .env.example               # YDC_API_KEY, PARASAIL_API_KEY, ONE_API_KEY, TEACHER_EMAIL, PRINCIPAL_EMAIL
├── pyproject.toml             # Python 3.12 (CrewAI needs 3.10–3.13, NOT 3.14)
├── Makefile                   # `make demo` = one-command run
├── app/
│   ├── main.py                # FastAPI: student + sub + admin routes, static pages
│   ├── models.py              # contracts from §5
│   ├── state.py               # in-memory room state
│   ├── grounding.py           # You.com calls + cache
│   ├── llm.py                 # Parasail client, schema calls, backoff
│   ├── grading.py             # deterministic check → model only on wrong answers
│   ├── flows/
│   │   ├── sub_day_flow.py    # CrewAI Flow: prep → live → report
│   │   └── agents.yaml / tasks.yaml
│   ├── monitor.py             # Room Monitor: embeddings + clustering on a timer
│   ├── coach.py               # Sub Coach: action cards
│   ├── report.py              # Reporter: Handoff + One actions
│   └── one_actions.py         # One wrappers + manual fallback
├── web/
│   ├── student.html           # mobile-first practice page
│   └── sub.html               # big-screen dashboard (polls /room every 2s)
├── sim/
│   └── students.py            # labeled simulated students
└── data/
    └── grounding/             # cached bundles
```

Real-time: **polling every 2s** is enough. Don't spend time on WebSockets.

---

## 11. Build order

1. **Setup** — Python 3.12 venv, keys in `.env`, verify You.com and Parasail with curl, list Parasail models.
2. **Contracts + deterministic grading** — models, practice item parsing, correct/incorrect without any model.
3. **Grounding** — You.com search/contents → `GroundingBundle` → Practice Designer → cached JSON with sources.
4. **Student loop** — student page → answer → grade → wrong-answer classification + hint (Parasail).
5. **Room view** — room state → Room Monitor clustering → Sub Coach action cards → sub dashboard.
6. **Simulated students** — fill the room; tune hints and cards.
7. **Report + One** — Reporter → handoff → email teacher, email principal, calendar block.
8. **README + demo rehearsal** — why-each-partner section, privacy section, architecture diagram, one-command run.

If behind schedule, cut in this order: calendar block → principal email → embeddings clustering (fall back to grouping by `error_type`).

---

## 12. Rubric mapping

| Criterion (pts) | How SuperSubstitute earns it |
|---|---|
| Innovation (25) | A swarm with partial knowledge per student; a coach that translates room data for a non-expert adult; practice aligned to how each state tests the standard |
| Technical (25) | Real-time multi-user loop, schema-locked grading, embeddings clustering, grounded prep with citations, real One actions, rate-limit discipline |
| UX (20) | Judges play students on their phones; the sub dashboard updates live on the big screen |
| Impact (20) | Directly tied to lost instructional days and standards accountability; every 1:1 school has sub days |
| Presentation (10) | Founder story (former 7th-grade math teacher), live demo, one-command repo, clear README |

**Disqualifiers to avoid:** static mockups presented as working; hardcoded responses; any partner used as a passthrough.

### Demo script (~3 min)

1. One sentence of pain: "When a teacher is out, the class loses a day. Subs don't teach — at best kids do a worksheet nobody looks at."
2. Grounding: a judge names a state → show the standard, how that state tests it, and cited sources.
3. Judges scan the QR code and start practicing; simulated students (labeled) fill the room.
4. Someone gets stuck → their tutor responds to their actual error.
5. Sub dashboard: "3 students are adding the denominators — show this example." Show the card.
6. End the period → handoff email lands in the teacher's inbox, calendar block appears, principal digest sent.
7. 20 seconds: what breaks without each partner.
8. Close: "Every sub day becomes a measured, standards-aligned practice day."

### Anticipated judge questions

- **"Isn't this IXL / Khan Academy?"** Those dashboards assume a trained teacher. SuperSubstitute is built for the adult in the room on a sub day, uses the absent teacher's current unit and the state's test format, and automatically reports back to the teacher and principal.
- **"What about Swing's SubPlan.ai?"** It generates a plan for the sub. SuperSubstitute runs the practice, tutors every student, tells the sub what to do in real time, and records what actually happened.

---

## 13. Privacy by design (put this in the README)

- No student names or student work in web searches; only generic standard/skill queries go to You.com.
- Seat labels, not full names, in the demo; simulated students labeled.
- Tutor agents only see their own student (`Memory` scoped per student); the Room Monitor sees aggregates, not transcripts.
- Handoffs go only to the teacher of record and principal.
- Production roadmap: FERPA/COPPA-compliant data handling, district SSO, data retention controls.

---

## 14. Gotchas

- CrewAI needs Python 3.10–3.13; 3.14 breaks `pip install crewai`.
- You.com: `X-API-Key`; Parasail: `Bearer`. A 401 is almost always the wrong header.
- Parasail `model_not_found` → use an ID from `GET /v1/models`.
- Parasail Responses API without `store: false` errors.
- One: send actions need a **write** connection; check `list_one_integrations` if refused.
- Never commit `.env`; never paste keys in Discord.

---

## 15. Where to take it next

- **Fine-tuning** a small grader on labeled misconception data (e.g. the Eedi / MAP misconception datasets) for cheaper, faster grading.
- More skills and subjects; teacher uploads their own practice and SuperSubstitute grounds and extends it.
- Integrations with sub-management platforms (Frontline, Red Rover) so a sub booking automatically creates a sub-day room.
- Longitudinal view: sub-day practice feeds the teacher's gradebook and the principal's standards-mastery reporting.
