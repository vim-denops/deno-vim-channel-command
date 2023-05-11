export * as io from "https://deno.land/std@0.186.0/io/mod.ts";
export * as streams from "https://deno.land/std@0.186.0/streams/mod.ts";
export { deferred } from "https://deno.land/std@0.186.0/async/deferred.ts";
export type { Deferred } from "https://deno.land/std@0.186.0/async/deferred.ts";
export type { Disposable } from "https://deno.land/x/disposable@v1.1.1/mod.ts";

// NOTE:
// streamparser-json must be v0.0.5 because it automatically end-up parsing without separator after v0.0.5
// https://github.com/juanjoDiaz/streamparser-json/commit/577e918b90c19d6758b87d41bdb6c5571a2c012d
export { default as JSONparser } from "https://deno.land/x/streamparser_json@v0.0.5/jsonparse.ts#=";
