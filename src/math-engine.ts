import { parseFraction } from "./domain";
export type Operation =
  "add" | "subtract" | "multiply" | "divide" | "area" | "perimeter" | "volume";
export type MathProblem = {
  id: string;
  prompt: string;
  answer: string;
  skill: string;
  denominator: number;
  steps: string[];
  left: string;
  right: string;
  depth?: string;
  operation: Operation;
  origin: "teacher" | "generated";
  unit?: string;
};
const gcd = (a: bigint, b: bigint): bigint =>
  b ? gcd(b, a % b) : a < 0n ? -a : a;
export function rational(value: string): [bigint, bigint] {
  const [n, d] = parseFraction(value).split("/").map(BigInt);
  return [n, d];
}
export function normalize(n: bigint, d: bigint): string {
  if (!d) throw new Error("Division by zero is not allowed.");
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d) || 1n;
  return `${n / g}/${d / g}`;
}
export function calculate(
  left: string,
  right: string,
  operation: Operation,
  depth = "1",
): string {
  const [a, b] = rational(left),
    [c, d] = rational(right);
  if (operation === "add") return normalize(a * d + c * b, b * d);
  if (operation === "subtract") return normalize(a * d - c * b, b * d);
  if (operation === "divide") return normalize(a * d, b * c);
  if (operation === "perimeter") return normalize(2n * (a * d + c * b), b * d);
  if (operation === "volume") {
    const [e, f] = rational(depth);
    return normalize(a * c * e, b * d * f);
  }
  return normalize(a * c, b * d);
}
export function displayRational(value: string): string {
  let [n, d] = rational(value);
  const sign = n < 0n ? "-" : "";
  if (n < 0n) n = -n;
  const w = n / d,
    r = n % d;
  return !r ? `${sign}${w}` : w ? `${sign}${w} ${r}/${d}` : `${sign}${r}/${d}`;
}
export function formatAnswer(
  item: Pick<MathProblem, "answer" | "left" | "right">,
) {
  if (item.left.includes(".") || item.right.includes(".")) {
    const [n, d] = rational(item.answer);
    return (Number(n) / Number(d)).toFixed(6).replace(/\.?0+$/, "");
  }
  return displayRational(item.answer);
}
export const SYMBOLS: Record<Operation, string> = {
  add: "+",
  subtract: "−",
  multiply: "×",
  divide: "÷",
  area: "×",
  perimeter: "+",
  volume: "×",
};
export function makeProblem(input: {
  id: string;
  left: string;
  right: string;
  operation: Operation;
  depth?: string;
  prompt?: string;
  skill?: string;
  origin?: "teacher" | "generated";
}): MathProblem {
  const left = input.left.trim(),
    right = input.right.trim(),
    depth = input.depth?.trim();
  for (const v of [left, right, ...(depth ? [depth] : [])]) {
    const [n, d] = rational(v);
    if (n < 0n || n > 10000n * d || d > 1000n)
      throw new Error(
        "Use elementary operands between 0 and 10,000 with denominators at most 1,000.",
      );
  }
  if (
    ["area", "perimeter", "volume"].includes(input.operation) &&
    [left, right, ...(depth ? [depth] : [])].some((v) => rational(v)[0] <= 0n)
  )
    throw new Error("Dimensions must be positive.");
  const answer = calculate(left, right, input.operation, depth),
    [a, b] = rational(left),
    [c, d] = rational(right),
    common = (b / gcd(b, d)) * d;
  let steps: string[];
  const decimal = left.includes(".") || right.includes(".");
  const operand = (v: string) => (v.includes(".") ? v : displayRational(v));
  if (decimal)
    steps = [
      `Align decimal points: ${left} ${SYMBOLS[input.operation]} ${right}.`,
      "Work with ones, tenths, and hundredths. Exchange ten units for one unit in the next place when needed.",
      `Exact result: ${formatAnswer({ answer, left, right })}.`,
    ];
  else if (["add", "subtract"].includes(input.operation) && (b > 1n || d > 1n))
    steps = [
      `Rename with denominator ${common}: ${a * (common / b)}/${common} ${SYMBOLS[input.operation]} ${c * (common / d)}/${common}.`,
      `Combine the numerators; keep the denominator ${common}.`,
      `Simplify or regroup: ${displayRational(answer)}.`,
    ];
  else if (input.operation === "perimeter")
    steps = [
      `Add the side lengths: ${displayRational(left)} + ${displayRational(right)}.`,
      `Double that sum to count all four sides: ${displayRational(answer)} units.`,
    ];
  else if (input.operation === "volume")
    steps = [
      `Count a layer: ${displayRational(left)} × ${displayRational(right)}.`,
      `Multiply by ${displayRational(depth ?? "1")} layers: ${displayRational(answer)} cubic units.`,
    ];
  else
    steps = [
      `Represent ${displayRational(left)} ${SYMBOLS[input.operation]} ${displayRational(right)} using equal-sized units.`,
      `Use ${input.operation === "divide" ? "equal groups" : input.operation === "multiply" || input.operation === "area" ? "rows and columns" : "place value"} to find ${displayRational(answer)}${input.operation === "area" ? " square units" : ""}.`,
    ];
  const prompt =
    input.prompt ??
    (input.operation === "area"
      ? `Find the area of a rectangle ${displayRational(left)} units by ${displayRational(right)} units.`
      : input.operation === "perimeter"
        ? `Find the perimeter of a rectangle ${displayRational(left)} units by ${displayRational(right)} units.`
        : input.operation === "volume"
          ? `Find the volume of a prism ${displayRational(left)} × ${displayRational(right)} × ${displayRational(depth ?? "1")} units.`
          : `${operand(left)} ${SYMBOLS[input.operation]} ${operand(right)}`);
  return {
    id: input.id,
    prompt,
    answer,
    skill: input.skill ?? input.operation,
    denominator: Number(common),
    steps,
    left,
    right,
    depth,
    operation: input.operation,
    origin: input.origin ?? "generated",
    ...(["area", "perimeter", "volume"].includes(input.operation)
      ? {
          unit:
            input.operation === "area"
              ? "square units"
              : input.operation === "volume"
                ? "cubic units"
                : "units",
        }
      : {}),
  };
}
export function parseTeacherProblem(line: string, index: number): MathProblem {
  const parts = line.split("=");
  if (parts.length > 2)
    throw new Error(
      `Question ${index + 1}: use one expression and an optional answer.`,
    );
  const prompt = parts[0].trim(),
    number = "(?:\\d+\\s+\\d+/\\d+|\\d+/\\d+|\\d+(?:\\.\\d+)?)";
  const match = prompt
    .replace(/\s*\?\s*$/, "")
    .match(new RegExp(`^(${number})\\s*([+−\\-×*x÷])\\s*(${number})$`));
  if (!match)
    throw new Error(
      `Question ${index + 1}: use a numeric expression such as 2 1/3 + 1 3/4. Geometry questions use generated practice for now.`,
    );
  const operation: Operation =
    match[2] === "+"
      ? "add"
      : ["−", "-"].includes(match[2])
        ? "subtract"
        : ["×", "*", "x"].includes(match[2])
          ? "multiply"
          : "divide";
  const item = makeProblem({
    id: `teacher-${index + 1}`,
    left: match[1],
    right: match[3],
    operation,
    prompt,
    origin: "teacher",
  });
  if (parts[1]?.trim() && parseFraction(parts[1].trim()) !== item.answer)
    throw new Error(
      `Question ${index + 1}: the supplied answer disagrees with exact arithmetic. Expected ${displayRational(item.answer)}.`,
    );
  return item;
}
