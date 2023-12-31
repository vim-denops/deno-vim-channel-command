import { Reservator } from "https://deno.land/x/reservator@v0.1.0/mod.ts";
import {
  Channel,
  channel,
} from "https://deno.land/x/streamtools@v0.4.1/mod.ts";
import { DecodeStream, EncodeStream } from "./json_streams.ts";
import { Command } from "./command.ts";
import { isMessage, Message } from "./message.ts";

const shutdown = Symbol("shutdown");

/**
 * Session is a wrapper of ReadableStream and WritableStream to send commands and receive messages.
 *
 * @example
 * ```ts
 * import { Session } from "./mod.ts";
 *
 * const session = new Session(
 *   Deno.stdin.readable,
 *   Deno.stdout.writable,
 * );
 * session.onMessage = (message) => {
 *   console.log("Recv:", message);
 * };
 * session.start();
 *
 * // ...
 *
 * await session.shutdown();
 * ```
 */
export class Session {
  #outer: Channel<Uint8Array>;
  #inner: Channel<Command | Message>;
  #running?: {
    innerWriter: WritableStreamDefaultWriter<Command | Message>;
    reservator: Reservator<number, Message>;
    producerController: AbortController;
    consumerController: AbortController;
    waiter: Promise<void>;
  };

  /**
   * The callback function to be called when an invalid message is received.
   * The default behavior is to ignore the message.
   * @param message The invalid message.
   */
  onInvalidMessage?: (message: unknown) => void;

  /**
   * The callback function to be called when a message is received.
   * The default behavior is to ignore the message.
   * @param message The received message.
   */
  onMessage?: (message: Message) => void;

  /**
   * Constructs a new session.
   * @param reader The reader to read raw data.
   * @param writer The writer to write raw data.
   */
  constructor(
    reader: ReadableStream<Uint8Array>,
    writer: WritableStream<Uint8Array>,
  ) {
    this.#outer = { reader, writer };
    this.#inner = channel();
  }

  /**
   * Send a command or a message to the peer.
   * @param data The data to send.
   * @throws If the session is not running.
   */
  send(data: Command | Message): void {
    if (!this.#running) {
      throw new Error("Session is not running");
    }
    const { innerWriter } = this.#running;
    innerWriter.write(data);
  }

  /**
   * Receive a message from the peer.
   * @param msgid The message ID to receive.
   * @returns The received message.
   * @throws If the session is not running.
   * @throws If the message ID is already reserved.
   */
  recv(msgid: number): Promise<Message> {
    if (!this.#running) {
      throw new Error("Session is not running");
    }
    const { reservator } = this.#running;
    return reservator.reserve(msgid);
  }

  /**
   * Start the session.
   *
   * This method must be called before calling `send` or `recv`.
   * If the session is already running, this method throws an error.
   *
   * The session is started in the following steps:
   * @throws If the session is already running.
   */
  start(): void {
    if (this.#running) {
      throw new Error("Session is already running");
    }
    const reservator = new Reservator<number, Message>();
    const innerWriter = this.#inner.writer.getWriter();
    const consumerController = new AbortController();
    const producerController = new AbortController();

    const ignoreShutdownError = (err: unknown) => {
      if (err === shutdown) {
        return;
      }
      return Promise.reject(err);
    };

    // outer -> inner
    const consumer = this.#outer.reader
      .pipeThrough(new DecodeStream())
      .pipeTo(
        new WritableStream({ write: (m) => this.#handleMessage(m) }),
        { signal: consumerController.signal },
      )
      .catch(ignoreShutdownError)
      .finally(async () => {
        await innerWriter.ready;
        await innerWriter.close();
      });

    // inner -> outer
    const producer = this.#inner.reader
      .pipeThrough(new EncodeStream<Command>())
      .pipeTo(this.#outer.writer, { signal: producerController.signal })
      .catch(ignoreShutdownError);

    const waiter = Promise.all([consumer, producer])
      .then(() => {}).finally(() => {
        innerWriter.releaseLock();
        this.#running = undefined;
      });

    this.#running = {
      reservator,
      innerWriter,
      consumerController,
      producerController,
      waiter,
    };
  }

  /**
   * Wait until the session is shutdown.
   * @returns A promise that is fulfilled when the session is shutdown.
   * @throws If the session is not running.
   */
  wait(): Promise<void> {
    if (!this.#running) {
      throw new Error("Session is not running");
    }
    const { waiter } = this.#running;
    return waiter;
  }

  /**
   * Shutdown the session.
   * @returns A promise that is fulfilled when the session is shutdown.
   * @throws If the session is not running.
   */
  shutdown(): Promise<void> {
    if (!this.#running) {
      throw new Error("Session is not running");
    }
    // Abort consumer to shutdown session properly.
    const { consumerController, waiter } = this.#running;
    consumerController.abort(shutdown);
    return waiter;
  }

  /**
   * Shutdown the session forcibly.
   * @returns A promise that is fulfilled when the session is shutdown.
   * @throws If the session is not running.
   */
  forceShutdown(): Promise<void> {
    if (!this.#running) {
      throw new Error("Session is not running");
    }
    // Abort consumer and producer to shutdown session forcibly.
    const { consumerController, producerController, waiter } = this.#running;
    producerController.abort(shutdown);
    consumerController.abort(shutdown);
    return waiter;
  }

  #handleMessage(message: unknown): void {
    if (!isMessage(message)) {
      this.onInvalidMessage?.call(this, message);
      return;
    }
    const [msgid, _] = message;
    if (msgid < 0) {
      // Response message of commands
      const { reservator } = this.#running!;
      reservator.resolve(msgid, message);
    } else {
      this.onMessage?.call(this, message);
    }
  }
}
