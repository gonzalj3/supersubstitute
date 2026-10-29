import QRCode from "qrcode";
import { startPreparationUI } from "./prep-ui";
import { mountLessonTools } from "./lesson-tools";
import { makeProblem, type MathProblem } from "./math-engine";
import type { Room } from "./domain";
import {
  initialFractionLab,
  mountFractionLab,
  mixedNumberQuestion,
} from "./fraction-lab";
import "./style.css";
type Seat = {
  id: string;
  label: string;
  simulated: boolean;
  correct: number;
  attempted: number;
  mastery: number;
  status: string;
  errorType: string | null;
  hintLevel: number;
};
type Snapshot = {
  lesson?: Room["lesson"] | null;
  integrations?: {
    you: boolean;
    parasail: boolean;
    crewai: boolean;
    one: boolean;
  };
  phase: string;
  createdAt: number;
  students: Seat[];
  clusters: { type: string; label: string; students: string[] }[];
  attempts: number;
  correct: number;
  items: number;
  report: any;
  messages: { id: string; label: string; text: string; at: number }[];
};
const app = document.querySelector<HTMLDivElement>("#app")!;
const params = new URLSearchParams(location.search),
  roomId = params.get("room");
const studentMode = location.pathname === "/student";
const key = roomId ? `supersubstitute:teacher:${roomId}` : "";
// Keep access to rooms created before the product rename.
let admin = key
  ? (localStorage.getItem(key) ??
    localStorage.getItem(`understudy:teacher:${roomId}`))
  : null;
if (key && admin) localStorage.setItem(key, admin);
let session = roomId
  ? JSON.parse(
      sessionStorage.getItem(`supersubstitute:student:${roomId}`) ??
        sessionStorage.getItem(`understudy:student:${roomId}`) ??
        "null",
    )
  : null;
if (roomId && session)
  sessionStorage.setItem(
    `supersubstitute:student:${roomId}`,
    JSON.stringify(session),
  );
let polling: ReturnType<typeof setInterval> | undefined,
  simTimer: ReturnType<typeof setInterval> | undefined;
let snapshot: Snapshot | null = null,
  lastFeedback = "",
  feedbackCorrect = false,
  busy = false;
let simStarting = false,
  simInFlight = false;
let fractionLabState = initialFractionLab();
const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
async function api(op: string, body?: unknown, token = admin) {
  const res = await fetch(`/api/rooms/${roomId}/${op}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data.error ?? "Could not connect");
  return data;
}
function toast(message: string) {
  let el = document.querySelector("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.setAttribute("role", "alert");
    document.body.append(el);
  }
  el.textContent = message;
  setTimeout(() => el?.remove(), 5500);
}
const mark = '<span class="brand-mark">S<span>↗</span></span>';
function header(student = false) {
  return `<header><a class="brand" href="/">${mark}<span>SuperSubstitute<span class="brand-dot">.</span></span></a><div class="header-right"><span class="demo-pill"><i></i> ${student ? "Practice room" : "Interactive demo"}</span><span class="avatar">${student ? "S" : "SB"}</span></div></header>`;
}
function footer() {
  return `<footer><span>A little support. A lot of possibility.</span><span>Built for the days that still count.</span></footer>`;
}
function landing() {
  app.innerHTML = `${header()}<main class="welcome"><div class="eyebrow">EVERY SCHOOL DAY COUNTS</div><h1>The teacher’s away.<br><em>The learning stays.</em></h1><p>Give every student a little support.<br>Give the substitute a clear picture of the room.</p><button class="primary" id="create">Open a practice room <span>↗</span></button><div class="welcome-note">Grade 5 · Fractions & mixed numbers · No API keys needed</div><div class="preview-strip"><div><span>01</span><h3>Practice with support</h3><p>Small steps when a student gets stuck.</p></div><div><span>02</span><h3>See the room clearly</h3><p>Know who needs you, and how to help.</p></div><div><span>03</span><h3>Leave a useful handoff</h3><p>A record of progress for the returning teacher.</p></div></div><div class="honesty">DEMO MODE <span>Exact arithmetic and a local hint library. Partner services are not connected yet.</span></div></main>${footer()}`;
  document
    .querySelector("#create")!
    .insertAdjacentHTML(
      "beforebegin",
      '<div class="home-prep-actions"><a href="/plan" class="primary">Prepare a substitute day ↗</a><a href="/prep-lab" class="secondary">Try different math topics ↗</a></div>',
    );
  document.querySelector<HTMLButtonElement>("#create")!.textContent =
    "Or open the original fraction demo ↗";
  document
    .querySelector("#create")!
    .classList.replace("primary", "text-button");
  document.querySelector(".honesty")!.innerHTML =
    "LIVE MATH PREPARATION <span>You.com evidence · Parasail lesson design · Preview and validate before class.</span>";
  document.querySelector("#create")!.addEventListener("click", async () => {
    const b = document.querySelector<HTMLButtonElement>("#create")!;
    b.disabled = true;
    b.textContent = "Opening your room…";
    try {
      const res = await fetch("/api/rooms", { method: "POST" });
      if (!res.ok) throw new Error("Could not create room");
      const data = (await res.json()) as any;
      localStorage.setItem(
        `supersubstitute:teacher:${data.id}`,
        data.adminToken,
      );
      location.href = `/?room=${data.id}`;
    } catch (e) {
      toast((e as Error).message);
      b.disabled = false;
      b.textContent = "Open a practice room ↗";
    }
  });
}
async function dashboard() {
  if (!admin) {
    app.innerHTML = `${header()}<main class="welcome"><h1>This is the room’s<br><em>teacher view.</em></h1><p>Open this link in the browser that created the room,<br>or join as a student below.</p><a class="primary" href="/student?room=${esc(roomId)}">Join practice ↗</a></main>`;
    return;
  }
  app.innerHTML = `${header()}<div class="workspace"><aside class="sidebar"><div class="sidebar-label">YOUR WORKSPACE</div><a class="nav active" href="/?room=${esc(roomId)}"><span>▦</span> Live classroom <i></i></a><button class="nav" id="handoff-nav"><span>↗</span> Teacher handoff</button><div class="sidebar-bottom"><div class="mini-book">A good day,<br><em>even on an away day.</em></div><span class="sidebar-label">SUPERSUBSTITUTE / DEMO 01</span></div></aside><main class="dashboard"><div class="page-heading"><div><div class="eyebrow">SUBSTITUTE WORKSPACE <span>/</span> ROOM 05</div><h1>A day of progress<span class="brand-dot">.</span></h1><p>Keep the room moving. We’ll help you see where to step in.</p></div><div class="period"><span class="live-dot"></span><span id="phase">Period in progress</span><small id="elapsed"></small></div></div><div class="lesson-bar"><span class="lesson-icon">½</span><div class="lesson-meta"><strong>Fractions, one step at a time</strong><span class="lesson-description">Grade 5 <b>·</b> Add & subtract mixed numbers <b>·</b> CA 5.NF.A.1</span></div><a href="https://www.thecorestandards.org/Math/Content/5/NF/" target="_blank" rel="noopener">Reference standard ↗</a></div><div class="metrics" id="metrics"></div><div class="dashboard-grid"><div class="main-column"><section class="panel"><div class="section-heading"><div><span class="eyebrow">THE ROOM, RIGHT NOW</span><h2>Every seat has a story</h2></div><span class="muted" id="refresh-status">Updates every 2s</span></div><div class="seat-grid" id="seats"></div><div class="legend"><span><i class="dot green"></i> Making progress</span><span><i class="dot amber"></i> Could use a hand</span><span><i class="dot gray"></i> Ready to begin</span></div></section><section class="coach-section"><div class="section-heading"><div><span class="eyebrow">YOUR NEXT MOVE</span><h2>A little help goes a long way</h2></div><span class="small-tag">Rule-based coach</span></div><div id="coach"></div></section></div><div class="right-column"><section class="join-card"><span class="eyebrow">PULL UP A SEAT</span><h2>Let’s get everyone in.</h2><p>Scan the code on a phone to join this practice room.</p><div class="qr-wrap"><canvas id="qr" aria-label="QR code to join student practice"></canvas></div><a id="student-link" class="student-link" target="_blank" rel="noopener" href="/student?room=${esc(roomId)}">Open student view ↗</a><button id="copy" class="secondary">Copy join link <span>⧉</span></button><small>Seat labels only. No student names.</small></section><section class="simulation-card"><div class="section-heading"><h3>Bring the room to life</h3><span class="small-tag">SIMULATION</span></div><p>Add six demo students. Their answers use the same grading and room state as live practice.</p><button class="secondary" id="simulate">Start simulated students <span>▶</span></button></section><section class="handoff-card"><span class="eyebrow">FOR THE TEACHER</span><h3>More than “they were fine.”</h3><p>Close the period to capture progress, sticking points, and a follow-up group.</p><button class="text-button" id="close">End period & prepare handoff ↗</button></section></div></div><div class="integration-bar"><span class="eyebrow">PARTNER CONNECTIONS</span><span>You.com <i>Pending</i></span><span>Parasail <i>Pending</i></span><span>CrewAI <i>Pending</i></span><span>One <i>Pending</i></span></div><div class="footnote">Demo mode · Authored practice & hints · Reference source, not live research · No emails sent</div></main></div>${footer()}<dialog id="report-dialog"><div id="report"></div><button class="secondary" id="dismiss">Back to classroom</button></dialog>`;
  const joinURL = `${location.origin}/student?room=${roomId}`;
  document
    .querySelector(".coach-section")!
    .insertAdjacentHTML(
      "beforeend",
      `<form class="video-search" id="video-search"><label for="video-query">Find another way to explain it</label><p>You.com searches YouTube for worked-example videos. Preview a video before sharing it with the room.</p><div><input id="video-query" name="topic" value="adding mixed numbers with unlike denominators" maxlength="200" required><button class="secondary" type="submit">Find videos with You.com ↗</button></div><small>Search lesson topics only—no student names or work.</small><div id="video-results" aria-live="polite"></div><a id="youtube-fallback" class="video-link" href="https://www.youtube.com/results?search_query=grade%205%20adding%20mixed%20numbers%20worked%20example" target="_blank" rel="noopener">Or search directly on YouTube ↗</a></form>`,
    );
  document
    .querySelector("#video-search")!
    .addEventListener("submit", (event) => {
      event.preventDefault();
      void findVideos(
        document.querySelector<HTMLInputElement>("#video-query")!.value,
      );
    });
  document.querySelector("#coach")!.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "button[data-video-topic]",
    );
    if (button?.dataset.videoTopic) void findVideos(button.dataset.videoTopic);
  });
  document
    .querySelector(".main-column")!
    .insertAdjacentHTML(
      "beforeend",
      `<section class="student-inbox"><div class="section-heading"><div><span class="eyebrow">A STUDENT HAS SOMETHING TO SAY</span><h2>Messages from the room</h2></div></div><div id="student-messages" aria-live="polite"></div></section>`,
    );
  await QRCode.toCanvas(document.querySelector("#qr"), joinURL, {
    width: 176,
    margin: 1,
    color: { dark: "#203e35", light: "#ffffff" },
  });
  document.querySelector("#copy")!.addEventListener("click", () =>
    navigator.clipboard
      .writeText(joinURL)
      .then(() => toast("Student link copied."))
      .catch(() => toast(joinURL)),
  );
  document.querySelector("#simulate")!.addEventListener("click", async () => {
    if (simStarting) return;
    if (simTimer) {
      clearInterval(simTimer);
      simTimer = undefined;
      updateSimulation();
      return;
    }
    simStarting = true;
    await simulate();
    simStarting = false;
    if (snapshot?.phase === "live") {
      simTimer = setInterval(simulate, 6500);
      updateSimulation();
    }
  });
  document.querySelector("#close")!.addEventListener("click", async () => {
    try {
      await api("close", {});
      if (simTimer) clearInterval(simTimer);
      simTimer = undefined;
      await refresh();
      showReport();
    } catch (e) {
      toast((e as Error).message);
    }
  });
  document
    .querySelector("#handoff-nav")!
    .addEventListener("click", () =>
      snapshot?.report
        ? showReport()
        : toast("End the period to prepare a handoff."),
    );
  document
    .querySelector("#dismiss")!
    .addEventListener("click", () =>
      document.querySelector<HTMLDialogElement>("#report-dialog")!.close(),
    );
  await refresh();
  polling = setInterval(refresh, 2000);
}
function updateSimulation() {
  const b = document.querySelector<HTMLButtonElement>("#simulate");
  if (b)
    b.textContent = simTimer
      ? "Pause simulated students Ⅱ"
      : "Start simulated students ▶";
}
async function simulate() {
  if (simInFlight) return;
  simInFlight = true;
  try {
    snapshot = await api("simulate", {});
    renderRoom();
  } catch (e) {
    if (simTimer) clearInterval(simTimer);
    simTimer = undefined;
    updateSimulation();
    toast((e as Error).message);
  } finally {
    simInFlight = false;
  }
}
async function refresh() {
  try {
    snapshot = await api("room");
    renderRoom();
    document.querySelector("#refresh-status")!.textContent =
      "● Updated just now";
  } catch (e) {
    document.querySelector("#refresh-status")!.textContent =
      "Connection interrupted · retrying";
  }
}
let lastCoachMarkup: string | undefined;
function videoTopic(type: string) {
  return type === "no_regrouping"
    ? "subtracting mixed numbers with regrouping"
    : type === "ignores_whole_number"
      ? "adding mixed numbers"
      : type === "adds_denominators"
        ? "adding fractions with unlike denominators"
        : "equivalent fractions and common denominators";
}
let videoBusy = false;
async function findVideos(topic: string) {
  if (videoBusy) return;
  topic = topic.trim();
  if (!topic) return;
  const input = document.querySelector<HTMLInputElement>("#video-query")!;
  input.value = topic;
  const results = document.querySelector<HTMLElement>("#video-results")!;
  const fallback =
    document.querySelector<HTMLAnchorElement>("#youtube-fallback")!;
  fallback.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(`grade 5 ${topic} worked example`)}`;
  results.textContent = "You.com is looking for example videos…";
  results.scrollIntoView({ behavior: "smooth", block: "center" });
  const button = document.querySelector<HTMLButtonElement>(
    "#video-search button",
  )!;
  videoBusy = true;
  button.disabled = true;
  try {
    const data = await api("videos", { topic });
    results.innerHTML = data.videos.length
      ? `<div class="video-source">FOUND WITH YOU.COM · YOUTUBE VIDEOS</div>${data.videos.map((video: { url: string; title: string; description: string; thumbnail: string }) => `<article class="video-result"><a href="${esc(video.url)}" target="_blank" rel="noopener"><img src="${esc(video.thumbnail)}" alt="" loading="lazy"><span>${esc(video.title)} <span aria-hidden="true">↗</span></span></a><p>${esc(video.description)}</p></article>`).join("")}`
      : "You.com found no matching YouTube videos. Try a broader lesson topic or the direct YouTube search below.";
  } catch (error) {
    results.textContent = (error as Error).message;
  } finally {
    videoBusy = false;
    button.disabled = false;
  }
}
function renderRoom() {
  if (!snapshot) return;
  const delivery = document.querySelector("#report-delivery");
  if (delivery && snapshot.report)
    delivery.textContent = snapshot.report.delivery;
  const r = snapshot,
    help = r.students.filter((s) => s.status === "needs-help").length,
    correct = r.students.reduce((n, s) => n + s.correct, 0),
    attempted = r.students.reduce((n, s) => n + s.attempted, 0);
  if (r.lesson) {
    const bar = document.querySelector(".lesson-bar")!;
    bar.querySelector("strong")!.textContent = r.lesson.title;
    bar.querySelector(".lesson-description")!.textContent =
      `Grade ${r.lesson.grade} · ${r.lesson.objective} · ${r.lesson.standard}`;
    const source = bar.querySelector("a")!;
    source.textContent = "State guidance ↗";
    source.href = r.lesson.sources[0]?.url ?? "#";
    document.querySelector(".footnote")!.textContent =
      "Prepared lesson · Exact answer checks · Published lesson version " +
      r.lesson.revision;
  }
  if (r.integrations) {
    const labels = document.querySelectorAll(
      ".integration-bar > span:not(.eyebrow) i",
    );
    labels[0].textContent = r.integrations.you
      ? "Video search ready"
      : "Pending";
    labels[1].textContent = r.integrations.parasail
      ? "Student help ready"
      : "Pending";
    labels[2].textContent = r.integrations.crewai
      ? "Specialist review ready"
      : "Not connected";
    labels[3].textContent = r.integrations.one
      ? "Gmail ready"
      : "Not connected";
  }
  const inbox = document.querySelector("#student-messages")!;
  const messageMarkup = (r.messages ?? []).length
    ? [...r.messages]
        .reverse()
        .map(
          (m) =>
            `<article class="student-message"><div><strong>${esc(m.label)}</strong><time>${new Date(m.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time></div><p>${esc(m.text)}</p></article>`,
        )
        .join("")
    : '<p class="inbox-empty">Students can send a question or ask for a check-in from their practice page. Messages will appear here.</p>';
  if (inbox.innerHTML !== messageMarkup) inbox.innerHTML = messageMarkup;
  document.querySelector("#metrics")!.innerHTML = [
    [
      "Students in the room",
      r.students.length,
      `${r.students.filter((s) => !s.simulated).length} live · ${r.students.filter((s) => s.simulated).length} simulated`,
      "▦",
    ],
    [
      "Could use a hand",
      help,
      help
        ? "A small check-in can make a difference"
        : "Everyone has room to get started",
      "↗",
    ],
    ["Items solved", correct, `${r.attempts} total answer attempts`, "✓"],
    [
      "Practice accuracy",
      attempted ? `${Math.round((correct / attempted) * 100)}%` : "—",
      "Solved / distinct items attempted",
      "◔",
    ],
  ]
    .map(
      ([label, value, note, icon]) =>
        `<div class="metric"><div><span>${label}</span><i>${icon}</i></div><strong>${value}</strong><small>${note}</small></div>`,
    )
    .join("");
  document.querySelector("#phase")!.textContent =
    r.phase === "closed" ? "Period complete" : "Period in progress";
  document.querySelector("#elapsed")!.textContent =
    `${Math.floor((Date.now() - r.createdAt) / 60000)} min of practice`;
  document.querySelector<HTMLButtonElement>("#close")!.textContent =
    r.phase === "closed"
      ? "View teacher handoff ↗"
      : "End period & prepare handoff ↗";
  document.querySelector<HTMLButtonElement>("#simulate")!.disabled =
    r.phase === "closed";
  document.querySelector("#seats")!.innerHTML = r.students.length
    ? r.students
        .map(
          (s, i) =>
            `<article class="seat ${s.status === "needs-help" ? "needs-help" : ""}"><div class="seat-top"><span class="seat-avatar">${String(i + 1).padStart(2, "0")}</span>${s.simulated ? '<span class="sim-tag">SIM</span>' : '<span class="live-tag">LIVE</span>'}<i class="dot ${s.status === "needs-help" ? "amber" : s.correct ? "green" : "gray"}"></i></div><strong>${esc(s.label)}</strong><span class="seat-status">${s.status === "needs-help" ? "Could use a hand" : s.status === "complete" ? "Practice complete" : s.status === "ready" ? "Ready to begin" : "Making progress"}</span><div class="progress-track"><span style="width:${(s.correct / r.items) * 100}%"></span></div><small>${s.correct} of ${r.items} solved ${s.hintLevel ? `<span>Hint ${s.hintLevel}/3</span>` : ""}</small></article>`,
        )
        .join("")
    : `<div class="empty-room"><span>✳</span><h3>A fresh start for the room.</h3><p>Invite students with the QR code, or start the labeled simulation.</p></div>`;
  const guidance: Record<string, string> = {
    adds_denominators:
      "The pieces need to be the same size before we add. Show how thirds and fourths both become twelfths.",
    ignores_whole_number:
      "Ask students to circle the whole numbers first, then add the fractional parts.",
    no_regrouping:
      "Show how to trade one whole for twelve twelfths before subtracting.",
    common_denominator:
      "Ask: “What number can both denominators divide into?” Then rename both fractions.",
    practice_step:
      "Ask the student to explain the last step they tried. Use a model or the worked examples in the substitute preparation guide.",
  };
  const workedExample = (type: string) =>
    type === "no_regrouping"
      ? "<p>3 1/4 − 1 2/3</p><ol><li>Rename: 3 3/12 − 1 8/12.</li><li>Trade one whole: 3 3/12 = 2 15/12.</li><li>Subtract: 2 15/12 − 1 8/12 = 1 7/12.</li></ol>"
      : "<p>2 1/3 + 1 3/4</p><ol><li>Add the wholes: 2 + 1 = 3.</li><li>Rename: 1/3 = 4/12; 3/4 = 9/12.</li><li>Combine: 3 + 13/12 = 4 1/12.</li></ol>";
  const coach = document.querySelector<HTMLElement>("#coach")!;
  const coachMarkup =
    r.lesson && r.clusters.length
      ? r.clusters
          .map(
            (c) =>
              `<article class="action-card"><div class="action-icon">↗</div><div><span class="action-label">CHECK IN WITH ${c.students.length} ${c.students.length === 1 ? "STUDENT" : "STUDENTS"}</span><h3>${esc(r.lesson!.title)}</h3><p>Ask the student to show their reasoning. Use the matching interactive model to make the step visible.</p><div class="seat-chips">${c.students.map((s) => `<span>${esc(s)}</span>`).join("")}</div><button type="button" class="video-link" data-video-topic="${esc(r.lesson!.objective)}">Find example videos with You.com ↗</button></div></article>`,
          )
          .join("")
      : r.clusters.length
        ? r.clusters
            .map(
              (c) =>
                `<article class="action-card"><div class="action-icon">↗</div><div><span class="action-label">CHECK IN WITH ${c.students.length} ${c.students.length === 1 ? "STUDENT" : "STUDENTS"}</span><h3>${esc(c.label)}</h3><p>${guidance[c.type]}</p><div class="seat-chips">${c.students.map((s) => `<span>${esc(s)}</span>`).join("")}</div><details data-example="${esc(c.type)}"><summary>Show a worked example</summary>${workedExample(c.type)}</details><button type="button" class="video-link" data-video-topic="${esc(videoTopic(c.type))}">Find example videos with You.com ↗</button></div></article>`,
            )
            .join("")
        : `<div class="all-clear"><span>✳</span><div><h3>${r.students.length ? "A little breathing room." : "Ready when they are."}</h3><p>When students get stuck, you’ll see a concrete way to help right here.</p></div></div>`;
  if (coachMarkup !== lastCoachMarkup) {
    const opened = new Set(
      Array.from(
        coach.querySelectorAll<HTMLDetailsElement>("details[open]"),
      ).map((details) => details.dataset.example),
    );
    const focusedExample = document.activeElement?.closest<HTMLDetailsElement>(
      "details[data-example]",
    )?.dataset.example;
    coach.innerHTML = coachMarkup;
    for (const details of coach.querySelectorAll<HTMLDetailsElement>(
      "details",
    )) {
      details.open = opened.has(details.dataset.example);
      if (focusedExample && details.dataset.example === focusedExample) {
        details.querySelector("summary")?.focus();
      }
    }
    lastCoachMarkup = coachMarkup;
  }
}
function showReport() {
  if (!snapshot?.report) return;
  const r = snapshot.report;
  document.querySelector("#report")!.innerHTML =
    `<span class="eyebrow">PERIOD COMPLETE · ${esc(r.standard)}</span><h2>A useful handoff.</h2><p>${esc(r.narrative)}</p><table><thead><tr><th>Seat</th><th>Solved</th><th>Accuracy</th></tr></thead><tbody>${r.students.map((s: Seat) => `<tr><td>${esc(s.label)} ${s.simulated ? "(SIM)" : ""}</td><td>${s.correct}/${s.attempted}</td><td>${s.attempted ? `${Math.round(s.mastery * 100)}%` : "—"}</td></tr>`).join("")}</tbody></table><h3>Suggested check-in group</h3><p>${
      r.students
        .filter((s: Seat) => s.status === "needs-help")
        .map((s: Seat) => esc(s.label))
        .join(", ") || "No students flagged at close."
    }</p><div class="honesty" id="report-delivery">${esc(r.delivery)}</div><button id="download" class="primary">Download handoff JSON ↓</button>`;
  if (r.messages?.length)
    document
      .querySelector("#report .honesty")!
      .insertAdjacentHTML(
        "beforebegin",
        `<h3>Messages for the teacher</h3>${r.messages.map((m: { label: string; text: string }) => `<div class="student-message"><strong>${esc(m.label)}</strong><p>${esc(m.text)}</p></div>`).join("")}`,
      );
  document.querySelector("#download")!.addEventListener("click", () => {
    const u = URL.createObjectURL(
      new Blob([JSON.stringify(r, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = u;
    a.download = "supersubstitute-handoff.json";
    a.click();
    URL.revokeObjectURL(u);
  });
  document.querySelector<HTMLDialogElement>("#report-dialog")!.showModal();
}
async function student() {
  if (!roomId) {
    location.href = "/";
    return;
  }
  app.innerHTML = `${header(true)}<main class="student-main"><div class="eyebrow">GRADE 5 · FRACTION PRACTICE</div><div id="practice"></div><div class="student-note"><span>✳</span> Learning takes practice. You’re in the right place.</div><div class="footnote">Demo tutor · Local hint library · No AI service connected</div></main>${footer()}`;
  if (!session) {
    document.querySelector("#practice")!.innerHTML =
      `<h1>Pull up a seat<span class="brand-dot">.</span></h1><p>Let’s make a little progress today.</p><form id="join-form" class="practice-card"><label for="seat">Your seat label</label><input id="seat" name="seat" placeholder="e.g. Seat 7" maxlength="24" required autocomplete="off"><small>Use a seat number or nickname, not your real name.</small><button class="primary">Let’s get started ↗</button></form>`;
    document
      .querySelector("#join-form")!
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        if (busy) return;
        busy = true;
        try {
          session = await api(
            "join",
            {
              label: (document.querySelector("#seat") as HTMLInputElement)
                .value,
            },
            null,
          );
          sessionStorage.setItem(
            `supersubstitute:student:${roomId}`,
            JSON.stringify(session),
          );
          await loadItem();
        } catch (e) {
          toast((e as Error).message);
        } finally {
          busy = false;
        }
      });
  } else await loadItem();
}
async function loadItem() {
  try {
    const data = await api(
      `student?id=${session.id}`,
      undefined,
      session.token,
    );
    const container = document.querySelector("#practice")!;
    renderSupport(Boolean(data.tutorAvailable));
    if (data.lesson) {
      document.querySelector(".student-main > .eyebrow")!.textContent =
        `GRADE ${data.lesson.grade} · ${data.lesson.title.toUpperCase()}`;
    }
    if (data.phase === "closed" || !data.item) {
      container.innerHTML = `<h1>${data.phase === "closed" ? "That’s a wrap." : "Look at you go."}</h1><div class="practice-card completion"><span>✳</span><h2>${data.phase === "closed" ? "Your practice is saved." : "You finished the practice!"}</h2><p>You solved ${data.index} of ${data.total} questions. Every step counts.</p></div>`;
      return;
    }
    container.innerHTML = `<div class="student-title"><h1>One step at a time<span class="brand-dot">.</span></h1><span>${esc(session.label)}</span></div><p>You’ve got this. A hint is here if you need one.</p><div class="question-progress"><span>QUESTION ${data.index + 1} OF ${data.total}</span><span>${esc(data.item.skill)}</span></div><div class="progress-track"><span style="width:${(data.index / data.total) * 100}%"></span></div><form id="answer-form" class="practice-card"><div class="eyebrow">FIND THE SUM OR DIFFERENCE</div><div class="equation">${esc(data.item.prompt)} <span>= ?</span></div><label for="answer">Your answer</label><input id="answer" name="answer" placeholder="e.g. 2 1/3 or 7/3" autocomplete="off" maxlength="32" required><small>A fraction, mixed number, or exact decimal is welcome.</small><button class="primary" id="check">Check my answer <span>↗</span></button></form><div class="feedback ${feedbackCorrect ? "success" : ""}" role="status" ${lastFeedback ? "" : "hidden"}><strong>${feedbackCorrect ? "A little progress!" : "Let’s try another way."}</strong><p>${esc(lastFeedback)}</p></div>`;
    if (data.item.id === "mixed-add") {
      const equation = document.querySelector<HTMLElement>(".equation")!;
      equation.classList.add("visual-equation");
      equation.innerHTML = mixedNumberQuestion();
      equation.insertAdjacentHTML("afterend", '<div id="fraction-lab"></div>');
      mountFractionLab(
        document.querySelector<HTMLElement>("#fraction-lab")!,
        fractionLabState,
        (state) => {
          fractionLabState = state;
        },
      );
    }
    if (data.lesson && data.item.left !== undefined && data.item.operation) {
      const item = makeProblem({
        id: data.item.id,
        left: data.item.left,
        right: data.item.right,
        depth: data.item.depth,
        operation: data.item.operation,
        prompt: data.item.prompt,
        skill: data.item.skill,
      });
      document
        .querySelector("#answer-form")!
        .insertAdjacentHTML(
          "afterend",
          '<div id="student-lesson-tools"></div>',
        );
      mountLessonTools(
        document.querySelector<HTMLElement>("#student-lesson-tools")!,
        [item],
        data.lesson.tools,
        { student: true },
      );
      if (data.item.unit)
        document.querySelector('label[for="answer"]')!.textContent =
          `Your answer (${data.item.unit})`;
    }
    let pending: { requestId: string; value: string } | null = null;
    document
      .querySelector("#answer-form")!
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        if (busy) return;
        busy = true;
        const button = document.querySelector<HTMLButtonElement>("#check")!;
        button.disabled = true;
        button.textContent = "Checking…";
        const value = (document.querySelector("#answer") as HTMLInputElement)
          .value;
        if (!pending || pending.value !== value)
          pending = { requestId: crypto.randomUUID(), value };
        try {
          const result = await api(
            "answer",
            {
              ...pending,
              studentId: session.id,
              token: session.token,
              itemId: data.item.id,
            },
            session.token,
          );
          pending = null;
          lastFeedback = result.hint;
          feedbackCorrect = result.correct;
          await loadItem();
          document
            .querySelector(".feedback:not([hidden])")
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch (e) {
          toast((e as Error).message);
          button.disabled = false;
          button.textContent = "Check my answer ↗";
        } finally {
          busy = false;
        }
      });
  } catch (e) {
    toast((e as Error).message);
  }
}
function renderSupport(tutorAvailable: boolean) {
  if (tutorAvailable)
    document.querySelector(".student-main .footnote")!.textContent =
      "Practice uses local hints · Ask Parasail for AI help";
  if (document.querySelector("#student-support")) return;
  document
    .querySelector("#practice")!
    .insertAdjacentHTML(
      "afterend",
      `<section id="student-support" class="student-support"><span class="eyebrow">YOU DON’T HAVE TO BE STUCK ALONE</span><h2>Let’s work through it.</h2><p>Your questions and replies stay together here. Take it one step at a time.</p><div id="support-thread" class="support-thread" role="log" aria-label="Your help conversation" aria-live="polite" tabindex="0"><p class="thread-empty">Ask about a step you’re stuck on, or send the substitute a message.</p></div><form id="support-form" class="support-composer"><label for="support-question">Your question or message</label><textarea id="support-question" rows="2" maxlength="1000" required placeholder="What’s confusing? Ask here…"></textarea><div class="support-actions"><button type="submit" value="tutor" class="primary" ${tutorAvailable ? "" : "disabled"}>Ask Parasail ↗</button><button type="submit" value="teacher" class="secondary">Send to substitute ↗</button></div><small>${tutorAvailable ? "Parasail sees your current question and recent work." : "Parasail is waiting for its API connection."} Messages to the substitute are saved for the returning teacher. Use no private information.</small></form></section>`,
    );
  let sending = false,
    pending: { requestId: string; text: string } | null = null;
  const history: { role: "user" | "assistant"; content: string }[] = [];
  const thread = document.querySelector<HTMLElement>("#support-thread")!;
  function addBubble(label: string, text: string, kind: string) {
    thread.querySelector(".thread-empty")?.remove();
    const bubble = document.createElement("article");
    bubble.className = `support-bubble ${kind}`;
    const name = document.createElement("strong");
    name.textContent = label;
    const content = document.createElement("p");
    content.textContent = text;
    bubble.append(name, content);
    thread.append(bubble);
    thread.scrollTop = thread.scrollHeight;
    return { bubble, content };
  }
  document
    .querySelector("#support-form")!
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      if (sending) return;
      const target = (event as SubmitEvent)
        .submitter as HTMLButtonElement | null;
      const mode = target?.value ?? "teacher";
      if (mode === "tutor" && !tutorAvailable) return;
      const text = document
        .querySelector<HTMLTextAreaElement>("#support-question")!
        .value.trim();
      if (!text) return;
      const textarea =
        document.querySelector<HTMLTextAreaElement>("#support-question")!;
      if (!pending || pending.text !== text)
        pending = { requestId: crypto.randomUUID(), text };
      sending = true;
      const buttons = document.querySelectorAll<HTMLButtonElement>(
        "#support-form button",
      );
      buttons.forEach((b) => (b.disabled = true));
      addBubble("You", text, "from-student");
      const reply = addBubble(
        mode === "teacher" ? "To your substitute" : "Parasail",
        mode === "teacher"
          ? "Sending your message…"
          : "Thinking through your question…",
        "from-tutor",
      );
      textarea.value = "";
      textarea.blur();
      thread.scrollIntoView({ behavior: "smooth", block: "start" });
      try {
        const result = await api(
          mode === "teacher" ? "message" : "tutor",
          {
            ...pending,
            studentId: session.id,
            token: session.token,
            ...(mode === "tutor"
              ? {
                  history: history.slice(-4).map((turn) => ({
                    ...turn,
                    content: turn.content.slice(0, 600),
                  })),
                }
              : {}),
          },
          session.token,
        );
        reply.content.textContent =
          mode === "teacher"
            ? "Message delivered to the substitute’s dashboard. It will also be in the teacher handoff."
            : result.reply;
        if (mode === "tutor")
          history.push(
            { role: "user", content: text },
            { role: "assistant", content: result.reply },
          );
        pending = null;
      } catch (error) {
        reply.content.textContent = (error as Error).message;
        reply.bubble.classList.add("is-error");
        if (!textarea.value) textarea.value = text;
      } finally {
        thread.scrollTop = thread.scrollHeight;
        sending = false;
        buttons.forEach(
          (b) => (b.disabled = b.value === "tutor" && !tutorAvailable),
        );
      }
    });
}
window.addEventListener("beforeunload", () => {
  if (polling) clearInterval(polling);
  if (simTimer) clearInterval(simTimer);
});
if (
  [
    "/plan",
    "/absence",
    "/substitute",
    "/coverage",
    "/invitation",
    "/prep-lab",
  ].includes(location.pathname)
)
  startPreparationUI(app, { header: () => header(), footer });
else if (studentMode) void student();
else if (roomId) void dashboard();
else landing();
