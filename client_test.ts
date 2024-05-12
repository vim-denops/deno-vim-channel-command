import { assertEquals, assertRejects } from "@std/assert";
import {
  assertSpyCallArgs,
  assertSpyCalls,
  resolvesNext,
  spy,
  stub,
} from "@std/testing/mock";
import { unimplemented } from "@lambdalisue/errorutil";
import { Indexer } from "@lambdalisue/indexer";
import { buildMessage, type Message } from "./message.ts";
import { Client } from "./client.ts";

type Session = ConstructorParameters<typeof Client>[0];

const session: Session = {
  send: () => unimplemented(),
  recv: () => unimplemented(),
};

Deno.test("Client.reply", async (t) => {
  await t.step("sends a message", async () => {
    using s1 = stub(session, "send", resolvesNext([undefined, undefined]));
    using s2 = spy(session, "recv");
    const client = new Client(session);
    await client.reply(1, "Hello");
    assertSpyCalls(s1, 1);
    assertSpyCallArgs(s1, 0, [[1, "Hello"]]);
    assertSpyCalls(s2, 0);
    await client.reply(2, "World");
    assertSpyCalls(s1, 2);
    assertSpyCallArgs(s1, 1, [[2, "World"]]);
    assertSpyCalls(s2, 0);
  });

  await t.step("rejects an error when send fails", async () => {
    using s1 = stub(
      session,
      "send",
      resolvesNext<void>([new Error("send error")]),
    );
    using s2 = spy(session, "recv");
    const client = new Client(session);
    await assertRejects(() => client.reply(1, "Hello"), Error, "send error");
    assertSpyCalls(s1, 1);
    assertSpyCalls(s2, 0);
  });
});

Deno.test("Client.redraw", async (t) => {
  await t.step("sends a redraw command", async () => {
    using s1 = stub(session, "send", resolvesNext([undefined, undefined]));
    using s2 = spy(session, "recv");
    const client = new Client(session);
    await client.redraw();
    assertSpyCalls(s1, 1);
    assertSpyCallArgs(s1, 0, [["redraw", ""]]);
    assertSpyCalls(s2, 0);
    await client.redraw(true);
    assertSpyCalls(s1, 2);
    assertSpyCallArgs(s1, 1, [["redraw", "force"]]);
    assertSpyCalls(s2, 0);
  });

  await t.step("rejects an error when send fails", async () => {
    using s1 = stub(
      session,
      "send",
      resolvesNext<void>([new Error("send error")]),
    );
    using s2 = spy(session, "recv");
    const client = new Client(session);
    await assertRejects(() => client.redraw(), Error, "send error");
    assertSpyCalls(s1, 1);
    assertSpyCalls(s2, 0);
  });
});

Deno.test("Client.ex", async (t) => {
  await t.step("sends a ex command", async () => {
    using s1 = stub(session, "send", resolvesNext([undefined]));
    using s2 = spy(session, "recv");
    const client = new Client(session);
    await client.ex("echo 'Hello'");
    assertSpyCalls(s1, 1);
    assertSpyCallArgs(s1, 0, [["ex", "echo 'Hello'"]]);
    assertSpyCalls(s2, 0);
  });

  await t.step("rejects an error when send fails", async () => {
    using s1 = stub(
      session,
      "send",
      resolvesNext<void>([new Error("send error")]),
    );
    using s2 = spy(session, "recv");
    const client = new Client(session);
    await assertRejects(() => client.ex("echo 'Hello'"), Error, "send error");
    assertSpyCalls(s1, 1);
    assertSpyCalls(s2, 0);
  });
});

Deno.test("Client.normal", async (t) => {
  await t.step("sends a normal command", async () => {
    using s1 = stub(session, "send", resolvesNext([undefined]));
    using s2 = spy(session, "recv");
    const client = new Client(session);
    await client.normal("zO");
    assertSpyCalls(s1, 1);
    assertSpyCallArgs(s1, 0, [["normal", "zO"]]);
    assertSpyCalls(s2, 0);
  });

  await t.step("rejects an error when send fails", async () => {
    using s1 = stub(
      session,
      "send",
      resolvesNext<void>([new Error("send error")]),
    );
    using s2 = spy(session, "recv");
    const client = new Client(session);
    await assertRejects(() => client.normal("zO"), Error, "send error");
    assertSpyCalls(s1, 1);
    assertSpyCalls(s2, 0);
  });
});

Deno.test("Client.expr", async (t) => {
  await t.step("sends a expr command and waits for a response", async () => {
    using s1 = stub(session, "send", resolvesNext([undefined, undefined]));
    using s2 = stub(
      session,
      "recv",
      (msgid: number) =>
        Promise.resolve(buildMessage(msgid, `response:${msgid}`)),
    );
    const client = new Client(session);
    assertEquals(
      await client.expr("g:vim_deno_channel_command"),
      "response:-1",
    );
    assertSpyCalls(s1, 1);
    assertSpyCallArgs(s1, 0, [["expr", "g:vim_deno_channel_command", -1]]);
    assertSpyCalls(s2, 1);
    assertSpyCallArgs(s2, 0, [-1]);
    assertEquals(
      await client.expr("g:vim_deno_channel_command"),
      "response:-2",
    );
    assertSpyCalls(s1, 2);
    assertSpyCallArgs(s1, 1, [["expr", "g:vim_deno_channel_command", -2]]);
    assertSpyCalls(s2, 2);
    assertSpyCallArgs(s2, 1, [-2]);
  });

  await t.step(
    "sends a expr command and waits for a response (multiple clients)",
    async () => {
      using s1 = stub(session, "send", resolvesNext([undefined, undefined]));
      using s2 = stub(
        session,
        "recv",
        (msgid: number) =>
          Promise.resolve(buildMessage(msgid, `response:${msgid}`)),
      );
      const indexer = new Indexer();
      const client1 = new Client(session, indexer);
      const client2 = new Client(session, indexer);
      assertEquals(
        await client1.expr("g:vim_deno_channel_command"),
        "response:-1",
      );
      assertSpyCalls(s1, 1);
      assertSpyCallArgs(s1, 0, [["expr", "g:vim_deno_channel_command", -1]]);
      assertSpyCalls(s2, 1);
      assertSpyCallArgs(s2, 0, [-1]);
      assertEquals(
        await client2.expr("g:vim_deno_channel_command"),
        "response:-2",
      );
      assertSpyCalls(s1, 2);
      assertSpyCallArgs(s1, 1, [["expr", "g:vim_deno_channel_command", -2]]);
      assertSpyCalls(s2, 2);
      assertSpyCallArgs(s2, 1, [-2]);
    },
  );

  await t.step("rejects with an error when send fails", async () => {
    using s1 = stub(
      session,
      "send",
      resolvesNext<void>([new Error("send error")]),
    );
    using s2 = stub(
      session,
      "recv",
      (msgid: number) =>
        Promise.resolve(buildMessage(msgid, `response:${msgid}`)),
    );
    const client = new Client(session);
    await assertRejects(
      () => client.expr("g:vim_deno_channel_command"),
      Error,
      "send error",
    );
    assertSpyCalls(s1, 1);
    assertSpyCalls(s2, 1);
  });

  await t.step("rejects with an error when recv fails", async () => {
    using s1 = stub(session, "send", resolvesNext([undefined]));
    using s2 = stub(
      session,
      "recv",
      resolvesNext<Message>([new Error("recv error")]),
    );
    const client = new Client(session);
    await assertRejects(
      () => client.expr("g:vim_deno_channel_command"),
      Error,
      "recv error",
    );
    assertSpyCalls(s1, 1);
    assertSpyCalls(s2, 1);
  });
});

Deno.test("Client.exprNoReply", async (t) => {
  await t.step("sends a expr command", async () => {
    using s1 = stub(session, "send", resolvesNext([undefined]));
    using s2 = spy(session, "recv");
    const client = new Client(session);
    await client.exprNoReply("g:vim_deno_channel_command");
    assertSpyCalls(s1, 1);
    assertSpyCallArgs(s1, 0, [["expr", "g:vim_deno_channel_command"]]);
    assertSpyCalls(s2, 0);
  });

  await t.step("rejects an error when send fails", async () => {
    using s1 = stub(
      session,
      "send",
      resolvesNext<void>([new Error("send error")]),
    );
    using s2 = spy(session, "recv");
    const client = new Client(session);
    await assertRejects(
      () => client.exprNoReply("g:vim_deno_channel_command"),
      Error,
      "send error",
    );
    assertSpyCalls(s1, 1);
    assertSpyCalls(s2, 0);
  });
});

Deno.test("Client.call", async (t) => {
  await t.step("sends a call command and waits for a response", async () => {
    using s1 = stub(session, "send", resolvesNext([undefined, undefined]));
    using s2 = stub(
      session,
      "recv",
      (msgid: number) =>
        Promise.resolve(buildMessage(msgid, `response:${msgid}`)),
    );
    const client = new Client(session);
    assertEquals(await client.call("foo", "bar"), "response:-1");
    assertSpyCalls(s1, 1);
    assertSpyCallArgs(s1, 0, [["call", "foo", ["bar"], -1]]);
    assertSpyCalls(s2, 1);
    assertSpyCallArgs(s2, 0, [-1]);
    assertEquals(await client.call("foo", "bar"), "response:-2");
    assertSpyCalls(s1, 2);
    assertSpyCallArgs(s1, 1, [["call", "foo", ["bar"], -2]]);
    assertSpyCalls(s2, 2);
    assertSpyCallArgs(s2, 1, [-2]);
  });

  await t.step(
    "sends a call command and waits for a response (multiple clients)",
    async () => {
      using s1 = stub(session, "send", resolvesNext([undefined, undefined]));
      using s2 = stub(
        session,
        "recv",
        (msgid: number) =>
          Promise.resolve(buildMessage(msgid, `response:${msgid}`)),
      );
      const indexer = new Indexer();
      const client1 = new Client(session, indexer);
      const client2 = new Client(session, indexer);
      assertEquals(await client1.call("foo", "bar"), "response:-1");
      assertSpyCalls(s1, 1);
      assertSpyCallArgs(s1, 0, [["call", "foo", ["bar"], -1]]);
      assertSpyCalls(s2, 1);
      assertSpyCallArgs(s2, 0, [-1]);
      assertEquals(await client2.call("foo", "bar"), "response:-2");
      assertSpyCalls(s1, 2);
      assertSpyCallArgs(s1, 1, [["call", "foo", ["bar"], -2]]);
      assertSpyCalls(s2, 2);
      assertSpyCallArgs(s2, 1, [-2]);
    },
  );

  await t.step("rejects with an error when send fails", async () => {
    using s1 = stub(
      session,
      "send",
      resolvesNext<void>([new Error("send error")]),
    );
    using s2 = stub(
      session,
      "recv",
      (msgid: number) =>
        Promise.resolve(buildMessage(msgid, `response:${msgid}`)),
    );
    const client = new Client(session);
    await assertRejects(
      () => client.call("foo", "bar"),
      Error,
      "send error",
    );
    assertSpyCalls(s1, 1);
    assertSpyCalls(s2, 1);
  });

  await t.step("rejects with an error when recv fails", async () => {
    using s1 = stub(session, "send", resolvesNext([undefined]));
    using s2 = stub(
      session,
      "recv",
      resolvesNext<Message>([new Error("recv error")]),
    );
    const client = new Client(session);
    await assertRejects(
      () => client.call("foo", "bar"),
      Error,
      "recv error",
    );
    assertSpyCalls(s1, 1);
    assertSpyCalls(s2, 1);
  });
});

Deno.test("Client.callNoReply", async (t) => {
  await t.step("sends a call command", async () => {
    using s1 = stub(session, "send", resolvesNext([undefined]));
    using s2 = spy(session, "recv");
    const client = new Client(session);
    await client.callNoReply("foo", "bar");
    assertSpyCalls(s1, 1);
    assertSpyCallArgs(s1, 0, [["call", "foo", ["bar"]]]);
    assertSpyCalls(s2, 0);
  });

  await t.step("rejects an error when send fails", async () => {
    using s1 = stub(
      session,
      "send",
      resolvesNext<void>([new Error("send error")]),
    );
    using s2 = spy(session, "recv");
    const client = new Client(session);
    await assertRejects(
      () => client.callNoReply("foo", "bar"),
      Error,
      "send error",
    );
    assertSpyCalls(s1, 1);
    assertSpyCalls(s2, 0);
  });
});
