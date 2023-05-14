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

export function buildRedrawCommand(force = false): RedrawCommand {
  return ["redraw", force ? "force" : ""];
}

export function buildExCommand(expr: string): ExCommand {
  return ["ex", expr];
}

export function buildNormalCommand(expr: string): NormalCommand {
  return ["normal", expr];
}

export function buildExprCommand(expr: string, msgid?: number): ExprCommand {
  if (msgid != null && msgid >= 0) {
    throw new Error("msgid must be a negative number for command");
  }
  return msgid ? ["expr", expr, msgid] : ["expr", expr];
}

export function buildCallCommand(
  fn: string,
  args: unknown[],
  msgid?: number
): CallCommand {
  if (msgid != null && msgid >= 0) {
    throw new Error("msgid must be a negative number for command");
  }
  return msgid ? ["call", fn, args, msgid] : ["call", fn, args];
}
