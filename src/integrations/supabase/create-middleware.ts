// Direct import avoids Vite SSR failing to resolve `export *` re-exports from
// `@tanstack/react-start` (createMiddleware is undefined on cold SSR).
export { createMiddleware } from "@tanstack/start-client-core";
