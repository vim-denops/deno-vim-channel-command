import { assertEquals } from "https://deno.land/std@0.164.0/testing/asserts.ts";
import * as command from "./command.ts";

const isRedrawCommandTestCases = [
  [["redraw", ""], true],
  [["redraw", "force"], true],
];
for (const t of isRedrawCommandTestCases) {
  Deno.test(
    `isRedrawCommand() returns ${t[1]} for ${JSON.stringify(t[0])}`,
    () => {
      assertEquals(command.isRedrawCommand(t[0]), t[1]);
    },
  );
}

const isExCommandTestCases = [[["ex", "call myscript#MyFunc(arg)"], true]];
for (const t of isExCommandTestCases) {
  Deno.test(`isExCommand() returns ${t[1]} for ${JSON.stringify(t[0])}`, () => {
    assertEquals(command.isExCommand(t[0]), t[1]);
  });
}

const isNormalCommandTestCases = [[["normal", "zO"], true]];
for (const t of isNormalCommandTestCases) {
  Deno.test(
    `isNormalCommand() returns ${t[1]} for ${JSON.stringify(t[0])}`,
    () => {
      assertEquals(command.isNormalCommand(t[0]), t[1]);
    },
  );
}

const isExprCommandTestCases = [
  [["expr", "line('$')", -2], true],
  [["expr", "setline('$', ['one', 'two', 'three'])"], true],
];
for (const t of isExprCommandTestCases) {
  Deno.test(
    `isExprCommand() returns ${t[1]} for ${JSON.stringify(t[0])}`,
    () => {
      assertEquals(command.isExprCommand(t[0]), t[1]);
    },
  );
}

const isCallCommandTestCases = [
  [["call", "line", ["$"], -2], true],
  [["call", "setline", ["$", ["one", "two", "three"]]], true],
];
for (const t of isCallCommandTestCases) {
  Deno.test(
    `isCallCommand() returns ${t[1]} for ${JSON.stringify(t[0])}`,
    () => {
      assertEquals(command.isCallCommand(t[0]), t[1]);
    },
  );
}
