import { Message, Session } from "../mod.ts";
import { using } from "../deps_test.ts";

// NOTE:
// Do NOT use 'console.log()' while stdout is used to communicate with Vim

console.warn("Session has connected");

await using(
  new Session(Deno.stdin, Deno.stdout, (message: Message) => {
    console.warn(`Unexpected message ${message} has received`);
  }),
  async (server) => {
    console.warn(await server.redraw());
    console.warn(await server.ex("echo 'Hello'"));
    console.warn(await server.normal("vsp"));
    console.warn(await server.expr("v:version"));
    console.warn(await server.exprNoReply("v:version"));
    console.warn(await server.call("getcwd"));
    console.warn(await server.callNoReply("getcwd"));
  },
);
console.warn("Client has disconnected");
