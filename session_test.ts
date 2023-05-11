import * as streams from "https://deno.land/std@0.186.0/streams/mod.ts";
import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.186.0/testing/asserts.ts";
import { delay } from "https://deno.land/std@0.186.0/async/mod.ts";
import { using } from "https://deno.land/x/disposable@v1.1.1/mod.ts";
// NOTE:
// streamparser-json must be v0.0.5 because it automatically end-up parsing without separator after v0.0.5
// https://github.com/juanjoDiaz/streamparser-json/commit/577e918b90c19d6758b87d41bdb6c5571a2c012d
import JSONParser from "https://deno.land/x/streamparser_json@v0.0.5/jsonparse.ts#=";
import { Session, SessionClosedError } from "./session.ts";
import { Indexer } from "./indexer.ts";
import * as command from "./command.ts";

const MSGID_THRESHOLD = 2 ** 32;
const BUFFER_SIZE = 32 * 1024;

const utf8Encoder = new TextEncoder();
const indexer = new Indexer(MSGID_THRESHOLD);

type Dispatcher = {
  redraw: (this: Vim, data: command.RedrawCommand) => void | Promise<void>;
  ex: (this: Vim, data: command.ExCommand) => void | Promise<void>;
  normal: (this: Vim, data: command.NormalCommand) => void | Promise<void>;
  expr: (this: Vim, data: command.ExprCommand) => void | Promise<void>;
  call: (this: Vim, data: command.CallCommand) => void | Promise<void>;
};

class Reader implements Deno.Reader, Deno.Closer {
  #queue: Uint8Array[];
  #remain: Uint8Array;
  #closed: boolean;
  #signal?: AbortSignal;

  constructor(queue: Uint8Array[], signal?: AbortSignal) {
    this.#queue = queue;
    this.#remain = new Uint8Array();
    this.#closed = false;
    this.#signal = signal;
  }

  close(): void {
    this.#closed = true;
  }

  async read(p: Uint8Array): Promise<number | null> {
    if (this.#remain.length) {
      return this.readFromRemain(p);
    }
    while (!this.#closed || this.#queue.length) {
      const v = this.#queue.shift();
      if (v) {
        this.#remain = v;
        return this.readFromRemain(p);
      }
      await delay(1, {
        signal: this.#signal,
      });
    }
    return null;
  }

  private readFromRemain(p: Uint8Array): number {
    const size = p.byteLength;
    const head = this.#remain.slice(0, size);
    this.#remain = this.#remain.slice(size);
    p.set(head);
    return head.byteLength;
  }
}

class Writer implements Deno.Writer {
  #queue: Uint8Array[];

  constructor(queue: Uint8Array[]) {
    this.#queue = queue;
  }

  write(p: Uint8Array): Promise<number> {
    this.#queue.push(p);
    return Promise.resolve(p.length);
  }
}

class Vim {
  #reader: Deno.Reader;
  #writer: Deno.Writer;
  #dispatcher: Dispatcher;
  #listener: Promise<void>;

  constructor(
    reader: Deno.Reader,
    writer: Deno.Writer,
    dispatcher: Partial<Dispatcher>,
  ) {
    this.#reader = reader;
    this.#writer = writer;
    this.#dispatcher = {
      redraw(data) {
        throw new Error(`Unexpected call: ${data}`);
      },
      ex(data) {
        throw new Error(`Unexpected call: ${data}`);
      },
      normal(data) {
        throw new Error(`Unexpected call: ${data}`);
      },
      expr(data) {
        throw new Error(`Unexpected call: ${data}`);
      },
      call(data) {
        throw new Error(`Unexpected call: ${data}`);
      },
      ...dispatcher,
    };
    this.#listener = this.listen().catch((e) => {
      console.error("Unexpected error occured", e);
    });
  }

  private async listen(): Promise<void> {
    const parser = new JSONParser();
    parser.onValue = (data, _key, _parent, stack) => {
      if (stack.length > 0) {
        return;
      }
      if (command.isRedrawCommand(data)) {
        this.#dispatcher.redraw.call(this, data);
      } else if (command.isExCommand(data)) {
        this.#dispatcher.ex.call(this, data);
      } else if (command.isNormalCommand(data)) {
        this.#dispatcher.normal.call(this, data);
      } else if (command.isExprCommand(data)) {
        this.#dispatcher.expr.call(this, data);
      } else if (command.isCallCommand(data)) {
        this.#dispatcher.call.call(this, data);
      } else {
        throw new Error(`Unexpected data received: ${data}`);
      }
    };
    const buf = new Uint8Array(BUFFER_SIZE);
    while (true) {
      const n = await this.#reader.read(buf);
      if (n == null) {
        break;
      }
      parser.write(buf.subarray(0, n));
    }
  }

  waitClosed(): Promise<void> {
    return this.#listener;
  }

  async send(data: unknown): Promise<void> {
    await streams.writeAll(
      this.#writer,
      utf8Encoder.encode(JSON.stringify(data)),
    );
  }
}

Deno.test("Session can invoke 'redraw'", async () => {
  const s2v: Uint8Array[] = []; // Local to Remote
  const v2s: Uint8Array[] = []; // Remote to Local
  const sr = new Reader(v2s);
  const sw = new Writer(s2v);
  const session = new Session(sr, sw);
  const vr = new Reader(s2v);
  const vw = new Writer(v2s);
  const vim = new Vim(vr, vw, {
    redraw(data) {
      const [_, expr] = data;
      assertEquals(expr, "");
    },
  });
  await session.redraw();
  // Close
  sr.close();
  vr.close();
  await Promise.all([
    session.waitClosed(),
    vim.waitClosed(),
  ]);
});

Deno.test("Session can invoke 'ex'", async () => {
  const s2v: Uint8Array[] = []; // Local to Remote
  const v2s: Uint8Array[] = []; // Remote to Local
  const sr = new Reader(v2s);
  const sw = new Writer(s2v);
  const session = new Session(sr, sw);
  const vr = new Reader(s2v);
  const vw = new Writer(v2s);
  const vim = new Vim(vr, vw, {
    ex(data) {
      const [_, expr] = data;
      assertEquals(expr, "echo 'Hello'");
    },
  });
  await session.ex("echo 'Hello'");
  // Close
  sr.close();
  vr.close();
  await Promise.all([
    session.waitClosed(),
    vim.waitClosed(),
  ]);
});

Deno.test("Session can invoke 'normal'", async () => {
  const s2v: Uint8Array[] = []; // Local to Remote
  const v2s: Uint8Array[] = []; // Remote to Local
  const sr = new Reader(v2s);
  const sw = new Writer(s2v);
  const session = new Session(sr, sw);
  const vr = new Reader(s2v);
  const vw = new Writer(v2s);
  const vim = new Vim(vr, vw, {
    normal(data) {
      const [_, expr] = data;
      assertEquals(expr, "<C-w>p");
    },
  });
  await session.normal("<C-w>p");
  // Close
  sr.close();
  vr.close();
  await Promise.all([
    session.waitClosed(),
    vim.waitClosed(),
  ]);
});

Deno.test("Session can invoke 'expr'", async () => {
  const s2v: Uint8Array[] = []; // Local to Remote
  const v2s: Uint8Array[] = []; // Remote to Local
  const sr = new Reader(v2s);
  const sw = new Writer(s2v);
  const session = new Session(sr, sw);
  const vr = new Reader(s2v);
  const vw = new Writer(v2s);
  const vim = new Vim(vr, vw, {
    async expr(data) {
      const [_, expr, msgid] = data;
      assertEquals(expr, "v:version");
      assertEquals(msgid, 0);
      await this.send([msgid, "800"]);
    },
  });
  assertEquals(await session.expr("v:version"), "800");
  // Close
  sr.close();
  vr.close();
  await Promise.all([
    session.waitClosed(),
    vim.waitClosed(),
  ]);
});

Deno.test("Session can invoke 'expr' without reply", async () => {
  const s2v: Uint8Array[] = []; // Local to Remote
  const v2s: Uint8Array[] = []; // Remote to Local
  const sr = new Reader(v2s);
  const sw = new Writer(s2v);
  const session = new Session(sr, sw);
  const vr = new Reader(s2v);
  const vw = new Writer(v2s);
  const vim = new Vim(vr, vw, {
    expr(data) {
      const [_, expr, msgid] = data;
      assertEquals(expr, "v:version");
      assertEquals(msgid, undefined);
    },
  });
  await session.exprNoReply("v:version");
  // Close
  sr.close();
  vr.close();
  await Promise.all([
    session.waitClosed(),
    vim.waitClosed(),
  ]);
});

Deno.test("Session can invoke 'call'", async () => {
  const s2v: Uint8Array[] = []; // Local to Remote
  const v2s: Uint8Array[] = []; // Remote to Local
  const sr = new Reader(v2s);
  const sw = new Writer(s2v);
  const session = new Session(sr, sw);
  const vr = new Reader(s2v);
  const vw = new Writer(v2s);
  const vim = new Vim(vr, vw, {
    async call(data) {
      const [_, fn, args, msgid] = data;
      assertEquals(fn, "say");
      assertEquals(args, ["John Titor"]);
      assertEquals(msgid, 0);
      await this.send([msgid, `Hello ${args[0]} from Remote`]);
    },
  });
  assertEquals(
    await session.call("say", "John Titor"),
    "Hello John Titor from Remote",
  );
  // Close
  sr.close();
  vr.close();
  await Promise.all([
    session.waitClosed(),
    vim.waitClosed(),
  ]);
});

Deno.test("Session can invoke 'call' without reply", async () => {
  const s2v: Uint8Array[] = []; // Local to Remote
  const v2s: Uint8Array[] = []; // Remote to Local
  const sr = new Reader(v2s);
  const sw = new Writer(s2v);
  const session = new Session(sr, sw);
  const vr = new Reader(s2v);
  const vw = new Writer(v2s);
  const vim = new Vim(vr, vw, {
    call(data) {
      const [_, fn, args, msgid] = data;
      assertEquals(fn, "say");
      assertEquals(args, ["John Titor"]);
      assertEquals(msgid, undefined);
    },
  });
  await session.callNoReply("say", "John Titor"),
    // Close
    sr.close();
  vr.close();
  await Promise.all([
    session.waitClosed(),
    vim.waitClosed(),
  ]);
});

Deno.test("Session can invoke arbitrary callback", async () => {
  const s2v: Uint8Array[] = []; // Local to Remote
  const v2s: Uint8Array[] = []; // Remote to Local
  const sr = new Reader(v2s);
  const sw = new Writer(s2v);
  const session = new Session(sr, sw, (message) => {
    try {
      const [_, value] = message as [unknown, string];
      assertEquals(value, "Hello world");
    } finally {
      // Close
      sr.close();
      vr.close();
    }
  });
  const vr = new Reader(s2v);
  const vw = new Writer(v2s);
  const vim = new Vim(vr, vw, {});
  await vim.send([indexer.next() * -1, "Hello world"]);
  await Promise.all([
    session.waitClosed(),
    vim.waitClosed(),
  ]);
});

Deno.test("Session can invoke arbitrary callback (incomplete)", async () => {
  const s2v: Uint8Array[] = []; // Local to Remote
  const v2s: Uint8Array[] = []; // Remote to Local
  const sr = new Reader(v2s);
  const sw = new Writer(s2v);
  const session = new Session(sr, sw, (message) => {
    try {
      const [_, value] = message as [unknown, string];
      assertEquals(value, "Hello world");
    } finally {
      // Close
      sr.close();
      vr.close();
    }
  });
  const vr = new Reader(s2v);
  const vw = new Writer(v2s);
  const vim = new Vim(vr, vw, {});
  await streams.writeAll(
    vw,
    utf8Encoder.encode(`[${indexer.next() * -1}, "Hello`),
  );
  await streams.writeAll(vw, utf8Encoder.encode(` world"]`));
  await Promise.all([
    session.waitClosed(),
    vim.waitClosed(),
  ]);
});

Deno.test("Session can invoke arbitrary callback (incomplete + massive)", async () => {
  const data = "0123456789".repeat(100000);
  const s2v: Uint8Array[] = []; // Local to Remote
  const v2s: Uint8Array[] = []; // Remote to Local
  const sr = new Reader(v2s);
  const sw = new Writer(s2v);
  const session = new Session(sr, sw, (message) => {
    try {
      const [_, value] = message as [unknown, string];
      assertEquals(value, data + data);
    } finally {
      // Close
      sr.close();
      vr.close();
    }
  });
  const vr = new Reader(s2v);
  const vw = new Writer(v2s);
  const vim = new Vim(vr, vw, {});
  await streams.writeAll(
    vw,
    utf8Encoder.encode(`[${indexer.next() * -1}, "${data}`),
  );
  await streams.writeAll(vw, utf8Encoder.encode(`${data}"]`));
  await Promise.all([
    session.waitClosed(),
    vim.waitClosed(),
  ]);
});

Deno.test("Session throws SessionClosedError on 'redraw' if the session has closed", async () => {
  const controller = new AbortController();
  const buffer: Uint8Array[] = [];
  const reader = new Reader(buffer, controller.signal);
  const writer = new Writer(buffer);
  const session = new Session(reader, writer);
  session.close();
  await assertRejects(async () => {
    await session.redraw();
  }, SessionClosedError);
  await session.waitClosed();
  reader.close();
  controller.abort();
});

Deno.test("Session throws SessionClosedError on 'ex' if the session has closed", async () => {
  const controller = new AbortController();
  const buffer: Uint8Array[] = [];
  const reader = new Reader(buffer, controller.signal);
  const writer = new Writer(buffer);
  const session = new Session(reader, writer);
  session.close();
  await assertRejects(async () => {
    await session.ex("echo 'Hello'");
  }, SessionClosedError);
  await session.waitClosed();
  reader.close();
  controller.abort();
});

Deno.test("Session throws SessionClosedError on 'normal' if the session has closed", async () => {
  const controller = new AbortController();
  const buffer: Uint8Array[] = [];
  const reader = new Reader(buffer, controller.signal);
  const writer = new Writer(buffer);
  const session = new Session(reader, writer);
  session.close();
  await assertRejects(async () => {
    await session.normal("<C-w>p");
  }, SessionClosedError);
  await session.waitClosed();
  reader.close();
  controller.abort();
});

Deno.test("Session throws SessionClosedError on 'expr' if the session has closed", async () => {
  const controller = new AbortController();
  const buffer: Uint8Array[] = [];
  const reader = new Reader(buffer, controller.signal);
  const writer = new Writer(buffer);
  const session = new Session(reader, writer);
  session.close();
  await assertRejects(async () => {
    await session.expr("v:version");
  }, SessionClosedError);
  await session.waitClosed();
  reader.close();
  controller.abort();
});

Deno.test("Session throws SessionClosedError on 'call' if the session has closed", async () => {
  const controller = new AbortController();
  const buffer: Uint8Array[] = [];
  const reader = new Reader(buffer, controller.signal);
  const writer = new Writer(buffer);
  const session = new Session(reader, writer);
  session.close();
  await assertRejects(async () => {
    await session.call("say");
  }, SessionClosedError);
  await session.waitClosed();
  reader.close();
  controller.abort();
});

Deno.test("Session is disposable", async () => {
  const controller = new AbortController();
  const s2v: Uint8Array[] = []; // Local to Remote
  const v2s: Uint8Array[] = []; // Remote to Local
  const sr = new Reader(v2s, controller.signal);
  const sw = new Writer(s2v);
  const session = new Session(sr, sw);
  const vr = new Reader(s2v, controller.signal);
  const vw = new Writer(v2s);
  const vim = new Vim(vr, vw, {
    async call(data) {
      const [_, fn, args, msgid] = data;
      assertEquals(fn, "say");
      assertEquals(args, ["John Titor"]);
      assertEquals(msgid, 0);
      await this.send([msgid, `Hello ${args[0]} from Remote`]);
    },
  });
  await using(session, async (session) => {
    // Session is not closed
    assertEquals(
      await session.call("say", "John Titor"),
      "Hello John Titor from Remote",
    );
  });
  // Session is closed by `dispose`
  await assertRejects(async () => {
    await session.call("say", "John Titor");
  }, SessionClosedError);
  // Close
  sr.close();
  vr.close();
  await Promise.all([
    session.waitClosed(),
    vim.waitClosed(),
  ]);
  controller.abort();
});
