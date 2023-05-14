import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.186.0/testing/asserts.ts";
import {
  buildCallCommand,
  buildExCommand,
  buildExprCommand,
  buildNormalCommand,
  buildRedrawCommand,
} from "./command.ts";

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
