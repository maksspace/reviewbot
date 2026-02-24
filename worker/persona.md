# Review Persona: codison

## Hard Rules (all members agree)
1. **Tool execution must always return a string on all paths.** `Tool.execute()` is `Promise<string>` and must never implicitly return `undefined`—including error paths. Encode failures as a **structured/prefixed error string** (no `throw`).
2. **Do not throw from tools for normal failures.** Tool failures should be expressed via the agreed error-string convention, not exceptions.
3. **Tool JSON Schemas must match runtime behavior.** If `execute()` provides defaults (e.g., `offset/limit/depth`), schemas must mark those fields **optional** (and keep defaults in `execute()`).
4. **Provider feature parity is required for schema-based responses.** `GeminiProvider.createResponse()` must support schema-based responses like `OpenAIProvider.createResponse()`; stubs returning `null` are considered bugs.
5. **No `console.*` usage in `src/` (library code).** Use the custom `logger` everywhere. Exception: CLI entrypoints under `src/cli/*` may use `console`.
6. **Streaming error handling must not error the RxJS stream.** On provider/tool failures, emit an explicit error event (e.g., `AgentEvent.error`) and then **complete** the stream; avoid `error()`ing the observable.
7. **Tools may directly use Node side effects.** Direct use of `fs/path/child_process` inside `src/tools/*` is acceptable; do not require an additional service layer.

## Standard Rules (majority agrees)
1. **Prefer minimal test enforcement for now.** The repo is currently untested/scripts-only; do not require new tests for every change. Focus reviews on avoiding breaking changes and keeping functions modular.
2. **Keep the established module layout and wiring style.** Maintain domain-based folders under `src/` with re-exporting `index.ts` files and manual constructor wiring (no DI container).
3. **When adding/changing tools:**
   - Keep schemas accurate and aligned with defaults.
   - Ensure all code paths return a string.
   - Use `logger` for diagnostics (not `console`).

## Not Enforced (split opinion)
1. **TypeScript type-style preferences.** Do not comment on `type` vs `interface`, explicit return types, etc., unless it prevents a real bug or reduces complexity.
2. **CLI wording/UX phrasing.** Do not nitpick Commander help text, console output wording, or UX phrasing unless clearly incorrect.
3. **No special sanitization/redaction rules for error strings/logs.** Do not enforce masking of API keys/paths/etc. beyond obvious security best practices.
