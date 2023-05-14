import { Client, Session } from "../mod.ts";

// NOTE:
// Do NOT use 'console.log()' while stdout is used to communicate with Vim
console.warn("Session has started");

const session = new Session(Deno.stdin.readable, Deno.stdout.writable);
session.start();

const client = new Client(session);

console.warn("Invoke 'ex' command to open a new buffer");
client.ex("new");

console.warn("Invoke 'normal' command to input 'Hello from Deno'");
client.normal("iHello from Deno\\<Esc>");

console.warn("Invoke 'redraw' command to refresh the screen");
client.redraw();

console.warn("Invoke 'expr' command and wait for the result");
console.warn(await client.expr("v:version"));

console.warn("Invoke 'expr' command");
client.exprNoReply("v:version");

console.warn("Invoke 'call' command and wait for the result");
console.warn(await client.call("getcwd"));

console.warn("Invoke 'call' command");
client.callNoReply("getcwd");

console.warn("Invoke 'ex' command to wipeout the buffer");
client.ex("bwipeout!");

await session.shutdown();
console.warn("Session has terminated");
