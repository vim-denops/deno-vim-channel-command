import { Deferred, deferred, io } from "./deps.ts";
import { isMessage, Message } from "./message.ts";
import * as command from "./command.ts";
import { Indexer } from "./indexer.ts";
import { ResponseWaiter } from "./response_waiter.ts";

const MSGID_THRESHOLD = 2 ** 32;

const utf8Encoder = new TextEncoder();

export type Callback = (
  this: Session,
  message: Message,
) => void | Promise<void>;

/**
 * Session options
 */
export type SessionOptions = {
  /**
   * Response timeout in milliseconds
   */
  responseTimeout?: number;
};

/**
 * Vim's channel-command Session
 */
export class Session {
  #indexer: Indexer;
  #waiter: ResponseWaiter;
  #reader: Deno.Reader;
  #writer: Deno.Writer;
  #callback: Callback;
  #listener: Promise<void>;
  #closed: boolean;
  #closedSignal: Deferred<never>;

  /**
   * Constructor
   */
  constructor(
    reader: Deno.Reader,
    writer: Deno.Writer,
    callback: Callback = () => undefined,
    options: SessionOptions = {},
  ) {
    this.#indexer = new Indexer(MSGID_THRESHOLD);
    this.#waiter = new ResponseWaiter(
      options.responseTimeout,
    );
    this.#reader = reader;
    this.#writer = writer;
    this.#callback = callback;
    this.#closed = false;
    this.#closedSignal = deferred();
    this.#listener = this.listen().catch((e) => {
      console.error(`Unexpected error occured: ${e}`);
    });
  }

  private async send(data: Message | command.Command): Promise<void> {
    await io.writeAll(
      this.#writer,
      utf8Encoder.encode(JSON.stringify(data) + "\n"),
    );
  }

  private async listen(): Promise<void> {
    const iter = io.readLines(this.#reader);
    try {
      while (!this.#closed) {
        const { done, value } = await Promise.race([
          this.#closedSignal,
          iter.next(),
        ]);
        if (done) {
          return;
        }
        if (!value.trim()) {
          continue;
        }
        try {
          const data = JSON.parse(value);
          if (!isMessage(data)) {
            console.warn(`Unexpected data received: ${data}`);
            continue;
          }
          if (!this.#waiter.provide(data)) {
            // The message is not response. Invoke callback
            this.#callback.apply(this, [data]);
            continue;
          }
        } catch (e) {
          console.warn(`Failed to parse received text '${value}': ${e}`);
          continue;
        }
      }
    } catch (e) {
      if (e instanceof SessionClosedError) {
        return;
      }
      // https://github.com/denoland/deno/issues/5194#issuecomment-631987928
      if (e instanceof Deno.errors.BadResource) {
        return;
      }
      throw e;
    }
  }

  /**
   * Close this session
   */
  close(): void {
    this.#closed = true;
    this.#closedSignal.reject(new SessionClosedError());
  }

  /**
   * Wait until the session is closed
   */
  waitClosed(): Promise<void> {
    return this.#listener;
  }

  async reply(msgid: number, expr: unknown): Promise<void> {
    if (this.#closed) {
      throw new SessionClosedError();
    }
    const data: Message = [msgid, expr];
    await this.send(data);
  }

  async redraw(force = false): Promise<void> {
    if (this.#closed) {
      throw new SessionClosedError();
    }
    const data: command.RedrawCommand = ["redraw", force ? "force" : ""];
    await this.send(data);
  }

  async ex(expr: string): Promise<void> {
    if (this.#closed) {
      throw new SessionClosedError();
    }
    const data: command.ExCommand = ["ex", expr];
    await this.send(data);
  }

  async normal(expr: string): Promise<void> {
    if (this.#closed) {
      throw new SessionClosedError();
    }
    const data: command.NormalCommand = ["normal", expr];
    await this.send(data);
  }

  async expr(expr: string): Promise<unknown> {
    if (this.#closed) {
      throw new SessionClosedError();
    }
    const msgid = this.#indexer.next();
    const data: command.ExprCommand = ["expr", expr, msgid];
    const [_, response] = await Promise.all([
      this.send(data),
      this.#waiter.wait(msgid),
    ]);
    return response[1];
  }

  async exprNoReply(expr: string): Promise<void> {
    if (this.#closed) {
      throw new SessionClosedError();
    }
    const data: command.ExprCommand = ["expr", expr];
    await this.send(data);
  }

  async call(fn: string, ...args: unknown[]): Promise<unknown> {
    if (this.#closed) {
      throw new SessionClosedError();
    }
    const msgid = this.#indexer.next();
    const data: command.CallCommand = ["call", fn, args, msgid];
    const [_, response] = await Promise.all([
      this.send(data),
      this.#waiter.wait(msgid),
    ]);
    return response[1];
  }

  async callNoReply(fn: string, ...args: unknown[]): Promise<void> {
    if (this.#closed) {
      throw new SessionClosedError();
    }
    const data: command.CallCommand = ["call", fn, args];
    await this.send(data);
  }

  /**
   * Replace an internal callback
   */
  replaceCallback(callback: Callback): void {
    this.#callback = callback;
  }
}

/**
 * An error indicates that the session is closed
 */
export class SessionClosedError extends Error {
  constructor() {
    super("The session is closed");
    this.name = "SessionClosedError";
  }
}
