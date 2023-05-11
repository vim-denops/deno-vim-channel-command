import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.186.0/testing/asserts.ts";
import { Indexer } from "./indexer.ts";

Deno.test("Indexer without 'max' works as expect", () => {
  const indexer = new Indexer();
  assertEquals(indexer.next(), 0);
  assertEquals(indexer.next(), 1);
  assertEquals(indexer.next(), 2);
});

Deno.test("Indexer with 'max' works as expect", () => {
  const indexer = new Indexer(3);
  assertEquals(indexer.next(), 0);
  assertEquals(indexer.next(), 1);
  assertEquals(indexer.next(), 2);
  assertEquals(indexer.next(), 3);
  assertEquals(indexer.next(), 0);
});

Deno.test("Indexer with 'max' smaller than 2 throws error", () => {
  assertThrows(() => new Indexer(1), Error, "must be greater than 1");
});
