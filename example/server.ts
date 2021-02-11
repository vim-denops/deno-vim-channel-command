import { Message, Session } from "../mod.ts";

// NOTE:
// Do NOT use 'console.log()' while stdout is used to communicate with Vim

console.warn("Session has connected");
const server = new Session(Deno.stdin, Deno.stdout, (message: Message) => {
  console.warn(`Unexpected message ${message} has received`);
});

server
  .listen()
  .then(() => console.warn("Client has disconnected"))
  .catch((e) => console.error(e));

console.warn(await server.redraw());
console.warn(await server.ex("echo 'Hello'"));
console.warn(await server.normal("vsp"));
console.warn(await server.expr("v:version"));
console.warn(await server.exprNoReply("v:version"));
console.warn(await server.call("getcwd"));
console.warn(await server.callNoReply("getcwd"));
