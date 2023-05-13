export type MessageId = number;

export type Message = [MessageId, unknown];

export function isMessage(data: unknown): data is Message {
  return (
    Array.isArray(data) &&
    data.length === 2 &&
    typeof data[0] === "number" &&
    typeof data[1] !== "undefined"
  );
}

export function buildMessage(msgid: number, value: unknown): Message {
  return [msgid, value];
}
