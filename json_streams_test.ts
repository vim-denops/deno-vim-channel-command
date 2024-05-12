import { assertEquals } from "@std/assert";
import { channel, collect } from "@lambdalisue/streamtools";
import { DecodeStream, EncodeStream } from "./json_streams.ts";

const encoder = new TextEncoder();

Deno.test("EncodeStream", async (t) => {
  await t.step(
    "transforms JavaScript object stream to JSON string stream",
    async () => {
      const output = channel();
      const reader = new ReadableStream({
        start(controller) {
          controller.enqueue("Hello world");
          controller.enqueue(100);
          controller.enqueue({ "foo": "bar" });
          controller.enqueue([1, 2, 3]);
          controller.close();
        },
      });
      await reader.pipeThrough(new EncodeStream()).pipeTo(output.writer);
      const result = await collect(output.reader);
      assertEquals(result, [
        encoder.encode(`"Hello world"`),
        encoder.encode(`100`),
        encoder.encode(`{"foo":"bar"}`),
        encoder.encode(`[1,2,3]`),
      ]);
    },
  );
});

Deno.test("DecodeStream", async (t) => {
  await t.step(
    "transforms JSON string stream to JavaScript object stream",
    async () => {
      const output = channel();
      const reader = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`"Hello world"`));
          controller.enqueue(encoder.encode("100"));
          controller.enqueue(encoder.encode(`{"foo": "bar"}`));
          controller.enqueue(encoder.encode(`[1, 2, 3]`));
          controller.close();
        },
      });
      await reader.pipeThrough(new DecodeStream()).pipeTo(output.writer);
      const result = await collect(output.reader);
      assertEquals(result, [
        "Hello world",
        100,
        { foo: "bar" },
        [1, 2, 3],
      ]);
    },
  );

  await t.step(
    "transforms JSON string stream with incomplete chunks to JavaScript object stream",
    async () => {
      const output = channel();
      const reader = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`"Hello`));
          controller.enqueue(encoder.encode(` world"`));
          controller.enqueue(encoder.encode("1"));
          controller.enqueue(encoder.encode("00"));
          controller.enqueue(encoder.encode(`{"foo"`));
          controller.enqueue(encoder.encode(`: "bar"}`));
          controller.enqueue(encoder.encode(`[1,`));
          controller.enqueue(encoder.encode(`2, 3]`));
          controller.close();
        },
      });
      await reader.pipeThrough(new DecodeStream()).pipeTo(output.writer);
      const result = await collect(output.reader);
      assertEquals(result, [
        "Hello world",
        100,
        { foo: "bar" },
        [1, 2, 3],
      ]);
    },
  );
});
