import { assertEquals } from "https://deno.land/std@0.164.0/testing/asserts.ts";
import * as message from "./message.ts";

const isMessageTestCases = [
  [[12, "hello"], true],
  [[0, "response"], true],
];
for (const t of isMessageTestCases) {
  Deno.test(`isMessage() returns ${t[1]} for ${JSON.stringify(t[0])}`, () => {
    assertEquals(message.isMessage(t[0]), t[1]);
  });
}
