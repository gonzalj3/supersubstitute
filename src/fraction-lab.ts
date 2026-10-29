export type FractionLabState = {
  stage: "compare" | "rename" | "combine" | "regroup";
  third: number | null;
  fourth: number | null;
  notice: string;
};
type Action =
  | { type: "split" | "combine" | "regroup" | "back" | "reset" }
  | { type: "choose"; part: "third" | "fourth"; value: number };
export const initialFractionLab = (): FractionLabState => ({
  stage: "compare",
  third: null,
  fourth: null,
  notice: "",
});
export function stepFractionLab(
  state: FractionLabState,
  action: Action,
): FractionLabState {
  if (action.type === "reset") return initialFractionLab();
  if (action.type === "split" && state.stage === "compare")
    return { ...state, stage: "rename", notice: "" };
  if (action.type === "choose" && state.stage === "rename") {
    const correct = action.value === (action.part === "third" ? 4 : 9);
    return {
      ...state,
      [action.part]: action.value,
      notice: correct
        ? "Exactly. The shaded amount stays the same; only the size of the pieces changes."
        : "Count the shaded twelfths in that bar. Each tiny piece is one twelfth.",
    };
  }
  if (action.type === "combine" && state.stage === "rename")
    return state.third === 4 && state.fourth === 9
      ? { ...state, stage: "combine", notice: "" }
      : {
          ...state,
          notice:
            "Rename both fractions correctly before combining the pieces.",
        };
  if (action.type === "regroup" && state.stage === "combine")
    return { ...state, stage: "regroup", notice: "" };
  if (action.type === "back")
    return {
      ...state,
      stage:
        state.stage === "regroup"
          ? "combine"
          : state.stage === "combine"
            ? "rename"
            : "compare",
      notice: "",
    };
  return state;
}
const fraction = (n: number | string, d: number) =>
  `<span class="visual-fraction" aria-label="${n} over ${d}"><span>${n}</span><span>${d}</span></span>`;
export function mixedNumberQuestion() {
  return `<span class="mixed-number">2 ${fraction(1, 3)}</span><span class="math-operator">+</span><span class="mixed-number">1 ${fraction(3, 4)}</span><span class="math-operator">= ?</span>`;
}
function bar(
  parts: number,
  filled: number,
  description: string,
  color = "sage",
) {
  return `<div class="fraction-bar" style="--parts:${parts}" role="img" aria-label="${description}">${Array.from({ length: parts }, (_, i) => `<span class="fraction-cell ${i < filled ? color : ""}" aria-hidden="true"></span>`).join("")}</div>`;
}
function wholeBank(count: number, extra = false) {
  return `<div class="whole-bank" role="img" aria-label="${count} whole blocks"><div class="whole-blocks" aria-hidden="true">${Array.from({ length: count }, (_, i) => `<span class="whole-block ${extra && i === count - 1 ? "new-whole" : ""}">1</span>`).join("")}</div><span>${count} ${count === 1 ? "whole" : "wholes"}${extra ? " (one newly made)" : ""}</span></div>`;
}
function sourceRow(
  whole: number,
  n: number,
  d: number,
  split: boolean,
  color: string,
) {
  const filled = split ? n * (12 / d) : n;
  return `<div class="fraction-source"><div class="fraction-source-label"><span>${whole} ${whole === 1 ? "whole" : "wholes"} + ${fraction(n, d)}</span><span>fractional part ↓</span></div>${bar(split ? 12 : d, filled, `${n} of ${d} equal pieces shaded${split ? `, shown as ${filled} of 12 equal pieces` : ""}`, color)}</div>`;
}
export function mountFractionLab(
  root: HTMLElement,
  initial: FractionLabState,
  onChange: (state: FractionLabState) => void,
) {
  let state = initial;
  function render(focus = false) {
    const stage = state.stage,
      step = ["compare", "rename", "combine", "regroup"].indexOf(stage) + 1;
    let body = "";
    if (stage === "compare")
      body = `<h3 id="fraction-lab-heading" tabindex="-1">Same whole. Different pieces.</h3><p>These bars are the same size. One shows thirds; the other shows fourths. We need equal-sized pieces before we add.</p>${sourceRow(2, 1, 3, false, "sage")}${sourceRow(1, 3, 4, false, "clay")}<button type="button" class="lab-next" data-action="split">Split both bars into twelfths <span aria-hidden="true">→</span></button>`;
    if (stage === "rename") {
      const choice = (part: "third" | "fourth", n: number, d: number) =>
        `<div class="fraction-question"><span>${fraction(n, d)} = ${fraction("?", 12)}</span><div class="fraction-choices" role="group" aria-label="How many twelfths equal ${n} over ${d}?">${[3, 4, 9].map((value) => `<button type="button" class="lab-choice ${state[part] === value ? "selected" : ""} ${state[part] === value && value === (part === "third" ? 4 : 9) ? "is-correct" : ""}" data-part="${part}" data-value="${value}" aria-pressed="${state[part] === value}">${fraction(value, 12)}</button>`).join("")}</div>${state[part] === (part === "third" ? 4 : 9) ? `<small class="fraction-match">✓ Same amount: ${n}/${d} = ${state[part]}/12</small>` : ""}</div>`;
      body = `<h3 id="fraction-lab-heading" tabindex="-1">Rename, without changing the amount.</h3><p>Each third becomes 4 small pieces. Each fourth becomes 3. Count the shaded twelfths, then choose each equivalent fraction.</p>${sourceRow(2, 1, 3, true, "sage")}${choice("third", 1, 3)}${sourceRow(1, 3, 4, true, "clay")}${choice("fourth", 3, 4)}<p class="lab-notice" role="status">${state.notice || "The bars still represent the same amounts as before."}</p><button type="button" class="lab-next" data-action="combine" ${state.third === 4 && state.fourth === 9 ? "" : "disabled"}>Combine the pieces <span aria-hidden="true">→</span></button>`;
    }
    if (stage === "combine")
      body = `<h3 id="fraction-lab-heading" tabindex="-1">Now the pieces fit together.</h3><p>Set aside the whole numbers: 2 + 1 = 3.</p>${wholeBank(3)}<div class="fraction-equation">${fraction(4, 12)} + ${fraction(9, 12)} = ${fraction(13, 12)}</div><p>That is 13 pieces, each one twelfth of a whole.</p><div class="fraction-bar" style="--parts:12" role="img" aria-label="12 twelfths make a full bar: four from the first fraction and eight from the second">${Array.from({ length: 12 }, (_, i) => `<span class="fraction-cell ${i < 4 ? "sage" : "clay"}" aria-hidden="true"></span>`).join("")}</div><div class="bar-caption">12 twelfths fill one whole</div>${bar(12, 1, "One more twelfth is left over", "clay")}<div class="bar-caption">1 twelfth left over</div><button type="button" class="lab-next" data-action="regroup">Trade 12 twelfths for 1 whole <span aria-hidden="true">→</span></button>`;
    if (stage === "regroup")
      body = `<h3 id="fraction-lab-heading" tabindex="-1">A new whole, and a little left over.</h3><p>The original 3 wholes plus the whole you just made give 4 wholes. One twelfth remains.</p>${wholeBank(4, true)}${bar(12, 1, "One twelfth of another whole is shaded", "clay")}<div class="fraction-equation final-model">4 wholes + ${fraction(1, 12)}</div><p>Now write the mixed number in your answer box.</p><button type="button" class="lab-next" data-action="answer">Try my answer <span aria-hidden="true">↓</span></button>`;
    root.innerHTML = `<section class="fraction-lab" aria-labelledby="fraction-lab-heading"><div class="fraction-lab-top"><span>SEE IT WITH FRACTION BARS</span><span>STEP ${step} OF 4</span></div><div class="fraction-step-track" aria-hidden="true">${[1, 2, 3, 4].map((n) => `<i class="${n <= step ? "active" : ""}"></i>`).join("")}</div>${body}<div class="fraction-lab-nav">${stage !== "compare" ? '<button type="button" data-action="back">← Back a step</button>' : ""}<button type="button" data-action="reset">Start over</button></div></section>`;
    if (focus)
      root
        .querySelector<HTMLElement>("#fraction-lab-heading")
        ?.focus({ preventScroll: true });
  }
  root.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "button",
    );
    if (!button || button.disabled) return;
    if (button.dataset.action === "answer") {
      const input = document.querySelector<HTMLInputElement>("#answer");
      input?.focus({ preventScroll: true });
      input?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const action: Action = button.dataset.part
      ? {
          type: "choose",
          part: button.dataset.part as "third" | "fourth",
          value: Number(button.dataset.value),
        }
      : {
          type: button.dataset.action as
            "split" | "combine" | "regroup" | "back" | "reset",
        };
    state = stepFractionLab(state, action);
    onChange(state);
    render(action.type !== "choose");
    if (action.type === "choose")
      root
        .querySelector<HTMLButtonElement>(
          `[data-part="${action.part}"][data-value="${action.value}"]`,
        )
        ?.focus({ preventScroll: true });
    else root.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  render();
}
