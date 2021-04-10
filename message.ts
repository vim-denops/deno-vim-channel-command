export type Message = [number, unknown];

export function isMessage(data: unknown): data is Message {
  return (
    Array.isArray(data) &&
    data.length === 2 &&
    typeof data[0] === "number" &&
    typeof data[1] !== "undefined"
  );
}