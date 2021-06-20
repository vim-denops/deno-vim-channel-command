export type CommandType = "redraw" | "ex" | "normal" | "eval" | "expr" | "call";

export type RedrawCommand = ["redraw", "" | "force"];

export type ExCommand = ["ex", string];

export type NormalCommand = ["normal", string];

export type ExprCommand = ["expr", string, number?];

export type CallCommand = ["call", string, unknown[], number?];

export type Command =
  | RedrawCommand
  | ExCommand
  | NormalCommand
  | ExprCommand
  | CallCommand;

export function isRedrawCommand(data: unknown): data is RedrawCommand {
  return (
    Array.isArray(data) &&
    data.length === 2 &&
    data[0] === "redraw" &&
    (data[1] === "" || data[1] === "force")
  );
}

export function isExCommand(data: unknown): data is ExCommand {
  return (
    Array.isArray(data) &&
    data.length === 2 &&
    data[0] === "ex" &&
    typeof data[1] === "string"
  );
}

export function isNormalCommand(data: unknown): data is NormalCommand {
  return (
    Array.isArray(data) &&
    data.length === 2 &&
    data[0] === "normal" &&
    typeof data[1] === "string"
  );
}

export function isExprCommand(data: unknown): data is ExprCommand {
  return (
    Array.isArray(data) &&
    (data.length === 2 || data.length === 3) &&
    data[0] === "expr" &&
    typeof data[1] === "string" &&
    (typeof data[2] === "number" || typeof data[2] === "undefined")
  );
}

export function isCallCommand(data: unknown): data is CallCommand {
  return (
    Array.isArray(data) &&
    (data.length === 3 || data.length === 4) &&
    data[0] === "call" &&
    typeof data[1] === "string" &&
    Array.isArray(data[2]) &&
    (typeof data[3] === "number" || typeof data[3] === "undefined")
  );
}
