import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.186.0/testing/asserts.ts";
import * as command from "./command.ts";
import {
  buildCallCommand,
  buildExCommand,
  buildExprCommand,
  buildNormalCommand,
  buildRedrawCommand,
} from "./command.ts";

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

Deno.test("buildRedrawCommand", async (t) => {
  await t.step("builds a redraw command", () => {
    assertEquals(buildRedrawCommand(), ["redraw", ""]);
  });

  await t.step("builds a redraw command with force", () => {
    assertEquals(buildRedrawCommand(true), ["redraw", "force"]);
  });
});

Deno.test("buildExCommand", async (t) => {
  await t.step("builds a ex command", () => {
    assertEquals(buildExCommand("echo 'Hello'"), ["ex", "echo 'Hello'"]);
  });
});

Deno.test("buildNormalCommand", async (t) => {
  await t.step("builds a normal command", () => {
    assertEquals(buildNormalCommand("iHello"), ["normal", "iHello"]);
  });
});

Deno.test("buildExprCommand", async (t) => {
  await t.step("builds a expr command", () => {
    assertEquals(buildExprCommand("1 + 1"), ["expr", "1 + 1"]);
  });

  await t.step("builds a expr command with msgid", () => {
    assertEquals(buildExprCommand("1 + 1", -1), ["expr", "1 + 1", -1]);
  });

  await t.step("throws an error when msgid is not negative", () => {
    assertThrows(
      () => buildExprCommand("1 + 1", 0),
      Error,
      "must be a negative number",
    );
    assertThrows(
      () => buildExprCommand("1 + 1", 1),
      Error,
      "must be a negative number",
    );
  });
});

Deno.test("buildCallCommand", async (t) => {
  await t.step("builds a call command", () => {
    assertEquals(buildCallCommand("fn", [1, 2, 3]), ["call", "fn", [1, 2, 3]]);
  });

  await t.step("builds a call command with msgid", () => {
    assertEquals(buildCallCommand("fn", [1, 2, 3], -1), [
      "call",
      "fn",
      [1, 2, 3],
      -1,
    ]);
  });

  await t.step("throws an error when msgid is not negative", () => {
    assertThrows(
      () => buildCallCommand("fn", [1, 2, 3], 0),
      Error,
      "must be a negative number",
    );
    assertThrows(
      () => buildCallCommand("fn", [1, 2, 3], 1),
      Error,
      "must be a negative number",
    );
  });
});
