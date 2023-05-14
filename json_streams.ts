// NOTE:
// streamparser-json must be v0.0.5 because it automatically end-up parsing without separator after v0.0.5
// https://github.com/juanjoDiaz/streamparser-json/commit/577e918b90c19d6758b87d41bdb6c5571a2c012d
import JSONParser from "https://deno.land/x/streamparser_json@v0.0.5/jsonparse.ts#=";

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
    const parser = new JSONParser();
    super({
      start(controller) {
        parser.onValue = (value, _key, _parent, stack) => {
          if (stack.length) return;
          controller.enqueue(value);
        };
      },
      transform(chunk) {
        parser.write(chunk);
      },
    });
  }
}
