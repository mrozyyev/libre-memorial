import type { Config } from "./env";

export interface PublishContext {
  waitUntil(promise: Promise<unknown>): void;
}

/**
 * Pings an optional Cloudflare Pages deploy hook so a rebuild starts immediately
 * after a commit. When Pages is connected to the Git repo directly this is not
 * needed — the push already triggers a build.
 */
export function triggerPublish(config: Config, context: PublishContext): void {
  if (!config.deployHook) return;
  context.waitUntil(
    fetch(config.deployHook, { method: "POST" }).catch((error) => {
      console.warn("deploy hook failed", error);
    }),
  );
}
