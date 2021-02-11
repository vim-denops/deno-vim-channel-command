import { readLines } from "https://deno.land/std@0.86.0/io/mod.ts";
import {
  Deferred,
  deferred,
} from "https://deno.land/x/std@0.86.0/async/deferred.ts";
import { isMessage, Message } from "./message.ts";
import * as command from "./command.ts";

const MSGID_THRESHOLD = 2 ** 32;

const utf8Encoder = new TextEncoder();

export type Callback = (this: Session, message: Message) => void;

/**
 * Vim's channel-command Session
 */
export class Session {
  #counter: number;
  #replies: { [key: number]: Deferred<Message> };
  #reader: Deno.Reader;
  #writer: Deno.Writer;
  #callback: Callback;

  /**
   * Constructor
   */
  constructor(
    reader: Deno.Reader,
    writer: Deno.Writer,
    callback: Callback = () => undefined,
  ) {
    this.#counter = 0;
    this.#replies = {};
    this.#reader = reader;
    this.#writer = writer;
    this.#callback = callback;
  }

  protected getOrCreateReply(msgid: number): Deferred<Message> {
    this.#replies[msgid] = this.#replies[msgid] || deferred();
    return this.#replies[msgid];
  }

  private getNextIndex(): number {
    this.#counter += 1;
    if (this.#counter >= MSGID_THRESHOLD) {
      this.#counter = 1;
    }
    return this.#counter * -1;
  }

  private async send(data: Uint8Array): Promise<void> {
    while (true) {
      const n = await this.#writer.write(data);
      if (n === data.byteLength) {
        break;
      }
      data = data.slice(n);
    }
  }

  /**
   * Listen messages and handle request/response/notification.
   * This method must be called to start session.
   */
  async listen(): Promise<void> {
    const stream = readLines(this.#reader);
    try {
      for await (const text of stream) {
        try {
          const data = JSON.parse(text);
          if (!isMessage(data)) {
            console.warn(`Unexpected data received: ${data}`);
            continue;
          }
          const reply = this.#replies[data[0]];
          if (!reply) {
            this.#callback.apply(this, [data]);
            continue;
          }
          reply.resolve(data);
        } catch (e) {
          console.warn(`Failed to parse received text: ${text}: ${e}`);
          continue;
        }
      }
    } catch (e) {
      // https://github.com/denoland/deno/issues/5194#issuecomment-631987928
      if (e instanceof Deno.errors.BadResource) {
        return;
      }
      throw e;
    }
  }

  async reply(msgid: number, expr: unknown): Promise<void> {
    const data: Message = [msgid, expr];
    await this.send(utf8Encoder.encode(JSON.stringify(data)));
  }

  async redraw(force = false): Promise<void> {
    const data: command.RedrawCommand = ["redraw", force ? "force" : ""];
    await this.send(utf8Encoder.encode(JSON.stringify(data)));
  }

  async ex(expr: string): Promise<void> {
    const data: command.ExCommand = ["ex", expr];
    await this.send(utf8Encoder.encode(JSON.stringify(data)));
  }

  async normal(expr: string): Promise<void> {
    const data: command.NormalCommand = ["normal", expr];
    await this.send(utf8Encoder.encode(JSON.stringify(data)));
  }

  async expr(expr: string): Promise<unknown> {
    const msgid = this.getNextIndex();
    const data: command.ExprCommand = ["expr", expr, msgid];
    const reply: Deferred<Message> = deferred();
    this.#replies[msgid] = reply;
    await this.send(utf8Encoder.encode(JSON.stringify(data)));
    return (await reply)[1];
  }

  async exprNoReply(expr: string): Promise<void> {
    const data: command.ExprCommand = ["expr", expr];
    await this.send(utf8Encoder.encode(JSON.stringify(data)));
  }

  async call(fn: string, ...args: unknown[]): Promise<unknown> {
    const msgid = this.getNextIndex();
    const data: command.CallCommand = ["call", fn, args, msgid];
    const reply: Deferred<Message> = deferred();
    this.#replies[msgid] = reply;
    await this.send(utf8Encoder.encode(JSON.stringify(data)));
    return (await reply)[1];
  }

  async callNoReply(fn: string, ...args: unknown[]): Promise<void> {
    const data: command.CallCommand = ["call", fn, args];
    await this.send(utf8Encoder.encode(JSON.stringify(data)));
  }
}
