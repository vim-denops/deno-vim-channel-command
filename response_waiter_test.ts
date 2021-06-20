import { assertEquals, assertThrowsAsync } from "./deps_test.ts";
import { Message, MessageId } from "./message.ts";
import { ResponseWaiter, TimeoutError } from "./response_waiter.ts";

Deno.test({
  name: "ReseponseWaiter.wait() waits a response message",
  fn: async () => {
    const msgid: MessageId = 0;
    const waiter = new ResponseWaiter();
    const consumer = async () => {
      const promise = waiter.wait(msgid);
      assertEquals(waiter.waiterCount, 1);
      const [_msgid, result] = await promise;
      assertEquals(waiter.waiterCount, 0);
      return result;
    };
    const producer = async () => {
      await Promise.resolve();
      const message: Message = [msgid, "OK"];
      waiter.provide(message);
    };
    const result = await Promise.all([consumer(), producer()]);
    assertEquals(result, ["OK", undefined]);
  },
});

Deno.test({
  name:
    "ReseponseWaiter.wait() throws TimeoutError and remove the internal waiter",
  fn: async () => {
    const msgid: MessageId = 0;
    const waiter = new ResponseWaiter();
    await assertThrowsAsync(async () => {
      const promise = waiter.wait(msgid, 1);
      assertEquals(waiter.waiterCount, 1);
      await promise;
    }, TimeoutError);
    assertEquals(waiter.waiterCount, 0);
  },
});
