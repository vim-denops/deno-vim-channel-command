import { Reservator } from "https://deno.land/x/reservator@v0.1.0/mod.ts";
import {
  Channel,
  channel,
} from "https://deno.land/x/streamtools@v0.4.1/mod.ts";
import { DecodeStream, EncodeStream } from "./json_streams.ts";
import { Command } from "./command.ts";
import { isMessage, Message } from "./message.ts";

const shutdown = Symbol("shutdown");

export type SessionOptions = {
  onInvalidMessage?: (message: unknown) => void;
  onMessage?: (message: Message) => void;
};

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

  onInvalidMessage?: (message: unknown) => void;
  onMessage?: (message: Message) => void;

  constructor(
    reader: ReadableStream<Uint8Array>,
    writer: WritableStream<Uint8Array>,
    options: SessionOptions = {},
  ) {
    const {
      onInvalidMessage,
      onMessage,
    } = options;
    this.onInvalidMessage = onInvalidMessage;
    this.onMessage = onMessage;
    this.#outer = { reader, writer };
    this.#inner = channel();
  }

  send(data: Command | Message): void {
    if (!this.#running) {
      throw new Error("Session is not running");
    }
    const { innerWriter } = this.#running;
    innerWriter.write(data);
  }

  recv(msgid: number): Promise<Message> {
    if (!this.#running) {
      throw new Error("Session is not running");
    }
    const { reservator } = this.#running;
    return reservator.reserve(msgid);
  }

  start(options: { signal?: AbortSignal } = {}): void {
    if (this.#running) {
      throw new Error("Session is already running");
    }
    const reservator = new Reservator<number, Message>();
    const innerWriter = this.#inner.writer.getWriter();
    const consumerController = new AbortController();
    const producerController = new AbortController();

    const abort = (reason: unknown) => {
      if (this.#running) {
        const { consumerController, producerController } = this.#running;
        consumerController.abort(reason);
        producerController.abort(reason);
      }
    };
    const { signal } = options;
    signal?.addEventListener("abort", abort);

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
        signal?.removeEventListener("abort", abort);
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

  wait(): Promise<void> {
    if (!this.#running) {
      throw new Error("Session is not running");
    }
    const { waiter } = this.#running;
    return waiter;
  }

  shutdown(): Promise<void> {
    if (!this.#running) {
      throw new Error("Session is not running");
    }
    // Abort consumer to shutdown session properly.
    const { consumerController, waiter } = this.#running;
    consumerController.abort(shutdown);
    return waiter;
  }

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
