import {
  assert,
  assertEquals,
  AssertionError,
  assertRejects,
  assertThrows,
} from "@std/assert";
import { promiseState } from "@lambdalisue/async";
import { type Channel, channel, pop, push } from "@lambdalisue/streamtools";
import { AlreadyReservedError } from "@lambdalisue/reservator";
import { buildRedrawCommand } from "./command.ts";
import { buildMessage, type Message } from "./message.ts";
import { Session } from "./session.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function createDummySession(): {
  input: Channel<Uint8Array>;
  output: Channel<Uint8Array>;
  session: Session;
} {
  const input = channel<Uint8Array>();
  const output = channel<Uint8Array>();
  const session = new Session(input.reader, output.writer);
  return { input, output, session };
}

function ensureNotNull<T>(value: T | null): T {
  if (value === null) {
    throw new AssertionError("value must not be null");
  }
  return value;
}

Deno.test("Session.send", async (t) => {
  await t.step(
    "rejects an error if the session is not started",
    async () => {
      const { session } = createDummySession();

      const command = buildRedrawCommand();
      await assertRejects(
        () => session.send(command),
        Error,
        "Session is not running",
      );
    },
  );

  await t.step(
    "sends a command to the specified writer",
    async () => {
      const { session, output } = createDummySession();

      session.start();

      const command = buildRedrawCommand();
      await session.send(command);
      assertEquals(
        JSON.parse(decoder.decode(ensureNotNull(await pop(output.reader)))),
        command,
      );
    },
  );

  await t.step(
    "sends a message to the specified writer",
    async () => {
      const { session, output } = createDummySession();

      session.start();

      const message = buildMessage(0, "Hello");
      await session.send(message);
      assertEquals(
        JSON.parse(decoder.decode(ensureNotNull(await pop(output.reader)))),
        message,
      );
    },
  );
});

Deno.test("Session.recv", async (t) => {
  await t.step(
    "rejects an error if the session is not started",
    async () => {
      const { session } = createDummySession();

      await assertRejects(
        () => session.recv(-1),
        Error,
        "Session is not running",
      );
    },
  );

  await t.step(
    "rejects an error if the message ID is already reserved",
    async () => {
      const { session } = createDummySession();

      session.start();
      session.recv(-1);

      await assertRejects(
        () => session.recv(-1),
        AlreadyReservedError,
      );
    },
  );

  await t.step(
    "waits a command response message and resolves with it",
    async () => {
      const { session, input } = createDummySession();

      session.start();

      const response = session.recv(-1);

      const message = buildMessage(-1, "Hello");
      await push(input.writer, encoder.encode(JSON.stringify(message)));
      assertEquals(await response, message);
    },
  );
});

Deno.test("Session.start", async (t) => {
  await t.step(
    "throws an error if the session is already started",
    () => {
      const { session } = createDummySession();

      session.start();
      assertThrows(() => session.start(), Error, "Session is already running");
    },
  );

  await t.step(
    "locks specified reader and writer",
    () => {
      const { session, input, output } = createDummySession();

      session.start();
      assert(input.reader.locked, "reader is not locked");
      assert(output.writer.locked, "writer is not locked");
    },
  );

  await t.step(
    "calls `onMessage` when a message is received",
    async () => {
      const received: Message[] = [];
      const { session, input } = createDummySession();
      session.onMessage = (message) => {
        received.push(message);
      };

      session.start();

      const message: Message = [1, 3];
      await push(input.writer, encoder.encode(JSON.stringify(message)));
      assertEquals(received, [message]);
    },
  );

  await t.step(
    "calls `onInvalidMessage` when a invalid message is received",
    async () => {
      const received: unknown[] = [];
      const { session, input } = createDummySession();
      session.onInvalidMessage = (message) => {
        received.push(message);
      };

      session.start();

      const invalidMessage = "foo";
      await push(input.writer, encoder.encode(JSON.stringify(invalidMessage)));
      assertEquals(received, [invalidMessage]);
    },
  );
});

Deno.test("Session.wait", async (t) => {
  await t.step(
    "rejects an error if the session is not started",
    async () => {
      const { session } = createDummySession();

      await assertRejects(
        () => session.wait(),
        Error,
        "Session is not running",
      );
    },
  );

  await t.step(
    "returns a promise that is resolved when the session is closed (reader is closed)",
    async () => {
      const output = channel<Uint8Array>();
      const guard = Promise.withResolvers<void>();
      const session = new Session(
        // Reader that is not closed until the guard is resolved
        new ReadableStream({
          async start(controller) {
            await guard.promise;
            controller.close();
          },
        }),
        output.writer,
      );

      session.start();

      const waiter = session.wait();
      assertEquals(await promiseState(waiter), "pending");
      // Process all messages
      guard.resolve();
      assertEquals(await promiseState(waiter), "fulfilled");
    },
  );

  await t.step(
    "rejects an error if invalid data is received",
    async () => {
      const { session, input } = createDummySession();

      session.start();

      const waiter = session.wait();
      await push(input.writer, encoder.encode("[Invalid json]"));
      await assertRejects(
        () => waiter,
        Error,
        'Unexpected "I" at position "1"',
      );
    },
  );
});

Deno.test("Session.shutdown", async (t) => {
  await t.step(
    "rejects an error if the session is not started",
    async () => {
      const { session } = createDummySession();

      await assertRejects(
        () => session.shutdown(),
        Error,
        "Session is not running",
      );
    },
  );

  await t.step(
    "unlocks specified reader and writer",
    async () => {
      const { session, input, output } = createDummySession();

      session.start();
      await session.shutdown();
      assert(!input.reader.locked, "reader is locked");
      assert(!output.writer.locked, "writer is locked");
    },
  );

  await t.step(
    "waits until all messages are processed to the writer",
    async () => {
      const input = channel<Uint8Array>();
      const guard = Promise.withResolvers<void>();
      const session = new Session(
        input.reader,
        // Writer that is not processed until the guard is resolved
        new WritableStream({
          async write() {
            await guard.promise;
          },
        }),
      );

      session.start();
      await session.send(["redraw", ""]);
      const shutdown = session.shutdown();
      assertEquals(await promiseState(shutdown), "pending");
      // Process all messages
      guard.resolve();
      assertEquals(await promiseState(shutdown), "fulfilled");
    },
  );
});

Deno.test("Session.forceShutdown", async (t) => {
  await t.step(
    "rejects an error if the session is not started",
    async () => {
      const { session } = createDummySession();

      await assertRejects(
        () => session.forceShutdown(),
        Error,
        "Session is not running",
      );
    },
  );

  await t.step(
    "unlocks specified reader and writer",
    async () => {
      const { session, input, output } = createDummySession();

      session.start();
      await session.forceShutdown();
      assert(!input.reader.locked, "reader is locked");
      assert(!output.writer.locked, "writer is locked");
    },
  );

  await t.step(
    "does not wait until all messages are processed to the writer",
    async () => {
      const input = channel<Uint8Array>();
      const guard = Promise.withResolvers<void>();
      const session = new Session(
        input.reader,
        // Writer that is not processed until the guard is resolved
        new WritableStream({
          async write() {
            await guard.promise;
          },
        }),
      );

      session.start();
      session.send(["redraw", ""]); // Do NOT await
      const shutdown = session.forceShutdown();
      assertEquals(await promiseState(shutdown), "fulfilled");
    },
  );
});
