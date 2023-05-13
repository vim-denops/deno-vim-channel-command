import { Indexer } from "https://deno.land/x/indexer@v0.1.0/mod.ts";
import { buildMessage, Message } from "./message.ts";
import {
  buildCallCommand,
  buildExCommand,
  buildExprCommand,
  buildNormalCommand,
  buildRedrawCommand,
  Command,
} from "./command.ts";

const msgidThreshold = 2 ** 32;

type Session = {
  send: (data: Command | Message) => void;
  recv: (msgid: number) => Promise<Message>;
};

export class Client {
  #session: Session;
  #indexer: Indexer;

  constructor(session: Session, indexer?: Indexer) {
    this.#session = session;
    this.#indexer = indexer ?? new Indexer(msgidThreshold);
  }

  #nextMsgid(): number {
    // The msgid must be a negative number to avoid confusion with message that Vim sends.
    // https://github.com/vim/vim/blob/b848ce6b7e27f24aff47a4d63933e0f96663acfe/runtime/doc/channel.txt#L379-L381
    return (this.#indexer.next() + 1) * -1;
  }

  async #recv(msgid: number): Promise<unknown> {
    const [_, response] = await this.#session.recv(msgid);
    return response;
  }

  reply(msgid: number, value: unknown): void {
    const message = buildMessage(msgid, value);
    this.#session.send(message);
  }

  redraw(force = false): void {
    const command = buildRedrawCommand(force);
    this.#session.send(command);
  }

  ex(expr: string): void {
    const command = buildExCommand(expr);
    this.#session.send(command);
  }

  normal(expr: string): void {
    const command = buildNormalCommand(expr);
    this.#session.send(command);
  }

  expr(expr: string): Promise<unknown> {
    const msgid = this.#nextMsgid();
    const command = buildExprCommand(expr, msgid);
    this.#session.send(command);
    return this.#recv(msgid);
  }

  exprNoReply(expr: string): void {
    const command = buildExprCommand(expr);
    this.#session.send(command);
  }

  call(fn: string, ...args: unknown[]): Promise<unknown> {
    const msgid = this.#nextMsgid();
    const command = buildCallCommand(fn, args, msgid);
    this.#session.send(command);
    return this.#recv(msgid);
  }

  callNoReply(fn: string, ...args: unknown[]): void {
    const command = buildCallCommand(fn, args);
    this.#session.send(command);
  }
}
