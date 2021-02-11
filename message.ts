import { ReadonlyJsonAny } from "./json.ts";

export type Message = [number, ReadonlyJsonAny];

export function isMessage(data: unknown): data is Message {
  return (
    Array.isArray(data) &&
    data.length === 2 &&
    typeof data[0] === "number" &&
    typeof data[1] !== "undefined"
  );
}
