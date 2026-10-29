import {
  calculate,
  displayRational,
  formatAnswer,
  rational,
  type MathProblem,
} from "./math-engine";
import type { InteractiveTool } from "./prep-types";
const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const number = (v: string) => {
  const [n, d] = rational(v);
  return Number(n) / Number(d);
};
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
function bar(parts: number, count: number, color = "sage") {
  return `<div class="fraction-bar" style="--parts:${parts}" role="img" aria-label="${count} of ${parts} pieces shaded">${Array.from({ length: parts }, (_, i) => `<span class="fraction-cell ${i < count ? color : ""}" aria-hidden="true"></span>`).join("")}</div>`;
}
export function mountLessonTools(
  root: HTMLElement,
  items: MathProblem[],
  tools: InteractiveTool[],
  options: { student?: boolean; presentation?: boolean } = {},
) {
  let selected = 0,
    question = 0,
    stage = 0,
    notice = "",
    marker = 0,
    rows = 1,
    cols = 1,
    width = 1,
    height = 1,
    layers = 1;
  const reset = () => {
    const item = items[question];
    stage = 0;
    notice = "";
    marker = 0;
    rows = 1;
    cols = 1;
    width = Math.max(1, Math.min(12, number(item.left)));
    height = Math.max(1, Math.min(12, number(item.right)));
    layers = 1;
  };
  reset();
  function render() {
    const item = items[question],
      tool = tools[selected];
    if (!item || !tool) return;
    const a = number(item.left),
      b = number(item.right),
      result = number(item.answer);
    let body = "";
    if (tool.kind === "fraction-bars") {
      const [an, ad] = rational(item.left).map(Number),
        [bn, bd] = rational(item.right).map(Number),
        den = (ad / gcd(ad, bd)) * bd;
      const ra = an % ad,
        rb = bn % bd,
        wa = Math.floor(an / ad),
        wb = Math.floor(bn / bd),
        subtract = item.operation === "subtract";
      const source = (w: number, n: number, d: number, color: string) =>
        `<div class="fraction-source-label"><span>${w} wholes + ${n}/${d}</span><span>fractional part</span></div>${bar(stage ? den : d, stage ? (n * den) / d : n, color)}`;
      body = `<h3>${stage === 0 ? "Same whole, different pieces" : stage === 1 ? "Rename with equal-sized pieces" : "Combine, then regroup"}</h3><p>${stage === 0 ? "These bars represent equal-sized wholes. Compare the shaded fractional parts." : stage === 1 ? "Only the size of each piece changed. Count the shaded pieces in each bar." : "The whole numbers and the fractional pieces must both appear in the result."}</p>${source(wa, ra, ad, "sage")}<div class="tool-operation">${subtract ? "−" : "+"}</div>${source(wb, rb, bd, "clay")}`;
      if (stage === 0)
        body += `<button class="lab-next" type="button" data-action="rename">Split both bars into ${den}ths →</button>`;
      if (stage === 1)
        body += `<div class="tool-checks"><label>First fractional part: how many ${den}ths?<input id="pieces-a" type="number" min="0" max="${den}" inputmode="numeric"></label><label>Second fractional part: how many ${den}ths?<input id="pieces-b" type="number" min="0" max="${den}" inputmode="numeric"></label></div><button class="lab-next" type="button" data-action="combine">Check and combine →</button>`;
      if (stage >= 2) {
        let whole = wa + (subtract ? -wb : wb),
          pieces = (ra * den) / ad + ((subtract ? -rb : rb) * den) / bd;
        const ungrouped = pieces;
        if (pieces < 0) {
          whole--;
          pieces += den;
        }
        body += `<p class="tool-equation">${wa} ${subtract ? "−" : "+"} ${wb} wholes; ${(ra * den) / ad}/${den} ${subtract ? "−" : "+"} ${(rb * den) / bd}/${den}</p>${ungrouped < 0 ? `<p>Trade one whole for ${den}/${den} so there are enough pieces to subtract.</p>` : ""}<p>After combining: ${whole} wholes and ${pieces} pieces of size 1/${den}.</p>${bar(den, Math.min(den, pieces), "sage")}${pieces > den ? bar(den, pieces - den, "clay") : ""}<button class="lab-next" type="button" data-action="reveal">${stage === 2 ? "Regroup and show the mixed number →" : "Result: " + esc(formatAnswer(item))}</button>`;
        if (stage === 3)
          body += `<p class="tool-result">${esc(formatAnswer(item))}</p><p>Use this model to explain your answer. The practice answer box stays separate.</p>`;
      }
    } else if (tool.kind === "number-line") {
      const [n, d] = rational(item.answer),
        den = Number(d),
        target = Number(n),
        low = Math.floor(Math.min(0, a, b, result)),
        high = Math.ceil(Math.max(1, a, b, result) * 1.2),
        max = Math.max(den, (high - low) * den),
        position = (marker / max) * 100;
      body = `<h3>Estimate first. Then place the result.</h3><p>Move the marker to where you think ${esc(item.prompt)} lands. Each step is ${den === 1 ? "one unit" : `1/${den}`}.</p><div class="number-line"><div class="number-line-rail"></div><span class="number-line-marker" style="left:${position}%" aria-hidden="true">●</span><div class="number-line-labels"><span>${low}</span><span>${displayRational(`${Math.round(((low + high) * den) / 2)}/${den}`)}</span><span>${high}</span></div></div><label class="tool-range-label" for="line-marker">Your marker: <strong id="marker-value">${displayRational(`${low * den + marker}/${den}`)}</strong></label><input id="line-marker" type="range" min="0" max="${max}" step="1" value="${marker}" data-range="marker" aria-label="Position on the number line"><button type="button" class="lab-next" data-action="check-line">Check my position →</button>`;
    } else if (tool.kind === "array") {
      const division = item.operation === "divide",
        targetRows = division ? b : a,
        targetCols = division ? result : b;
      body = `<h3>${division ? "Share into equal groups" : "Build rows and columns"}</h3><p>${division ? `Share ${a} objects into ${b} equal groups. How many belong in each group?` : `Build ${a} groups with ${b} objects in each group.`}</p><label class="tool-range-label">Groups: <strong>${rows}</strong><input type="range" min="1" max="12" step="1" value="${rows}" data-range="rows" aria-label="Number of groups"></label><label class="tool-range-label">Objects per group: <strong>${cols}</strong><input type="range" min="1" max="12" step="1" value="${cols}" data-range="cols" aria-label="Objects per group"></label><div class="math-array" style="--columns:${cols}" role="img" aria-label="${rows} rows of ${cols} objects, ${rows * cols} total">${Array.from({ length: rows * cols }, () => '<i aria-hidden="true"></i>').join("")}</div><p>${rows} groups × ${cols} each = ${rows * cols} objects</p><button type="button" class="lab-next" data-action="check-array" data-rows="${targetRows}" data-cols="${targetCols}">Check my groups →</button>`;
    } else if (tool.kind === "place-value") {
      const digits = (value: number) => {
        const whole = Math.round(value * 100);
        return [
          Math.floor(whole / 10000) % 10,
          Math.floor(whole / 1000) % 10,
          Math.floor(whole / 100) % 10,
          Math.floor(whole / 10) % 10,
          whole % 10,
        ];
      };
      const table = (values: number[]) =>
        values.map((v) => `<td>${v}</td>`).join("");
      body = `<h3>Same place. Same size.</h3><p>Line up ones with ones, tenths with tenths, and hundredths with hundredths.</p><table class="place-value-table"><thead><tr><th>Hundreds</th><th>Tens</th><th>Ones</th><th>Tenths</th><th>Hundredths</th></tr></thead><tbody><tr>${table(digits(a))}</tr><tr>${table(digits(b))}</tr>${stage ? `<tr class="place-result">${table(digits(result))}</tr>` : ""}</tbody></table><p>${esc(item.prompt)}. Each column holds units of one size.</p>${!stage ? '<p>How many hundredths can you trade for one tenth?</p><div class="fraction-choices">' + [1, 10, 100].map((v) => `<button class="lab-choice" type="button" data-trade="${v}">${v}</button>`).join("") + "</div>" : `<p class="tool-result">${esc(formatAnswer(item))}</p><p>${esc(item.steps[0])}</p><p>Ten units in any column exchange for one unit in the column to its left. Subtraction reverses that exchange.</p>`}`;
    } else if (tool.kind === "rectangle") {
      body = `<h3>Same rectangle, two different measurements.</h3><p>Area counts square units inside. Perimeter counts units around the edge.</p><label class="tool-range-label">Length: ${width}<input type="range" min="1" max="12" value="${width}" data-range="width" aria-label="Rectangle length"></label><label class="tool-range-label">Width: ${height}<input type="range" min="1" max="12" value="${height}" data-range="height" aria-label="Rectangle width"></label><div class="rectangle-grid" style="--columns:${width}" role="img" aria-label="Rectangle ${width} by ${height}">${Array.from({ length: width * height }, () => '<span aria-hidden="true"></span>').join("")}</div><div class="measure-pair"><div><strong>${width * height}</strong><span>square units of area</span></div><div><strong>${2 * (width + height)}</strong><span>units of perimeter</span></div></div><p>Area = ${width} × ${height}. Perimeter = 2 × (${width} + ${height}).</p><button type="button" class="lab-next" data-action="reset">Reset to this question’s dimensions →</button>`;
    } else if (tool.kind === "cubes") {
      const depth = number(item.depth ?? "1");
      body = `<h3>Build volume one layer at a time.</h3><p>Each layer has ${a} rows × ${b} cubes = ${a * b} unit cubes. Stack ${depth} layers.</p><div class="cube-layers">${Array.from({ length: layers }, (_, i) => `<div class="cube-layer"><span>Layer ${i + 1}</span><div class="rectangle-grid" style="--columns:${a}" role="img" aria-label="Layer of ${a * b} unit cubes">${Array.from({ length: a * b }, () => '<span aria-hidden="true"></span>').join("")}</div></div>`).join("")}</div><p class="tool-equation">${a} × ${b} × ${layers} = ${a * b * layers} cubic units</p><button type="button" class="lab-next" data-action="layer" ${layers >= depth ? "disabled" : ""}>Add a layer (${layers}/${depth}) →</button>${layers === depth ? '<p class="tool-result">All layers complete. Count cubes, not just squares.</p>' : ""}`;
    } else {
      const fraction =
        !item.left.includes(".") &&
        !item.right.includes(".") &&
        (items[question].skill.toLowerCase().includes("fraction") ||
          rational(item.left)[1] > 1n ||
          rational(item.right)[1] > 1n);
      const bad =
        fraction && item.operation === "add"
          ? "Add the top numbers AND the bottom numbers."
          : item.operation === "perimeter"
            ? "Multiply length by width to find the perimeter."
            : item.operation === "volume"
              ? "Count only the cubes in the bottom layer."
              : item.operation === "divide"
                ? "Multiply the two numbers instead of sharing equally."
                : "Use an answer without checking the size of its units.";
      body = `<h3>Can you spot the problem?</h3><div class="mistake-example"><span>AN INCORRECT STEP</span><p>${esc(bad)}</p></div><p>Which repair helps?</p><div class="detective-choices"><button type="button" class="secondary" data-action="wrong-repair">Keep this step; it looks close enough.</button><button type="button" class="secondary" data-action="repair">${fraction ? "Rename with equal-sized pieces first." : item.operation === "perimeter" ? "Add all four side lengths." : item.operation === "volume" ? "Count every equal layer." : item.operation === "divide" ? "Build equal groups and check the total." : "Use the operation and equal-sized units in a model."}</button></div>${stage ? `<div class="tool-result">A better next step</div><p>${esc(item.steps[0])}</p><details><summary>Show the corrected worked example</summary><ol>${item.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></details>` : ""}`;
    }
    root.innerHTML = `<section class="lesson-tools ${options.presentation ? "tool-presentation" : ""}"><div class="eyebrow">${options.student ? "EXPLORE THIS QUESTION" : "INTERACTIVE LESSON TOOLS"}</div><div class="tool-tabs" role="group" aria-label="Choose a learning tool">${tools.map((t, i) => `<button type="button" data-tool="${i}" aria-pressed="${i === selected}" class="${i === selected ? "active" : ""}">${esc(t.title)}</button>`).join("")}</div>${!options.student ? `<label class="tool-question-label">Example question<select id="tool-problem">${items.map((p, i) => `<option value="${i}" ${i === question ? "selected" : ""}>${esc(p.prompt)}</option>`).join("")}</select></label>` : ""}<div class="tool-problem">${esc(item.prompt)}</div><div class="tool-body">${body}</div><p class="tool-notice" role="status">${esc(notice)}</p><div class="tool-footer"><button type="button" data-action="reset">Reset this tool</button><span>Explore here. Submit answers in practice.</span></div></section>`;
  }
  root.addEventListener("change", (event) => {
    const target = event.target as HTMLSelectElement;
    if (target.id === "tool-problem") {
      question = Number(target.value);
      reset();
      render();
    }
  });
  root.addEventListener("input", (event) => {
    const input = event.target as HTMLInputElement;
    if (!input.dataset.range) return;
    const key = input.dataset.range,
      value = Number(input.value);
    if (key === "marker") {
      marker = value;
      const item = items[question],
        den = Number(rational(item.answer)[1]),
        low = Math.floor(
          Math.min(
            0,
            number(item.left),
            number(item.right),
            number(item.answer),
          ),
        );
      root.querySelector("#marker-value")!.textContent = displayRational(
        `${low * den + marker}/${den}`,
      );
      root.querySelector<HTMLElement>(".number-line-marker")!.style.left =
        `${(marker / Number(input.max)) * 100}%`;
      return;
    }
    if (key === "rows") rows = value;
    if (key === "cols") cols = value;
    if (key === "width") width = value;
    if (key === "height") height = value;
    render();
    root
      .querySelector<HTMLInputElement>(`[data-range="${key}"]`)
      ?.focus({ preventScroll: true });
  });
  root.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "button",
    );
    if (!button || button.disabled) return;
    if (button.dataset.tool !== undefined) {
      selected = Number(button.dataset.tool);
      reset();
      render();
      return;
    }
    const item = items[question],
      action = button.dataset.action;
    if (action === "reset") {
      reset();
      render();
      return;
    }
    if (action === "rename") {
      stage = 1;
      notice = "";
    }
    if (action === "combine") {
      const [an, ad] = rational(item.left).map(Number),
        [bn, bd] = rational(item.right).map(Number),
        den = (ad / gcd(ad, bd)) * bd;
      const first = root.querySelector<HTMLInputElement>("#pieces-a")!,
        second = root.querySelector<HTMLInputElement>("#pieces-b")!;
      if (
        first.value === "" ||
        second.value === "" ||
        Number(first.value) !== ((an % ad) * den) / ad ||
        Number(second.value) !== ((bn % bd) * den) / bd
      ) {
        notice = "Count the shaded small pieces in each bar, then try again.";
        root.querySelector(".tool-notice")!.textContent = notice;
        return;
      }
      stage = 2;
      notice = "Equal-sized pieces can now combine.";
    }
    if (action === "reveal") stage = 3;
    if (action === "check-line") {
      const den = Number(rational(item.answer)[1]),
        low = Math.floor(
          Math.min(
            0,
            number(item.left),
            number(item.right),
            number(item.answer),
          ),
        );
      notice =
        low * den + marker === Number(rational(item.answer)[0])
          ? "Exactly. Your marker matches the calculated result."
          : "Compare your estimate with the operation. Try the model or a worked step, then adjust the marker.";
      root.querySelector(".tool-notice")!.textContent = notice;
      return;
    }
    if (action === "check-array")
      notice =
        rows === Number(button.dataset.rows) &&
        cols === Number(button.dataset.cols)
          ? "Exactly. The groups fit the question and the total."
          : "Check the requested number of groups and the number in each group.";
    if (button.dataset.trade) {
      if (button.dataset.trade === "10") {
        stage = 1;
        notice = "Yes. Ten hundredths have the same value as one tenth.";
      } else {
        notice = "Think of 0.10: how many hundredths make one tenth?";
        root.querySelector(".tool-notice")!.textContent = notice;
        return;
      }
    }
    if (action === "layer")
      layers = Math.min(number(item.depth ?? "1"), layers + 1);
    if (action === "repair") {
      stage = 1;
      notice = "That repair respects the operation and the units.";
    }
    if (action === "wrong-repair")
      notice =
        "An answer must preserve the quantity and use the right operation. Try the other repair.";
    render();
  });
  render();
  return () => {};
}
