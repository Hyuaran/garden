import { expect, it } from "vitest";
import { normalizeKanriNo } from "./kanri-no";

it.each([
  ["PD1527681", "1527681"],
  ["PD1527681（2）", "1527681"],
  ["1527681", "1527681"],
  ["　pd００１５２７６８１（２）　", "1527681"],
  ["000", "0"],
  ["090-4030-6311", null],
  ["1211939ｆ", null],
  ["123(2)456", null],
  ["", null],
])("normalizes %j to %j", (input, expected) => {
  expect(normalizeKanriNo(input)).toBe(expected);
});
