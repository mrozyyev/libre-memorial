import type { Env } from "./env";

/**
 * The context Cloudflare Pages passes to a Function, declared explicitly rather
 * than relying on the ambient global from `@cloudflare/workers-types`. That
 * keeps these modules type-checkable from the Astro project too (the tests
 * import them directly) and makes the contract obvious.
 */
export interface PagesContext<E = Env> {
  request: Request;
  env: E;
  params: Record<string, string>;
  data: Record<string, unknown>;
  functionPath: string;
  waitUntil(promise: Promise<unknown>): void;
  next(input?: Request | string): Promise<Response>;
}

export type PagesHandler<E = Env> = (context: PagesContext<E>) => Response | Promise<Response>;
