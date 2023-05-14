import {
  assert,
  assertEquals,
  AssertionError,
  assertRejects,
  assertThrows,
} from "https://deno.land/std@0.186.0/testing/asserts.ts";
import {
  deadline,
  DeadlineError,
  deferred,
} from "https://deno.land/std@0.186.0/async/mod.ts";
import {
  Channel,
  channel,
  pop,
  push,
} from "https://deno.land/x/streamtools@v0.4.1/mod.ts";
import { buildRedrawCommand } from "./command.ts";
import { buildMessage, Message } from "./message.ts";
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
    "throws an error if the session is not started",
    () => {
      const { session } = createDummySession();

      const command = buildRedrawCommand();
      assertThrows(
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
      session.send(command);
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
      session.send(message);
      assertEquals(
        JSON.parse(decoder.decode(ensureNotNull(await pop(output.reader)))),
        message,
      );
    },
  );
});

Deno.test("Session.recv", async (t) => {
  await t.step(
    "throws an error if the session is not started",
    () => {
      const { session } = createDummySession();

      assertThrows(() => session.recv(-1), Error, "Session is not running");
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
});

Deno.test("Session.wait", async (t) => {
  await t.step(
    "throws an error if the session is not started",
    () => {
      const { session } = createDummySession();

      assertThrows(() => session.wait(), Error, "Session is not running");
    },
  );

  await t.step(
    "returns a promise that is resolved when the session is closed (reader is closed)",
    async () => {
      const output = channel<Uint8Array>();
      const guard = deferred();
      const session = new Session(
        // Reader that is not closed until the guard is resolved
        new ReadableStream({
          async start(controller) {
            await guard;
            controller.close();
          },
        }),
        output.writer,
      );

      session.start();

      const waiter = session.wait();
      await assertRejects(
        () => deadline(waiter, 100),
        DeadlineError,
      );
      guard.resolve();
      await deadline(waiter, 100);
    },
  );
});

Deno.test("Session.shutdown", async (t) => {
  await t.step(
    "throws an error if the session is not started",
    () => {
      const { session } = createDummySession();

      assertThrows(() => session.shutdown(), Error, "Session is not running");
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
      const guard = deferred();
      const session = new Session(
        input.reader,
        // Writer that is not processed until the guard is resolved
        new WritableStream({
          async write() {
            await guard;
          },
        }),
      );

      session.start();
      session.send(["redraw", ""]);
      const shutdown = session.shutdown();
      await assertRejects(
        () => deadline(shutdown, 100),
        DeadlineError,
      );
      // Process all messages
      guard.resolve();
      await deadline(shutdown, 100);
    },
  );
});

Deno.test("Session.forceShutdown", async (t) => {
  await t.step(
    "throws an error if the session is not started",
    () => {
      const { session } = createDummySession();

      assertThrows(
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
      const guard = deferred();
      const session = new Session(
        input.reader,
        // Writer that is not processed until the guard is resolved
        new WritableStream({
          async write() {
            await guard;
          },
        }),
      );

      session.start();
      session.send(["redraw", ""]);
      const shutdown = session.forceShutdown();
      await deadline(shutdown, 100);
    },
  );
});
