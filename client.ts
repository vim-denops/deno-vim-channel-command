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

/**
 * Client is a wrapper of Session to send commands and messages.
 *
 * @example
 * ```ts
 * import { channel } from "https://deno.land/x/streamtools/mod.ts";
 * import { Session, Client } from "./mod.ts";
 *
 * const input = channel<Uint8Array>();
 * const output = channel<Uint8Array>();
 * const session = new Session(input.reader, output.writer);
 * session.start();
 *
 * // Create a client
 * const client = new Client(session);
 *
 * // Send a ex command
 * client.ex("echo 'Hello, world!'");
 *
 * // Send a call command and wait for the result.
 * console.log(await client.call("abs", -1)); // 1
 * ```
 */
export class Client {
  #session: Session;
  #indexer: Indexer;

  /**
   * Constructs a new client.
   *
   * Note that the indexer must be unique for each session to avoid message ID conflicts.
   * If multiple clients are created for a single session, specify a single indexer.
   *
   * @param session The session to communicate with.
   * @param indexer The indexer to generate message IDs.
   */
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

  /**
   * Sends a message to Vim.
   *
   * @param msgid The message ID.
   * @param value The value to send.
   */
  reply(msgid: number, value: unknown): void {
    const message = buildMessage(msgid, value);
    this.#session.send(message);
  }

  /**
   * Sends a redraw command to Vim.
   *
   * @param force Whether to force redraw.
   */
  redraw(force = false): void {
    const command = buildRedrawCommand(force);
    this.#session.send(command);
  }

  /**
   * Sends an ex command to Vim.
   *
   * @param expr The expression to evaluate.
   */
  ex(expr: string): void {
    const command = buildExCommand(expr);
    this.#session.send(command);
  }

  /**
   * Sends a normal command to Vim.
   *
   * @param expr The expression to evaluate.
   */
  normal(expr: string): void {
    const command = buildNormalCommand(expr);
    this.#session.send(command);
  }

  /**
   * Sends an expr command to Vim and wait for the result.
   *
   * @param expr The expression to evaluate.
   * @returns The result of the expression.
   */
  expr(expr: string): Promise<unknown> {
    const msgid = this.#nextMsgid();
    const command = buildExprCommand(expr, msgid);
    this.#session.send(command);
    return this.#recv(msgid);
  }

  /**
   * Sends an expr command to Vim.
   *
   * @param expr The expression to evaluate.
   */
  exprNoReply(expr: string): void {
    const command = buildExprCommand(expr);
    this.#session.send(command);
  }

  /**
   * Sends a call command to Vim and wait for the result.
   *
   * @param fn The function name to call.
   * @param args The arguments to pass to the function.
   * @returns The result of the function.
   */
  call(fn: string, ...args: unknown[]): Promise<unknown> {
    const msgid = this.#nextMsgid();
    const command = buildCallCommand(fn, args, msgid);
    this.#session.send(command);
    return this.#recv(msgid);
  }

  /**
   * Sends a call command to Vim.
   *
   * @param fn The function name to call.
   * @param args The arguments to pass to the function.
   */
  callNoReply(fn: string, ...args: unknown[]): void {
    const command = buildCallCommand(fn, args);
    this.#session.send(command);
  }
}
