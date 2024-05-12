import { JSONParser } from "@streamparser/json";

/**
 * EncodeStream encodes object stream to JSON string in Uin8Array stream.
 */
export class EncodeStream<T> extends TransformStream<T, Uint8Array> {
  constructor() {
    const encoder = new TextEncoder();
    super({
      transform(chunk, controller) {
        controller.enqueue(encoder.encode(JSON.stringify(chunk)));
      },
    });
  }
}

/**
 * DecodeStream decodes Uint8Array stream as JSON string to object stream.
 */
export class DecodeStream<T> extends TransformStream<Uint8Array, T> {
  constructor() {
    const parser = new JSONParser({
      separator: "",
    });
    super({
      start(controller) {
        parser.onValue = ({ value, stack }) => {
          if (stack.length) return;
          controller.enqueue(value as T);
        };
      },
      transform(chunk) {
        parser.write(chunk);
      },
    });
  }
}
