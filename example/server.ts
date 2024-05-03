import { Client, Session } from "../mod.ts";

// NOTE:
// Do NOT use 'console.log()' while stdout is used to communicate with Vim
console.warn("Session has started");

const session = new Session(Deno.stdin.readable, Deno.stdout.writable);
session.start();

const client = new Client(session);

console.warn("Invoke 'ex' command to open a new buffer");
await client.ex("new");

console.warn("Invoke 'normal' command to input 'Hello from Deno'");
await client.normal("iHello from Deno");

console.warn("Invoke 'redraw' command to refresh the screen");
await client.redraw();

console.warn("Invoke 'expr' command and wait for the result");
console.warn(await client.expr("v:version"));

console.warn("Invoke 'expr' command");
await client.exprNoReply("v:version");

console.warn("Invoke 'call' command and wait for the result");
console.warn(await client.call("getcwd"));

console.warn("Invoke 'call' command");
await client.callNoReply("getcwd");

console.warn("Invoke 'ex' command to wipeout the buffer");
await client.ex("bwipeout!");

await session.shutdown();
console.warn("Session has terminated");
