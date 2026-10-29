# SuperSubstitute demo walkthrough

**Live app:** https://understudy-classroom.martin-jose-gonzalez.workers.dev  
**Public repo:** https://github.com/gonzalj3/supersubstitute

Target length: 2–3 minutes. Record on the same browser that creates the absence. Keep a phone ready for the student view. Keep the CrewAI service and tunnel running on this computer during the demo. If generation is already complete, use that saved plan rather than regenerate immediately before recording.

## Before recording

Open these views in order. Each link comes from the preceding view, so no room or lesson identifiers need to be typed.

1. `/plan` — teacher absence form.
2. The resulting `/absence?id=…` — teacher review and source evidence.
3. **Coverage & notices → Open invitation** — substitute acceptance, optional for a short video.
4. **Assigned substitute preparation link** — day-before preparation.
5. **Start Math period** — live classroom dashboard.
6. **Open student view** or the QR code — student practice.

Use synthetic labels. For an email demonstration, enter your own email as administrator (and optionally substitute), uncheck **Sandbox notifications**, then open **Coverage & notices → Send pending emails through One**. Show the sent status and Gmail receipt. If sandbox stays checked, describe these as in-app notices only.

Prepare one real plan before recording. The generator uses live providers and can be rate-limited. Record the submit/progress shot separately, then cut to that same plan after completion. The cut removes waiting, not a workflow step.

## 0:00–0:20 Teacher reports the absence

Open **Report an absence** from the home page.

Keep the default date, grade 5, California, and one 45-minute math period. In the lesson note use:

> Students will add mixed numbers with unlike denominators. They know equivalent fractions, but need a visual explanation of common denominators and regrouping.

Leave **Add specialist agent review** unchecked for the fastest recording path. Leave **Your questions** empty. This demonstrates generated practice. Optionally enter `Demo substitute |` in the substitute pool to demonstrate an invitation without email.

Click **Prepare my substitute day**.

Say:

> “It’s Wednesday afternoon, and I’ve just learned I’ll miss tomorrow’s class. I tell SuperSubstitute what we were going to learn. I can bring my own questions, or let it prepare practice for me.”

Show the saved absence and preparation status for a moment. Cut past provider latency.

## 0:20–0:45 Show the prepared lesson and state evidence

Stay on **Lesson pack**. Show the source card and the generated questions. Open the official California source in a separate tab if time permits, then return.

The compact generator produces **four questions and two tools**. Older saved test plans can have more items. Use a newly completed compact plan for the four-question claim.

Say:

> “You.com finds the state guidance and retrieves the source material. SuperSubstitute uses that evidence to prepare the lesson and shows the citation. The answers are checked with exact arithmetic. An adult reviews the pack before it goes to the class.”

If the status says **Review state alignment**, show it honestly. Explain that the source needs adult confirmation. Do not describe source matching as state certification.

## 0:45–1:10 Show the new interactive aides

Click **Interactive tools**. Keep the first generated question selected.

For fraction bars:

1. Point to the two original fractional amounts.
2. Click **Split both bars into …ths**.
3. Count the shaded small pieces and enter those counts.
4. Click **Check and combine**.
5. Click **Regroup and show the mixed number**.

Then select the number-line tool and move its marker.

Say:

> “These are interactive versions of this lesson’s actual problems. Students can rename the fractions, combine equal-sized pieces, and see why regrouping works. The number line gives them another way to think about the same quantities.”

The system configures tested interactive components from generated lesson data. Do not claim it invents and deploys arbitrary new application code.

## 1:10–1:35 Prepare the substitute

Click **Substitute guide**. Show **Say**, **Show**, **Ask**, and **Look for**, then scroll to the videos found through You.com.

Say:

> “The substitute can prepare the evening before or that morning. There’s a short explanation, a worked example, common mistakes to watch for, and relevant videos to preview.”

Click **Interactive tools → Presentation mode** briefly, then **Close presentation**. Rehearsal does not create student attempts.

Optional coverage shot: click **Coverage & notices**, show the administrator notice and invitation outbox, open an invitation, and click **Accept this assignment**. That opens the assigned substitute preparation view. For a live email shot, click **Send pending emails through One** and show the Gmail receipt. For sandbox, keep its unsent status visible.

## 1:35–1:50 Publish and start class

Return to the teacher plan. Review the lesson, select the review checkbox, and click **Publish this lesson pack**. Click **Start Math period**.

Say:

> “Once the lesson is reviewed, the substitute starts the class. The classroom uses this published pack, so the preparation and the student work stay connected.”

Keep the dashboard tab open. Scan its QR code on the phone, or use **Open student view** in another tab.

## 1:50–2:30 Student practice and support

Join as **Seat 1**. Show a generated practice question and its tools. Enter a deliberately wrong answer, such as `0` when the correct answer is nonzero. Click **Check my answer**.

Switch back to the dashboard. Wait up to two seconds for the student to be flagged. Show the coaching card.

Return to the student view. Use the fraction model or ask Parasail:

> “How do I find a common denominator for this question?”

Show the tutor response above the composer. If the provider is busy, continue with the working local model; do not repeatedly resubmit. You can also send **“Could you check my first step?”** to the substitute, then show it under **Messages from the room**.

Say:

> “Students get practice and support. The substitute gets a live picture of who needs help, with a concrete way to respond. This is more useful than an unattended worksheet.”

Optional: start the simulated students. Their **SIM** badges must stay visible. Pause them before the closing shot.

## 2:30–2:50 End with the handoff

On the dashboard, click **End period & prepare handoff**. Show the progress table, follow-up group, and saved messages.

Say:

> “The returning teacher gets a record of what students practiced, what they solved, and where they need follow-up. The day leaves useful evidence, not just ‘they were fine.’”

The current report is generated and downloadable. Do not claim automatic teacher/principal email delivery.

## Closing line

> “As a former teacher, I know how much it costs to lose a day of instruction. SuperSubstitute helps that day still count.”

## Topic choices for this submission

Use **mixed-number addition, mixed-number subtraction, decimals, or rectangle area/perimeter** for the main recording. Live generation passed for these topics. Multiplication generated and passed its classroom handoff, with adult source review required in the checked run.

The app also includes division and volume components. Their first compact live runs hit provider rate limits. Treat them as additional supported test cases until a later run completes, not the critical path for your recording.

The `/prep-lab` view lets you select the math scenarios without changing code. Use one live generation at a time near the deadline.
