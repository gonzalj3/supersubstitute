import type { AbsenceRecord, LessonPack, AbsenceInput } from "./prep-types";
import { TOPIC_LABELS } from "./prep-types";
import { displayRational, formatAnswer } from "./math-engine";
import { mountLessonTools } from "./lesson-tools";
import scenarios from "../data/scenarios/prep-cases.json";
const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const ownerKey = (id: string) => `supersubstitute:absence:${id}`;
async function request(path: string, body?: unknown, token?: string) {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "The request could not complete.");
  return data;
}
function topics(selected = "auto") {
  return `<option value="auto">Detect from my lesson note</option>${Object.entries(
    TOPIC_LABELS,
  )
    .map(
      ([id, label]) =>
        `<option value="${id}" ${id === selected ? "selected" : ""}>${esc(label)}</option>`,
    )
    .join("")}`;
}
export function startPreparationUI(
  app: HTMLElement,
  shell: { header: () => string; footer: () => string },
) {
  const params = new URLSearchParams(location.search),
    id = params.get("id"),
    access =
      params.get("access") ?? (id ? localStorage.getItem(ownerKey(id)) : null),
    inviteToken = params.get("token");
  let interval: ReturnType<typeof setInterval> | undefined,
    record: (AbsenceRecord & { role?: string }) | undefined,
    last = "",
    panel = "lesson",
    selectedTool = 0;
  const base = id ? `/api/absences/${id}` : "";
  const error = (message: string) => {
    let box = document.querySelector<HTMLElement>("#prep-error");
    if (!box) {
      box = document.createElement("div");
      box.id = "prep-error";
      box.className = "prep-alert";
      box.setAttribute("role", "alert");
      document.querySelector(".prep-main")?.prepend(box);
    }
    box.textContent = message;
    box.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const layout = (body: string) => {
    app.innerHTML = `${shell.header()}<main class="prep-main"><nav class="prep-nav"><a href="/">← Home</a><a href="/plan">Report an absence</a><a href="/prep-lab">Math preparation lab</a></nav>${body}</main>${shell.footer()}`;
  };
  function savedPlans() {
    const ids = JSON.parse(
      localStorage.getItem("supersubstitute:absence-list") ?? "[]",
    ) as { id: string; title: string }[];
    return ids.length
      ? `<section class="saved-plans"><h2>Your recent plans</h2>${ids
          .slice(-8)
          .reverse()
          .map(
            (r) =>
              `<a href="/absence?id=${r.id}">${esc(r.title)} <span>Open →</span></a>`,
          )
          .join("")}</section>`
      : "";
  }
  function form() {
    const lab = location.pathname === "/prep-lab";
    const reviseId = params.get("revise");
    layout(
      `<div class="prep-page-heading"><span class="eyebrow">${lab ? "MATH PREPARATION LAB" : "BEFORE THE SCHOOL DAY"}</span><h1>${lab ? "A different topic. The same support." : "The day ahead, taken care of."}</h1><p>${lab ? "Run different math objectives through the same live preparation pipeline. Notifications stay in the sandbox outbox." : "Tell us what tomorrow was going to look like. We’ll prepare practice, interactive tools, and a clear guide for the substitute."}</p></div>${lab ? `<section class="scenario-picker"><label for="scenario">Load a test scenario</label><select id="scenario"><option value="">Choose a math scenario…</option>${scenarios.cases.map((c, i) => `<option value="${i}">${esc(c.id.replaceAll("-", " "))}</option>`).join("")}</select><p>Live You.com and Parasail calls. Results expose validation failures; no fake generated packs.</p></section>` : ""}<form id="absence-form" class="absence-form"><section><span class="eyebrow">01 · THE DAY</span><div class="form-grid"><label>Teacher label<input name="teacherLabel" value="Demo teacher" maxlength="80" required></label><label>School<input name="schoolLabel" value="Demo elementary" maxlength="100" required></label><label>Absence date<input type="date" name="date" value="${tomorrow()}" required></label><label>School timezone<select name="timezone"><option>America/Los_Angeles</option><option>America/Denver</option><option>America/Chicago</option><option>America/New_York</option></select></label><label>Grade<select name="grade">${[3, 4, 5, 6, 7, 8].map((g) => `<option value="${g}" ${g === 5 ? "selected" : ""}>Grade ${g}${g > 5 ? " (not supported in this pilot)" : ""}</option>`).join("")}</select></label><label>State<select name="state"><option value="CA">California</option><option value="TX">Texas</option></select></label></div><label>Class periods <small>One per line: name | start | end, in 24-hour school time.</small><textarea name="periods" rows="2" required>Math period | 09:00 | 09:45</textarea></label></section><section><span class="eyebrow">02 · THE LEARNING</span><label>Math topic<select name="topic">${topics()}</select></label><label>What were students going to learn?<textarea name="objective" rows="4" required minlength="8" maxlength="2000" placeholder="Students will add mixed numbers with unlike denominators. They know equivalent fractions, but need help regrouping.">Students will add mixed numbers with unlike denominators and explain the sum with fraction models.</textarea></label><label>Curriculum reference <small>Optional unit, lesson, or public curriculum reference. Do not include private records.</small><input name="curriculumRef" maxlength="500" placeholder="e.g. Grade 5, fraction addition unit"></label><label>Your questions <small>Optional. One numeric expression per line, with an optional answer after =. We preserve your questions and check their answers. Leave empty to generate 4 questions.</small><textarea name="teacherQuestions" rows="3" maxlength="6000" placeholder="2 1/3 + 1 3/4 = 4 1/12"></textarea></label></section><section><span class="eyebrow">03 · COVERAGE</span><div class="prep-info">Administrator notices and substitute invitations are saved in the app. Turn off sandbox mode to enable sending through One and Gmail from Coverage & notices.</div><label>Teacher email <small>Receives the end-of-day report.</small><input type="email" name="teacherEmail" placeholder="teacher@example.com"></label><label>Administrator email <small>Receives notices and the end-of-day report.</small><input type="email" name="administratorEmail" placeholder="administrator@example.com"></label><label>Available substitutes <small>Optional. One per line: label | email. Only add school-approved contacts available for all periods. Availability is school-declared, not a calendar lookup.</small><textarea name="substitutes" rows="2" placeholder="Demo substitute | "></textarea></label><label class="checkbox-label"><input type="checkbox" name="sandbox" checked ${lab ? "disabled" : ""}> Sandbox notifications (no external messages)</label></section><label class="checkbox-label"><input type="checkbox" name="agentReview"> Add specialist agent review (slower; requires the CrewAI service)</label><div class="prep-submit"><button class="primary" id="prepare-button">Prepare my substitute day <span>↗</span></button><p>Generation usually takes 30–120 seconds. You can leave the page; the preparation job continues.</p></div></form>${savedPlans()}`,
    );
    if (lab)
      document
        .querySelector("#scenario")!
        .addEventListener("change", (event) => {
          const value = (event.target as HTMLSelectElement).value;
          if (value === "") return;
          const scenario = scenarios.cases[Number(value)],
            input = { ...scenarios.defaults, ...scenario.input } as any;
          const form =
            document.querySelector<HTMLFormElement>("#absence-form")!;
          for (const name of [
            "teacherLabel",
            "schoolLabel",
            "grade",
            "state",
            "objective",
            "topic",
          ]) {
            const field = form.elements.namedItem(name) as
              HTMLInputElement | HTMLSelectElement;
            if (field && input[name] !== undefined)
              field.value = String(input[name]);
          }
          (form.elements.namedItem("topic") as HTMLSelectElement).value =
            input.topic ?? "auto";
          (form.elements.namedItem("timezone") as HTMLSelectElement).value =
            input.schoolTimezone ?? "America/Los_Angeles";
          (
            form.elements.namedItem("teacherQuestions") as HTMLTextAreaElement
          ).value = (input.teacherQuestions ?? [])
            .map((q: any) => q.prompt + (q.answer ? " = " + q.answer : ""))
            .join("\n");
        });
    document
      .querySelector("#absence-form")!
      .addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.target as HTMLFormElement,
          fd = new FormData(form),
          button =
            document.querySelector<HTMLButtonElement>("#prepare-button")!;
        button.disabled = true;
        button.textContent = "Saving the day…";
        try {
          const grade = Number(fd.get("grade"));
          const input = {
            teacherLabel: String(fd.get("teacherLabel")),
            schoolLabel: String(fd.get("schoolLabel")),
            date: String(fd.get("date")),
            timezone: String(fd.get("timezone")),
            grade,
            state: String(fd.get("state")),
            topic: String(fd.get("topic")),
            objective: String(fd.get("objective")),
            curriculumRef: String(fd.get("curriculumRef")),
            teacherQuestions: String(fd.get("teacherQuestions")),
            teacherEmail: String(fd.get("teacherEmail")),
            administratorEmail: String(fd.get("administratorEmail")),
            sandbox: lab || fd.get("sandbox") === "on",
            agentReview: fd.get("agentReview") === "on",
            periods: String(fd.get("periods"))
              .split("\n")
              .filter((s) => s.trim())
              .map((line, i) => {
                const [label, start, end] = line
                  .split("|")
                  .map((s) => s.trim());
                return { id: `period-${i + 1}`, label, start, end };
              }),
            substitutes: String(fd.get("substitutes"))
              .split("\n")
              .filter((s) => s.trim())
              .map((line, i) => {
                const [label, email = ""] = line
                  .split("|")
                  .map((s) => s.trim());
                return {
                  id: `sub-${
                    label
                      .toLowerCase()
                      .replace(/[^a-z0-9]/g, "")
                      .slice(0, 30) || i
                  }`,
                  label,
                  email,
                  available: true,
                  grades: [grade],
                };
              }),
          };
          if (reviseId) {
            await request(
              `/api/absences/${reviseId}/revise`,
              { input },
              localStorage.getItem(ownerKey(reviseId)) ?? undefined,
            );
            location.href = `/absence?id=${reviseId}`;
            return;
          }
          const created = await request("/api/absences", input);
          localStorage.setItem(ownerKey(created.id), created.ownerToken);
          localStorage.setItem(
            `${ownerKey(created.id)}:admin`,
            created.adminToken,
          );
          const list = JSON.parse(
            localStorage.getItem("supersubstitute:absence-list") ?? "[]",
          );
          list.push({
            id: created.id,
            title: `${input.date} · ${input.objective.slice(0, 60)}`,
          });
          localStorage.setItem(
            "supersubstitute:absence-list",
            JSON.stringify(list.slice(-20)),
          );
          location.href = `/absence?id=${created.id}`;
        } catch (e) {
          error((e as Error).message);
          button.disabled = false;
          button.textContent = "Prepare my substitute day ↗";
        }
      });
    if (reviseId) {
      void request(
        `/api/absences/${reviseId}/get`,
        undefined,
        localStorage.getItem(ownerKey(reviseId)) ?? undefined,
      )
        .then((previous) => {
          const form =
            document.querySelector<HTMLFormElement>("#absence-form")!;
          for (const name of [
            "teacherLabel",
            "schoolLabel",
            "date",
            "timezone",
            "grade",
            "state",
            "topic",
            "objective",
            "curriculumRef",
            "teacherQuestions",
            "teacherEmail",
            "administratorEmail",
          ]) {
            const field = form.elements.namedItem(name) as HTMLInputElement;
            if (field) field.value = String(previous.input[name] ?? "");
          }
          (form.elements.namedItem("periods") as HTMLTextAreaElement).value =
            previous.input.periods
              .map((p: any) => `${p.label} | ${p.start} | ${p.end}`)
              .join("\n");
          (
            form.elements.namedItem("substitutes") as HTMLTextAreaElement
          ).value = previous.input.substitutes
            .map((s: any) => `${s.label} | ${s.email}`)
            .join("\n");
          (form.elements.namedItem("sandbox") as HTMLInputElement).checked =
            previous.input.sandbox;
          document.querySelector("#prepare-button")!.textContent =
            "Save revision and prepare again ↗";
        })
        .catch((e) => error(e.message));
    }
  }
  function evidence(pack: LessonPack) {
    return `<section class="prep-card"><span class="eyebrow">STATE GUIDANCE</span><h2>${esc(pack.state)} · ${esc(pack.standard.code)}</h2><div class="prep-info">${pack.validation.alignment ? "The quoted passage matches retrieved official source content. Adult review is still required." : "Alignment needs adult review. Inspect the source and confirm that this lesson meets your intended state objective."}</div>${pack.standard.evidenceQuote ? `<blockquote>${esc(pack.standard.evidenceQuote)}</blockquote>` : ""}${pack.sources.map((source) => `<a class="source-link" href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.title)} ↗</a><small class="source-meta">${source.contentVerified ? "Contents retrieved" : "Search excerpt only"} · ${new Date(source.retrievedAt).toLocaleDateString()}</small>`).join("")}</section>`;
  }
  function guide(pack: LessonPack) {
    return `<section class="prep-card"><span class="eyebrow">YOUR FIVE-MINUTE PREPARATION</span><h2>Walk in with a plan.</h2><p>${esc(pack.guide.overview)}</p><div class="guide-schedule">${pack.guide.schedule.map((s) => `<span><strong>${s.minutes} min</strong> ${esc(s.title)}</span>`).join("")}</div>${pack.guide.steps
      .map(
        (s, i) =>
          `<article class="guide-step"><h3>Step ${i + 1}</h3>${[
            ["Say", s.say],
            ["Show", s.show],
            ["Ask", s.ask],
            ["Look for", s.lookFor],
          ]
            .map(
              ([label, text]) =>
                `<div><strong>${label}</strong><p>${esc(text)}</p></div>`,
            )
            .join("")}</article>`,
      )
      .join(
        "",
      )}<h3>When students get stuck</h3>${pack.guide.misconceptions.map((m) => `<div class="guide-misconception"><strong>${esc(m.title)}</strong><p>${esc(m.action)}</p></div>`).join("")}<div class="prep-info">Without devices: draw the same model on the board, work one example together, and use the practice questions below on paper.</div><button class="secondary" type="button" data-action="print">Print guide and questions ↓</button></section><section class="prep-card"><span class="eyebrow">VIDEOS FOUND WITH YOU.COM</span><h2>Preview another explanation.</h2><p>Topic-matched search results, not transcript-vetted recommendations. Preview before sharing.</p>${pack.videos.length ? pack.videos.map((v) => `<article class="video-result"><a href="${esc(v.url)}" target="_blank" rel="noopener"><img src="${esc(v.thumbnail)}" alt="" loading="lazy"><span>${esc(v.title)} ↗</span></a><p>${esc(v.description)}</p></article>`).join("") : "<p>Video discovery was unavailable for this run. You can search from the live classroom.</p>"}</section>`;
  }
  function coverage(r: AbsenceRecord & { role?: string }) {
    const adminToken = localStorage.getItem(`${ownerKey(r.id)}:admin`);
    const reportSettings = r.reportDelivery ?? {
      teacherEmail: r.input.teacherEmail ?? "",
      administratorEmail: r.input.administratorEmail,
      enabled: !r.input.sandbox,
    };
    const reportPanel = `<section class="prep-card"><span class="eyebrow">AFTER THE DAY</span><h2>Keep the teacher and administrator informed.</h2><p>The summary includes recorded progress, sticking points, and follow-up seats across every planned period. It sends when the last period is closed. These settings apply only to report emails.</p><label>Teacher report email<input type="email" id="report-teacher-email" value="${esc(reportSettings.teacherEmail)}"></label><label>Administrator report email<input type="email" id="report-admin-email" value="${esc(reportSettings.administratorEmail)}"></label><label class="checkbox-label"><input type="checkbox" id="report-enabled" ${reportSettings.enabled ? "checked" : ""}> Automatically email the final day report through One/Gmail</label><button type="button" class="secondary" data-action="report-settings">Save report delivery settings</button><p>${Object.keys(r.periodReports ?? {}).length} of ${r.input.periods.length} periods closed.</p>${Object.entries(
      r.periodReports ?? {},
    )
      .map(
        ([key, p]) =>
          `<article><strong>${esc(r.input.periods.find((period) => period.id === key)?.label ?? key)}</strong><p>${esc(p.narrative)}</p></article>`,
      )
      .join("")}</section>`;
    return `<section class="prep-card"><span class="eyebrow">COVERAGE IS INDEPENDENT OF PREPARATION</span><h2>${r.assigned ? `${esc(r.assigned.label)} accepted the day.` : "Waiting for a substitute."}</h2><p>${r.input.periods.map((p) => `${esc(p.label)} · ${p.start}–${p.end}`).join("<br>")} · ${esc(r.input.timezone)}</p>${!r.invitations.length ? '<div class="prep-info">No available substitute contacts were supplied. The lesson can still prepare and publish.</div>' : r.invitations.map((i) => `<div class="coverage-row"><div><strong>${esc(i.label)}</strong><span>${esc(i.status)}</span></div><a class="text-button" href="/invitation?id=${r.id}&token=${i.token}" target="_blank" rel="noopener">Open invitation ↗</a></div>`).join("")}${r.assigned ? `<a class="secondary" href="/substitute?id=${r.id}&access=${r.assigned.token}" target="_blank" rel="noopener">Assigned substitute preparation link ↗</a>` : ""}${adminToken ? `<a class="secondary" href="/coverage?id=${r.id}&access=${adminToken}" target="_blank" rel="noopener">Administrator workspace link ↗</a>` : ""}</section><section class="prep-card"><span class="eyebrow">NOTIFICATION OUTBOX</span><h2>Know what actually went out.</h2><p>${r.input.sandbox ? "Sandbox mode: these notices are captured in the app, not sent externally." : "Send pending notices through the connected Gmail account using One. Each recipient receives a private workspace or invitation link. Unknown or interrupted deliveries require checking Gmail before any resend."}</p>${!r.input.sandbox ? '<button class="primary" data-action="send-notices">Send pending emails through One ↗</button>' : ""}${r.outbox.map((m) => `<article class="outbox-message"><div><strong>${esc(m.subject)}</strong><span class="prep-status">${esc(m.status === "awaiting_connection" ? "pending" : m.status.replaceAll("_", " "))}</span></div><small>To: ${esc(m.recipient)}</small><p>${esc(m.text)}</p>${m.providerId ? `<small>Gmail receipt: ${esc(m.providerId)}</small>` : ""}</article>`).join("")}</section>${r.role === "substitute" ? "" : reportPanel}`;
  }
  function renderRecord(r: AbsenceRecord & { role?: string }) {
    record = r;
    const editable = r.role !== "substitute",
      pack = r.pack;
    const statusLabels: Record<string, string> = {
      queued: "Saved · waiting to begin",
      research: "Finding state guidance",
      design: "Designing the lesson",
      validation: "Checking math and tools",
      ready: "Ready for review",
      needs_review: "Review state alignment",
      published: "Published · ready for class",
      failed: "Needs attention",
      unsupported: "Topic not supported",
      canceled: "Canceled",
    };
    layout(
      `<div class="prep-page-heading"><span class="eyebrow">${r.role === "substitute" ? "SUBSTITUTE PREPARATION" : r.role === "administrator" ? "ADMINISTRATOR WORKSPACE" : "YOUR SUBSTITUTE DAY"}</span><div class="prep-title-row"><h1>${esc(pack?.title ?? "A little preparation. A better day.")}</h1><span class="prep-status ${r.phase === "published" ? "ready" : ""}">${statusLabels[r.phase] ?? r.phase}</span></div><p>${esc(r.input.teacherLabel)} · ${esc(r.input.schoolLabel)} · ${r.input.date} · Grade ${r.input.grade} · ${r.input.state}</p><p>${esc(r.input.objective)}</p></div>${r.error ? `<div class="prep-alert">${esc(r.error)}</div>` : ""}${!pack ? `<section class="prep-card preparation-progress"><div class="prep-spinner ${["failed", "unsupported", "canceled"].includes(r.phase) ? "stopped" : ""}">✳</div><h2>${statusLabels[r.phase]}</h2><p>The durable job continues if you leave this page. Coverage invitations do not wait for lesson generation.</p><ol>${r.events.map((e) => `<li><span>${new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>${esc(e.message)}</li>`).join("")}</ol></section>` : ""}<div class="prep-tab-bar" role="group" aria-label="Preparation sections">${[
        ["lesson", "Lesson pack"],
        ["tools", "Interactive tools"],
        ["guide", "Substitute guide"],
        ["coverage", "Coverage & notices"],
      ]
        .map(
          ([key, label]) =>
            `<button type="button" data-panel="${key}" class="${panel === key ? "active" : ""}" aria-pressed="${panel === key}">${label}</button>`,
        )
        .join(
          "",
        )}</div><div data-prep-panel="lesson" ${panel === "lesson" ? "" : "hidden"}>${pack ? `${evidence(pack)}<section class="prep-card"><span class="eyebrow">${r.input.teacherQuestions.trim() ? "TEACHER QUESTIONS · PRESERVED" : "GENERATED PRACTICE · ANSWERS CHECKED IN CODE"}</span><h2>Practice with a purpose.</h2><div class="prepared-questions">${pack.items.map((item, i) => `<article><span>${i + 1}</span><div><strong>${esc(item.prompt)}</strong><small>${esc(item.skill)} · ${item.origin}</small><details><summary>Answer and worked steps</summary><p>${esc(formatAnswer(item))} ${esc(item.unit ?? "")}</p><ol>${item.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></details></div></article>`).join("")}</div><div class="prep-info">${pack.tools.length} interactive tools · exact arithmetic passed · ${pack.orchestrator === "crewai" ? "CrewAI orchestration" : "Cloudflare preparation pipeline; CrewAI service not connected"}</div></section>` : '<section class="prep-card"><h2>Your lesson pack appears here.</h2><p>We will preserve supplied questions or generate practice when none were supplied, then build two interactive tools.</p></section>'}</div><div data-prep-panel="tools" ${panel === "tools" ? "" : "hidden"}><section class="prep-card"><div class="section-heading"><div><span class="eyebrow">REHEARSE WITHOUT STUDENT ATTEMPTS</span><h2>Try the same tools students will use.</h2></div><button class="secondary" type="button" data-action="present">Presentation mode ↗</button></div><div id="pack-tools">${pack ? "" : "Tools will appear after validation."}</div></section></div><div data-prep-panel="guide" ${panel === "guide" ? "" : "hidden"}>${pack ? guide(pack) : '<section class="prep-card"><h2>Your substitute guide is on its way.</h2></section>'}</div><div data-prep-panel="coverage" ${panel === "coverage" ? "" : "hidden"}>${coverage(r)}</div><section class="prep-actions">${pack && editable && ["ready", "needs_review"].includes(r.phase) ? `<label class="checkbox-label"><input id="reviewed" type="checkbox"> I reviewed the questions, tools, and cited state guidance for this class.</label><button class="primary" type="button" data-action="publish">Publish this lesson pack ↗</button>` : ""}${r.phase === "published" ? `<h2>Ready when the room is.</h2>${r.input.periods.map((p) => `<button class="primary" type="button" data-action="start" data-period="${p.id}">Start ${esc(p.label)} · ${p.start} ↗</button>`).join("")}` : ""}${editable && r.phase !== "canceled" ? `<div class="prep-secondary-actions"><a class="secondary" href="/plan?revise=${r.id}">Edit absence details</a><button class="secondary" type="button" data-action="retry">Prepare a new revision ↻</button><button class="text-button" type="button" data-action="cancel">Cancel this absence</button></div>` : ""}</section><dialog id="presentation-dialog"><button type="button" class="secondary" data-action="dismiss">Close presentation ×</button><div id="presentation-tool"></div></dialog>`,
    );
    if (pack)
      mountLessonTools(
        document.querySelector<HTMLElement>("#pack-tools")!,
        pack.items,
        pack.tools,
      );
  }
  async function refresh() {
    if (!id || !access) {
      layout(
        '<div class="prep-page-heading"><h1>Open your saved plan.</h1><p>Use the browser that created the absence, or your authorized preparation link.</p></div>' +
          savedPlans(),
      );
      return;
    }
    try {
      const r = await request(`${base}/get`, undefined, access),
        signature = JSON.stringify(r);
      if (signature !== last) {
        last = signature;
        renderRecord(r);
      }
    } catch (e) {
      error((e as Error).message);
    }
  }
  async function invitation() {
    layout(
      '<section class="prep-card"><h1>Coverage invitation</h1><div id="invitation-content">Loading invitation…</div></section>',
    );
    try {
      const info = await request(
        `${base}/invitation?token=${encodeURIComponent(inviteToken ?? "")}`,
      );
      document.querySelector("#invitation-content")!.innerHTML =
        `<h2>Hello, ${esc(info.label)}.</h2><p>${esc(info.teacher)} needs coverage at ${esc(info.school)} on ${info.date}.</p><p>Grade ${info.grade} · ${info.periods.map((p: any) => `${esc(p.label)} ${p.start}–${p.end}`).join("<br>")} · ${esc(info.timezone)}</p><div class="prep-info">${info.status === "available" ? "Acceptance reserves all periods. We will check for other assignments before confirming." : "This day already has coverage."}</div><button class="primary" type="button" id="accept-invitation">Accept this assignment ↗</button>`;
      document
        .querySelector("#accept-invitation")!
        .addEventListener("click", async () => {
          try {
            const result = await request(`${base}/invitation`, {
              token: inviteToken,
            });
            location.href = `/substitute?id=${id}&access=${result.token}`;
          } catch (e) {
            error((e as Error).message);
          }
        });
    } catch (e) {
      error((e as Error).message);
    }
  }
  app.addEventListener("click", async (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "button",
    );
    if (!button) return;
    if (button.dataset.panel) {
      panel = button.dataset.panel;
      document
        .querySelectorAll<HTMLElement>("[data-prep-panel]")
        .forEach((el) => (el.hidden = el.dataset.prepPanel !== panel));
      document
        .querySelectorAll<HTMLButtonElement>("[data-panel]")
        .forEach((el) => {
          el.classList.toggle("active", el.dataset.panel === panel);
          el.setAttribute("aria-pressed", String(el.dataset.panel === panel));
        });
      return;
    }
    const action = button.dataset.action;
    if (!action || !record) return;
    if (action === "print") {
      document
        .querySelectorAll<HTMLElement>("[data-prep-panel]")
        .forEach((el) => (el.hidden = false));
      window.print();
      document
        .querySelectorAll<HTMLElement>("[data-prep-panel]")
        .forEach((el) => (el.hidden = el.dataset.prepPanel !== panel));
      return;
    }
    if (action === "present" && record.pack) {
      mountLessonTools(
        document.querySelector<HTMLElement>("#presentation-tool")!,
        record.pack.items,
        record.pack.tools,
        { presentation: true },
      );
      document
        .querySelector<HTMLDialogElement>("#presentation-dialog")!
        .showModal();
      return;
    }
    if (action === "dismiss") {
      document
        .querySelector<HTMLDialogElement>("#presentation-dialog")!
        .close();
      return;
    }
    if (
      ![
        "publish",
        "retry",
        "cancel",
        "start",
        "send-notices",
        "report-settings",
      ].includes(action)
    )
      return;
    if (
      action === "publish" &&
      !document.querySelector<HTMLInputElement>("#reviewed")?.checked
    ) {
      error("Review the lesson and confirm the checkbox before publishing.");
      return;
    }
    button.disabled = true;
    try {
      const result = await request(
        `${base}/${action}`,
        action === "report-settings"
          ? {
              teacherEmail: document
                .querySelector<HTMLInputElement>("#report-teacher-email")!
                .value.trim(),
              administratorEmail: document
                .querySelector<HTMLInputElement>("#report-admin-email")!
                .value.trim(),
              enabled:
                document.querySelector<HTMLInputElement>("#report-enabled")!
                  .checked,
            }
          : action === "publish"
            ? { reviewed: true }
            : action === "start"
              ? { periodId: button.dataset.period }
              : {},
        access ?? undefined,
      );
      if (action === "start") {
        localStorage.setItem(
          `supersubstitute:teacher:${result.id}`,
          result.adminToken,
        );
        location.href = `/?room=${result.id}`;
        return;
      }
      last = "";
      await refresh();
    } catch (e) {
      error((e as Error).message);
      button.disabled = false;
    }
  });
  if (location.pathname === "/invitation") void invitation();
  else if (id) {
    layout(
      '<div class="prep-page-heading"><h1>Opening your substitute day…</h1></div>',
    );
    void refresh();
    interval = setInterval(refresh, 2500);
  } else form();
  window.addEventListener("beforeunload", () => {
    if (interval) clearInterval(interval);
  });
}
