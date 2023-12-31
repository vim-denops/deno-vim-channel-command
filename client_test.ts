import {
  assertEquals,
  assertRejects,
  assertThrows,
} from "https://deno.land/std@0.186.0/testing/asserts.ts";
import { buildMessage } from "./message.ts";
import { Client } from "./client.ts";

Deno.test("Client.reply", async (t) => {
  await t.step("sends a message", async () => {
    const receives: unknown[] = [];
    const session = {
      send: (message: unknown) => {
        receives.push(message);
        return Promise.resolve();
      },
      recv: () => {
        throw new Error("should not be called");
      },
    };
    const client = new Client(session);
    await client.reply(1, "Hello");
    await client.reply(2, "World");
    assertEquals(receives, [
      [1, "Hello"],
      [2, "World"],
    ]);
  });

  await t.step("throws an error when send fails", () => {
    const session = {
      send: () => {
        throw new Error("send error");
      },
      recv: () => {
        throw new Error("should not be called");
      },
    };
    const client = new Client(session);
    assertThrows(() => client.redraw(), Error, "send error");
  });
});

Deno.test("Client.redraw", async (t) => {
  await t.step("sends a redraw command", async () => {
    const receives: unknown[] = [];
    const session = {
      send: (message: unknown) => {
        receives.push(message);
        return Promise.resolve();
      },
      recv: () => {
        throw new Error("should not be called");
      },
    };
    const client = new Client(session);
    await client.redraw();
    await client.redraw(true);
    assertEquals(receives, [
      ["redraw", ""],
      ["redraw", "force"],
    ]);
  });

  await t.step("throws an error when send fails", () => {
    const session = {
      send: () => {
        throw new Error("send error");
      },
      recv: () => {
        throw new Error("should not be called");
      },
    };
    const client = new Client(session);
    assertThrows(() => client.redraw(), Error, "send error");
  });
});

Deno.test("Client.ex", async (t) => {
  await t.step("sends a ex command", async () => {
    const receives: unknown[] = [];
    const session = {
      send: (message: unknown) => {
        receives.push(message);
        return Promise.resolve();
      },
      recv: () => {
        throw new Error("should not be called");
      },
    };
    const client = new Client(session);
    await client.ex("echo 'Hello'");
    assertEquals(receives, [
      ["ex", "echo 'Hello'"],
    ]);
  });

  await t.step("throws an error when send fails", () => {
    const session = {
      send: () => {
        throw new Error("send error");
      },
      recv: () => {
        throw new Error("should not be called");
      },
    };
    const client = new Client(session);
    assertThrows(() => client.ex("echo 'Hello'"), Error, "send error");
  });
});

Deno.test("Client.normal", async (t) => {
  await t.step("sends a normal command", async () => {
    const receives: unknown[] = [];
    const session = {
      send: (message: unknown) => {
        receives.push(message);
        return Promise.resolve();
      },
      recv: () => {
        throw new Error("should not be called");
      },
    };
    const client = new Client(session);
    await client.normal("zO");
    assertEquals(receives, [
      ["normal", "zO"],
    ]);
  });

  await t.step("throws an error when send fails", () => {
    const session = {
      send: () => {
        throw new Error("send error");
      },
      recv: () => {
        throw new Error("should not be called");
      },
    };
    const client = new Client(session);
    assertThrows(() => client.normal("zO"), Error, "send error");
  });
});

Deno.test("Client.expr", async (t) => {
  await t.step("sends a expr command and waits for a response", async () => {
    const receives: unknown[] = [];
    const session = {
      send: (message: unknown) => {
        receives.push(message);
        return Promise.resolve();
      },
      recv: (msgid: number) =>
        Promise.resolve(buildMessage(msgid, `response:${msgid}`)),
    };
    const client = new Client(session);
    assertEquals(
      await client.expr("g:vim_deno_channel_command"),
      "response:-1",
    );
    assertEquals(
      await client.expr("g:vim_deno_channel_command"),
      "response:-2",
    );
    assertEquals(receives, [
      ["expr", "g:vim_deno_channel_command", -1],
      ["expr", "g:vim_deno_channel_command", -2],
    ]);
  });

  await t.step("rejects with an error when send fails", async () => {
    const session = {
      send: () => {
        throw new Error("send error");
      },
      recv: (msgid: number) =>
        Promise.resolve(buildMessage(msgid, `response:${msgid}`)),
    };
    const client = new Client(session);
    await assertRejects(
      () => client.expr("g:vim_deno_channel_command"),
      Error,
      "send error",
    );
  });

  await t.step("rejects with an error when recv fails", async () => {
    const session = {
      send: () => {
        // Do NOTHING
        return Promise.resolve();
      },
      recv: () => {
        throw new Error("recv error");
      },
    };
    const client = new Client(session);
    await assertRejects(
      () => client.expr("g:vim_deno_channel_command"),
      Error,
      "recv error",
    );
  });
});

Deno.test("Client.exprNoReply", async (t) => {
  await t.step("sends a expr command", async () => {
    const receives: unknown[] = [];
    const session = {
      send: (message: unknown) => {
        receives.push(message);
        return Promise.resolve();
      },
      recv: () => {
        throw new Error("should not be called");
      },
    };
    const client = new Client(session);
    await client.exprNoReply("g:vim_deno_channel_command");
    assertEquals(receives, [
      ["expr", "g:vim_deno_channel_command"],
    ]);
  });

  await t.step("throws an error when send fails", () => {
    const session = {
      send: () => {
        throw new Error("send error");
      },
      recv: () => {
        throw new Error("should not be called");
      },
    };
    const client = new Client(session);
    assertThrows(
      () => client.exprNoReply("g:vim_deno_channel_command"),
      Error,
      "send error",
    );
  });
});

Deno.test("Client.call", async (t) => {
  await t.step("sends a call command and waits for a response", async () => {
    const receives: unknown[] = [];
    const session = {
      send: (message: unknown) => {
        receives.push(message);
        return Promise.resolve();
      },
      recv: (msgid: number) =>
        Promise.resolve(buildMessage(msgid, `response:${msgid}`)),
    };
    const client = new Client(session);
    assertEquals(await client.call("foo", "bar"), "response:-1");
    assertEquals(await client.call("foo", "bar"), "response:-2");
    assertEquals(receives, [
      ["call", "foo", ["bar"], -1],
      ["call", "foo", ["bar"], -2],
    ]);
  });

  await t.step("rejects with an error when send fails", async () => {
    const session = {
      send: () => {
        throw new Error("send error");
      },
      recv: (msgid: number) =>
        Promise.resolve(buildMessage(msgid, `response:${msgid}`)),
    };
    const client = new Client(session);
    await assertRejects(
      () => client.call("foo", "bar"),
      Error,
      "send error",
    );
  });

  await t.step("rejects with an error when recv fails", async () => {
    const session = {
      send: () => {
        // Do NOTHING
        return Promise.resolve();
      },
      recv: () => {
        throw new Error("recv error");
      },
    };
    const client = new Client(session);
    await assertRejects(
      () => client.call("foo", "bar"),
      Error,
      "recv error",
    );
  });
});

Deno.test("Client.callNoReply", async (t) => {
  await t.step("sends a call command", async () => {
    const receives: unknown[] = [];
    const session = {
      send: (message: unknown) => {
        receives.push(message);
        return Promise.resolve();
      },
      recv: () => {
        throw new Error("should not be called");
      },
    };
    const client = new Client(session);
    await client.callNoReply("foo", "bar");
    assertEquals(receives, [
      ["call", "foo", ["bar"]],
    ]);
  });

  await t.step("throws an error when send fails", () => {
    const session = {
      send: () => {
        throw new Error("send error");
      },
      recv: () => {
        throw new Error("should not be called");
      },
    };
    const client = new Client(session);
    assertThrows(() => client.callNoReply("foo", "bar"), Error, "send error");
  });
});
