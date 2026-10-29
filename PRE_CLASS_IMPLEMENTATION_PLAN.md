# SuperSubstitute pre class implementation plan

SuperSubstitute will convert a teacher absence notice into a prepared school day. The teacher will describe the lesson and provide any current questions. The system will prepare practice, two or three interactive tools, and a substitute guide.

You.com will supply state evidence and video sources. Parasail will produce structured lesson content. CrewAI will coordinate the specialist tasks. One will deliver school notifications.

This phase precedes the current student practice and live classroom views. This document specifies future work. Only the SuperSubstitute name change accompanies this plan.

## 1 The teacher journey

On Wednesday afternoon, a teacher reports a Thursday absence. The teacher supplies the state, grade, class periods, and intended math lesson. For example, the lesson concerns addition of mixed numbers with unlike denominators.

The teacher selects **Prepare my substitute day**. The system saves the absence immediately and starts two independent processes. One process coordinates coverage. The other process prepares the lesson. A delay in coverage must not prevent lesson preparation.

The administrator receives the absence notice and a link to its status. Available substitutes receive invitations through the configured school contact list. An invitation is not an assignment. A substitute can accept the invitation, subject to schedule checks and an atomic assignment decision.

The system prepares a versioned lesson pack. The teacher or administrator can inspect its sources, questions, interactive tools, and substitute guide. After publication, the assigned substitute receives access to the preparation view. Student access opens when the substitute starts the class.

### The short absence form

| Field | Requirement | Purpose |
| --- | --- | --- |
| Teacher and school | Required, from the school profile where possible | Identify the absence and authorized contacts |
| Absence date | Required, with school timezone | Prevent date errors around midnight |
| Class periods | Required, with grade and duration | Create a separate room for each class |
| State or jurisdiction | Required | Select the correct standards |
| Intended lesson | Required, plain text | Define the objective and scope |
| Curriculum reference | Optional text or URL | Connect to the actual unit or lesson |
| Teacher questions | Optional typed questions and answers | Preserve current teacher work |
| Student prerequisites | Optional | Select suitable explanation steps |
| Supports | Optional, such as large text or reduced reading load | Configure the materials |
| School instructions | Optional | Add constraints and classroom routines |

The first release uses typed questions and public curriculum URLs. Worksheet PDF and image extraction follow later. Unsupported files receive a clear status rather than a false import result.

Absence reasons and student records are not necessary for lesson preparation. Contact data stays separate from curriculum queries.

### The resulting views

| View | Main content |
| --- | --- |
| Teacher plan | Input summary, job progress, source evidence, lesson preview, revision controls, publication status |
| Administrator coverage | Absence, periods, invitation status, accepted substitute, unresolved coverage |
| Substitute preparation | A five-minute overview, lesson tools, explanation script, worked examples, videos, practice preview |
| Substitute classroom | The current dashboard, plus the published lesson pack and presentation controls |
| Student practice | The current answer and tutor loop, with tools from the published pack |

## 2 The lesson pack

A pack covers one grade, state, and math objective. Different classes can reuse its immutable published version. Classes with different objectives receive different packs. Each class retains its own student state and report.

Each pack contains these assets:

- A plain-language objective and prerequisite skills.
- State standard references with source dates and exact evidence locations.
- Teacher questions, or generated practice when the teacher supplies none.
- Two or three distinct interactive tools with student and presentation modes.
- A misconception catalog with concrete substitute actions.
- A short substitute guide and worked examples.
- Two or three relevant YouTube videos that You.com finds.
- An offline fallback with printable questions, examples, and the substitute guide.

### Teacher question policy

When the teacher supplies no questions, generate six to eight items as an initial default. Adjust the count to the period duration. Include supported difficulty levels and at least one transfer problem.

When the teacher supplies questions, preserve their text, order, and identifiers. Derive missing answers with the math engine. Compare supplied answers with independent calculations. A conflict requires review and an explicit correction.

Do not silently replace teacher questions or add more questions. An optional **Add practice** control permits supplementation. Each item records whether the teacher or the generator supplied it.

### Example pack for mixed numbers

| Tool | Student action | Learning objective | Substitute use |
| --- | --- | --- | --- |
| Fraction bars | Rename thirds and fourths as twelfths, then regroup | Equivalent fractions and conservation of quantity | Project each step and ask students to explain the unchanged shaded amount |
| Number line | Place mixed numbers and combine jumps | Connect addition to magnitude and estimation | Compare the estimate with the exact result |
| Error detective | Identify and repair an incorrect worked step | Distinguish numerator operations from denominator mistakes | Discuss a shared misconception without naming students |

The current fraction model becomes the first reusable component. Generated operands replace its fixed numbers. A shared math engine supplies all equivalent fractions and regroup steps.

## 3 Generate data for tested components

The generator selects components from a registry and supplies validated parameters. It does not deploy new JavaScript for each lesson. Each component has a known interaction model, arithmetic rules, accessibility behavior, and test suite.

This design permits varied lessons without a separate code release for each generated pack. Unsupported skills produce an explicit status. They do not receive a fraction tool with unrelated labels.

Initial component families:

| Component | Supported math | Required checks |
| --- | --- | --- |
| Fraction bars | Equivalence, comparison, addition, subtraction, mixed numbers | Equal whole sizes, exact partitions, correct regroup steps |
| Number line | Fractions, decimals, addition, subtraction | Correct scale, order, interval lengths, and jump endpoints |
| Place value board | Whole-number and decimal operations | Base-ten exchanges, digit positions, exact decimal arithmetic |
| Equal groups and arrays | Multiplication and division | Row and column counts, group totals, integer constraints |
| Rectangle builder | Area and perimeter | Distinct formulas, dimensions, units, and answer types |
| Unit cube model | Volume | Integer dimensions, cube count, cubic units, bounded scene size |
| Error detective | Supported operations across the registry | A genuine mathematical error and an independently verified repair |

Start with fractions and number lines. Add the other families in separate increments. Advertise only the families that pass their acceptance checks.

### Example interactive manifest

```json
{
  "id": "tool-fractions-1",
  "component": "fraction-bars",
  "componentVersion": 1,
  "objective": "Add mixed numbers through equivalent fractions",
  "problemId": "q1",
  "parameters": {
    "operation": "add",
    "left": { "whole": 2, "numerator": 1, "denominator": 3 },
    "right": { "whole": 1, "numerator": 3, "denominator": 4 }
  },
  "steps": ["compare", "rename", "combine", "regroup"],
  "sourceIds": ["state-standard-1"],
  "modes": ["student", "presentation"]
}
```

The renderer calculates the common denominator and intermediate values. The model does not supply those values as unchecked display text. Each component declares numeric limits. Fraction bars initially cap the common denominator at 24 so phone displays remain legible.

Student mode provides manipulation, checkpoints, hints, reset, and an independent answer field. Presentation mode adds large controls, reveal steps, and discussion prompts. Both modes use the same parameters and arithmetic.

Tool progress belongs to the student session or presenter session. It does not modify the shared pack. An attempt can retry without a reset of the tool.

## 4 State evidence through You.com

You.com supplies evidence. It does not certify educational compliance. SuperSubstitute must connect each objective and tool to specific state evidence and expose conflicts for review.

The researcher searches for the requested state, grade, and generic skill. It prioritizes the state education agency and its current standards documents. It fetches the relevant pages or PDF passages through Contents. Curriculum sources and video sources form separate evidence categories.

Each evidence record includes the title, URL, publisher, retrieval time, source version or adoption date, standard code, and exact passage location. A PDF record also includes its page number. Every alignment claim references an evidence identifier.

The reviewer checks the grade, jurisdiction, operation, and expected representation. A familiar standard code alone is insufficient. Teacher notes cannot silently override state guidance that conflicts with their instructions. The plan explains the conflict and requests a scope decision in the preview.

The cache key includes state, grade, skill, source version, and curriculum reference. A source conflict, missing source, or stale version prevents the **Verified alignment** status. The test harness can use stored evidence snapshots with visible dates.

Web queries never include student labels, student work, absence reasons, or contact information. Treat retrieved text as evidence, not as instructions to the agents.

### Video selection

Use the current You.com video adapter as the first source discovery step. Search for the pack objective and representation. Retain watch links, deduplicate videos, and show source metadata.

Judge topic suitability from available metadata and any accessible transcript. Do not claim transcript review when only snippets exist. Include a short selection reason and a review status. The substitute can preview and dismiss a video before class.

## 5 The substitute preparation view

The assigned substitute opens a protected link on Wednesday evening or Thursday morning. The view works independently of the active classroom dashboard. It presents this order:

1. The lesson objective and what students already know.
2. A short explanation of the key idea.
3. One worked example with **Say**, **Show**, **Ask**, and **Look for** prompts.
4. The interactive tools in presentation mode.
5. Videos with a selection reason and preview links.
6. A suggested period sequence and a fallback without devices.
7. Common errors and a concrete response for each error.
8. A class start control that opens the current live room.

For mixed numbers, the guide explains equal-sized fractional pieces, common denominators, and regroup steps. It includes an estimate before calculation. The guide also distinguishes a new explanation from practice of prior instruction.

The intended adult is not a math specialist. Use short steps and the same examples as the student tools. Provide an answer key in the authorized adult view. Do not expose the complete answer key through the student API.

The substitute can rehearse a tool without new student attempts. Rehearsal and classroom use maintain separate progress. The pack revision and source evidence remain visible in both adult views.

## 6 Coverage and notifications

The first release uses a school-supplied substitute pool. Each record contains an approved contact, qualification range, availability window, and opt-in status. Do not infer availability from an empty calendar.

One delivers the administrator notice and substitute invitations. Discover the connected apps and action schemas before implementation. Verify write access. Build message payloads from the saved absence, rather than from fixed demo text.

| Event | Recipient | Content |
| --- | --- | --- |
| Absence saved | Administrator | Teacher, date, periods, coverage status, preparation status |
| Coverage invitation | Eligible substitute | Date, school, grade, periods, acceptance link |
| Assignment accepted | Administrator and teacher | Confirmed substitute and covered periods |
| Pack published | Assigned substitute | Preparation link and class details |
| Absence canceled or changed | Affected recipients | Cancellation or changed details and current status |

Generation starts without a substitute assignment. A published pack can await coverage. No available substitutes produces a coverage alert for the administrator, not a false assignment.

For the first release, one substitute accepts all selected periods. The assignment coordinator rejects schedule overlap. Partial-period coverage follows later. Two simultaneous acceptances cannot create two assignments for the same period.

Each notification uses a durable outbox with a unique event key. Record `pending`, `reserved`, `sent`, `failed`, or `unknown`. An ambiguous provider timeout produces `unknown`. Do not blindly repeat that delivery unless the provider supports idempotency or reconciliation proves no delivery.

Test mode captures notifications in a sandbox outbox. It never contacts real substitutes or administrators. Real delivery uses only configured school recipients. This plan does not send any notifications.

## 7 Data and version boundaries

| Contract | Important fields |
| --- | --- |
| `AbsenceRequest` | School, teacher, school timezone, date, periods, grade, state, objective, question policy, revision |
| `CoverageAssignment` | Absence revision, substitute, periods, eligibility snapshot, acceptance state |
| `GroundingBundle` | Source records, standard codes, evidence locations, conflicts, source version |
| `PracticeSet` | Typed problems, provenance, answer specification, difficulty, source identifiers |
| `InteractiveManifest` | Component, component version, validated parameters, objective, problem references, source identifiers |
| `SubstituteGuide` | Script, worked examples, period sequence, misconceptions, fallback, video references |
| `LessonPack` | Absence revision, pack revision, all asset references, validation results, publication state, content hash |
| `NotificationIntent` | Event key, recipient role, channel, payload reference, delivery state, provider receipt |
| `ClassroomSession` | Published pack revision, period, session state, student capabilities |

Problems use a typed expression tree. Supported operations and numeric bounds form an allowlist. Never evaluate model text as code.

Answers use explicit types: rational, exact decimal, integer, measurement with units, or choice. Decimal operations use rational or integer-scale arithmetic. Geometry requires the correct unit dimension. An approximate answer requires an explicit tolerance in its contract.

An edit creates a new absence revision and a new preparation job. Old job results cannot publish into the new revision. Publication creates an immutable pack. Current classrooms remain pinned to their published revision.

## 8 Runtime architecture

```text
Teacher form
    |
Cloudflare Worker -> Absence Durable Object
    |                         |
    |                         +-> Coverage coordinator -> One outbox
    |
Cloudflare Workflow -> authenticated Python service
    |                   CrewAI preparation Flow
    |                     Researcher -> Designer -> Reviewer -> Guide author
    |                         |             |
    |                       You.com       Parasail
    |
Validated versioned lesson pack -> Adult preview -> Publish
    |
Substitute preparation view -> Start class -> Current classroom Durable Object
```

Cloudflare Workflows owns durable job state, retries, and checkpoints. CrewAI owns the agent tasks inside the preparation job. Use one job identifier across both layers. Repeated delivery of a job must return or resume its current run.

The Python service uses Python 3.12 and a pinned CrewAI version. It accepts authenticated job requests and exposes job status. Each task returns a typed contract. Do not keep the original teacher HTTP request open until all agents finish.

The researcher receives generic curriculum inputs. The designer receives evidence and the supported component catalog. The reviewer receives candidate assets and evidence. The guide author receives validated assets. None of these agents needs substitute contact data.

Store small metadata and state in Durable Objects. Store large evidence snapshots and lesson files in R2. Retain source hashes in metadata. Separate the absence, coverage, and classroom authorities. Add storage bindings only when implementation needs them.

### Proposed routes

| Route | Purpose |
| --- | --- |
| `POST /api/absences` | Save absence, schedule preparation, create notification intents |
| `GET /api/absences/:id` | Return preparation and coverage status |
| `POST /api/absences/:id/revise` | Create a new revision |
| `POST /api/absences/:id/cancel` | Cancel future work and invalidate invitations |
| `GET /api/absences/:id/preview` | Return adult previews and validation evidence |
| `POST /api/absences/:id/publish` | Publish a validated, current pack |
| `POST /api/invitations/:token/accept` | Accept coverage through the assignment coordinator |
| `GET /api/substitute/prep/:id` | Return the assigned substitute preparation view |
| `POST /api/absences/:id/start` | Create or resume the period room from the published pack |
| `POST /api/prep-evaluations` | Run sandbox math scenarios and return an evaluation identifier |

School roles require authenticated access before real contact delivery. Demo capabilities remain suitable only for synthetic test rooms. Invitation tokens expire and bind to an intended substitute and absence revision.

## 9 Quality gates

Use these stages: `queued -> research -> design -> validation -> ready -> published`. Use explicit `needs_review`, `failed`, `canceled`, and `unsupported` outcomes. Display each stage and its result in the teacher view.

The validation gate requires all these conditions:

- The requested grade and state match the evidence.
- Every alignment claim has a valid evidence reference.
- Every question has a valid expression and independently checked answer.
- Supplied teacher questions remain intact unless the teacher approves a correction.
- The pack has two or three distinct, supported interactive tools.
- The renderer can mount every tool with its declared component version.
- Each tool conserves mathematical quantities through every state transition.
- All required teacher questions have a tool connection or an explicit explanation of coverage.
- The guide and videos match the same objective and pack revision.
- Phone, keyboard, and presentation checks pass.

The initial publication policy requires teacher or administrator review. The teacher can delegate that review to the administrator when absent. Automatic generation still starts immediately. The product can later offer school-approved automatic publication for specific validated families.

A second model review can find ambiguous instructions. It cannot replace deterministic arithmetic, component tests, or source checks. A failed gate produces a repair attempt with a bounded retry count, then a visible review state.

## 10 Formal methods and TDD

Add `spec/Preparation.tla` for the absence revision, preparation phase, publication, and cancellation rules. Add `spec/Coverage.tla` for invitation acceptance and assignment races. Keep the current classroom model separate.

Model finite cases with two revisions, two periods, two substitutes, duplicate callbacks, retries, and delayed results. Check these safety properties with TLC:

| Property | Runtime control | Regression case |
| --- | --- | --- |
| Only a validated current revision can publish | Revision and validation guards | An old job finishes after a teacher edit |
| A canceled absence cannot start a new class | Cancellation guard | A late publish or start request |
| One period has at most one substitute | Atomic assignment authority | Two simultaneous acceptance requests |
| A substitute cannot accept overlapping periods | Schedule conflict check | Two absences at the same time |
| A notification event has one active reservation | Durable event key and outbox state | Duplicate job callbacks |
| A classroom uses one immutable pack revision | Published version reference | Regeneration after class start |

Do not claim exactly-once email delivery without provider support. Do not claim unconditional job completion during provider failure. Liveness properties require explicit assumptions about queue progress, provider recovery, and human review.

Write tests that fail for each contract and state transition before implementation. Use provider fixtures for unit and integration tests. Keep live-provider tests separate and bounded. Every counterexample becomes a regression test.

Math property tests cover equivalent fractions, decimal scale, regroup conservation, array totals, rectangle formulas, and cube counts. Tool tests inspect actions and quantities, not screenshots alone. Browser tests inspect mobile layout, keyboard behavior, wrong choices, reset, and independent presentation progress.

## 11 Math evaluation studio

Add a developer view at `/prep-lab`. It uses the same preparation pipeline as the teacher form. It defaults to synthetic contacts and sandbox notifications.

The studio accepts a scenario, state, grade, curriculum note, question policy, and optional teacher questions. It shows provider mode, source dates, generation stages, costs where available, and each asset preview. It also links to student and presentation modes.

Each run produces a structured evaluation report. Include schema checks, source checks, exact answer checks, component coverage, render results, provider failures, and revision identifiers. A model opinion alone cannot produce a successful evaluation.

Use `data/scenarios/prep-cases.json` as the initial input corpus. These files contain input scenarios and expected behavior, not fake generated lesson packs. No scenario claims verified state alignment before the evidence step.

The sandbox uses a fixed evaluation clock for reproducible date checks. Live runs use the actual school date and timezone.

| Scenario | Grade | Initial tool families | Expected outcome |
| --- | --- | --- | --- |
| Mixed-number addition | 5 | Fraction bars, number line, error detective | Initial end-to-end release |
| Same objective in Texas | 5 | State-appropriate subset of the same families | Resolve Texas evidence independently |
| Fraction subtraction with regroup | 5 | Fraction bars, number line, error detective | Conserve quantity through exchanges |
| Decimal addition and subtraction | 5 | Place value, number line, error detective | Exact decimal answers |
| Equal groups and division | 3 | Arrays, number line, error detective | Correct group and item counts |
| Area versus perimeter | 4 | Rectangle builder, error detective | Distinct objectives and unit dimensions |
| Volume | 5 | Unit cubes, rectangle layers, error detective | Correct cubic units and quantities |
| Teacher supplies all questions | 5 | Tools derived from those questions | Preserve questions and do not add items |
| Teacher supplies an invalid question | 5 | None until repair | Stop with an actionable review message |
| Unsupported algebra objective | 8 | None in the elementary pilot | Explicit unsupported outcome |

Before each component release, run its topic cases with fixed provider fixtures. Then run a small live-provider sample. The same generic skill in California and Texas must use separate evidence records. It must not reuse a California standard code for Texas.

Also exercise missing state, incorrect grade, curriculum conflicts, empty substitute pool, simultaneous acceptance, provider rate limit errors, stale callbacks, and cancellation during preparation.

## 12 Implementation sequence

### Increment 1 Intake and preview

Add the teacher absence form, persisted requests, job status, and the sandbox outbox. Add school timezone rules and revision guards. Acceptance: the Wednesday request survives a reload and appears in the administrator preview.

### Increment 2 One reusable math family

Extract a shared exact math engine and a parameterized fraction component. Replace the fixed classroom `ITEMS` array with a published pack reference. Remove hardcoded five-item totals and fixed CA labels from classroom displays. Acceptance: two different fraction lessons use the same component and produce correct practice and visuals.

### Increment 3 Evidence and asset preparation

Add the CrewAI service, You.com evidence retrieval, Parasail structured design, deterministic validation, and two or three supported tools. Add source-aware repair states. Acceptance: a fresh objective yields a valid pack with real citations and no manual source edits.

### Increment 4 Substitute preparation

Add the guide, presentation mode, cached video selections, and printable fallback. Acceptance: a substitute can rehearse the tools and start a room without a student attempt during rehearsal.

### Increment 5 Coverage and One delivery

Add the administrator notice, eligible invitations, atomic acceptance, cancellation, and the pack-ready message. Acceptance: sandbox race tests pass, then configured test inboxes receive the correct runtime content. No real recipient receives messages during scenario runs.

### Increment 6 Broader math and evaluation

Add place value, arrays, rectangle models, and volume in separate releases. Add `/prep-lab`, scenario reports, and the full topic matrix. Acceptance: each advertised family passes exact math, evidence, interaction, and classroom integration checks.

The first milestone to implement is intake through a published fraction lesson and substitute preparation. Coverage can use the sandbox outbox during this milestone. The next milestone adds genuine One delivery and assignment acceptance. Broader topic support follows the same validated component path.

## 13 Completion criteria

The owner can enter a new supported math objective without a code change. The system supplies teacher practice only when needed. It prepares two or three relevant interactive tools, state evidence, a guide, and videos. The substitute can inspect the pack before class and use the same version during class. The administrator can distinguish preparation status from coverage status. Test runs never masquerade as real school notifications.

## References

The architecture choices above use these primary documentation sources. State evidence still requires the current document and exact passage for each generated lesson.

- [You.com Search quickstart](https://you.com/docs/guides/search/quickstart) and [Contents overview](https://you.com/docs/guides/contents).
- [CrewAI Flows](https://docs.crewai.com/en/concepts/flows).
- [Parasail Chat Completions](https://docs.parasail.io/parasail-docs/api-reference/chat-completions).
- [Cloudflare Workflows](https://developers.cloudflare.com/workflows/).
- [California Common Core mathematics standards](https://www.cde.ca.gov/BE/ST/SS/documents/ccssmathstandardaug2013.pdf).
- [Texas Essential Knowledge and Skills](https://tea.texas.gov/curriculum-and-instruction/texas-essential-knowledge-and-skills-teks).
