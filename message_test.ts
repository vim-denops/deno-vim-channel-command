import { assertEquals } from "@std/assert";
import { buildMessage, isMessage } from "./message.ts";

const isMessageTestCases = [
  [[12, "hello"], true],
  [[0, "response"], true],
];
for (const t of isMessageTestCases) {
  Deno.test(`isMessage() returns ${t[1]} for ${JSON.stringify(t[0])}`, () => {
    assertEquals(isMessage(t[0]), t[1]);
  });
}

Deno.test("buildMessage", async (t) => {
  await t.step("builds a message", () => {
    assertEquals(buildMessage(1, "Hello"), [1, "Hello"]);
  });
});
