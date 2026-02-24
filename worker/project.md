# Codebase Profile: codison

## Summary
Codison is a TypeScript library with an optional CLI that provides an agent runtime, tool execution, and streaming LLM providers (OpenAI and Gemini), organized as small domain modules under `src/` and wired together by `Codison` and `Agent`. The core flow is `Codison` → `Agent` → `Provider` → tools/history with RxJS-based streaming events. (`README.md:3`, `src/codison/codison.ts:25`, `src/agent/agent.ts:15`, `src/provider/openai.ts:25`)

## Tech Stack
| Category | Details |
|---|---|
| Language | TypeScript (compiler config in `tsconfig.json`) (`tsconfig.json:1`) |
| Runtime | Node.js `>= 20.11` (`package.json:28`) |
| Package Manager | `pnpm` (lockfile `pnpm-lock.yaml`) |
| Build System | `tsup` (`tsup.config.ts:1`) |
| Dev Runner | `tsx` (`package.json:18`) |
| LLM Providers | OpenAI (`openai`), Google GenAI (`@google/genai`) (`package.json:62`, `package.json:75`) |
| CLI | `commander` (`src/cli/index.ts:6`) |
| Reactive Streams | `rxjs` (`src/agent/agent.ts:1`) |
| Logging | Custom `logger` class (`src/logger/logger.ts:1`) |
| Validation | JSON Schema usage in tools + response parsing for OpenAI (`src/tools/types.ts:1`, `src/provider/openai.ts:160`) |

## Project Structure
```
/repo
  README.md
  package.json
  tsconfig.json
  tsup.config.ts
  src/
    agent/           # Agent orchestration + event types (RxJS)
    provider/        # OpenAI + Gemini provider implementations
    tools/           # Tool interface + concrete file/system tools
      excel/         # Excel-specific tools
    codison/         # High-level Codison class (library entry)
    cli/             # CLI entrypoint
    output/          # Console output handler
    channel/         # Channel for input/output streaming
    history/         # Message history storage
    prompt/          # System prompt strings
    logger/          # Logger implementation
    recorder/        # Audio recording to mp3
    transcriptor/    # OpenAI transcription wrapper
    audiotee/        # Audio tee process wrapper
```

## Architecture Pattern
Organization is a modular library with domain-based folders under `src/`, each commonly re-exported via `index.ts` (sampled from `src/agent/index.ts:1`, `src/provider/index.ts:1`, `src/codison/index.ts:1`). The primary runtime flow is:

1. `Codison` initializes `History`, `Provider`, `Agent`, and `Channel` (`src/codison/codison.ts:32`).
2. `Agent` streams responses via `Provider.createResponseStream` and executes tool calls via a tool map (`src/agent/agent.ts:26`, `src/agent/agent.ts:90`).
3. Provider emits stream events; `Agent` converts them to `AgentEvent`s and updates history (`src/provider/provider.ts:46`, `src/agent/agent.ts:47`).
4. Tools are classes implementing `Tool` with JSON schema and `execute` (`src/tools/types.ts:1`, `src/tools/read.ts:6`).
5. CLI wires `Codison` with console output and interactive input (`src/cli/index.ts:36`, `src/output/console.ts:12`).

Cross-module communication is via direct imports and constructor wiring (manual DI), not a DI container (`src/codison/codison.ts:40`).

## Detected Conventions

### Naming
| Artifact | Convention | Example |
|---|---|---|
| Files | `kebab-case.ts` | `src/tools/read-many.ts:1` |
| Classes | PascalCase | `Codison` (`src/codison/codison.ts:25`) |
| Methods | lowerCamelCase | `runNonInteractive` (`src/codison/codison.ts:80`) |
| Directories | lower-case | `src/provider/` (`find output`) |

### Controllers / Route Handlers
No HTTP controllers/routes were found. The CLI is the primary entry point and uses Commander (`src/cli/index.ts:6`) with interactive `readline` loop (`src/cli/index.ts:54`).

### Services
Key service-like classes are `Agent`, `Codison`, `OpenAIProvider`, `GeminiProvider`, `Transcriptor`, and `Recorder` (`src/agent/agent.ts:15`, `src/codison/codison.ts:25`, `src/provider/openai.ts:25`, `src/provider/gemini.ts:21`, `src/transcriptor/transcriptor.ts:38`, `src/recorder/recorder.ts:9`). Methods are instance-level with direct dependencies passed in constructors.

### Data Access
No database usage was found in sampled modules. Data access is file-system oriented (e.g., tools use `fs` to read/write, Excel parsing via `xlsx`) (`src/tools/read.ts:2`, `src/tools/write.ts:3`, `src/tools/excel/read-excel-metadata.ts:1`). Database choice/migrations are unclear.

### Validation
Tool inputs are defined with JSON Schema on each `Tool` (`src/tools/types.ts:1`, `src/tools/read.ts:10`). `Codison.runNonInteractive` can enforce schemas by calling `Provider.createResponse` (`src/codison/codison.ts:93`), with OpenAI using JSON Schema parsing (`src/provider/openai.ts:160`).

### Error Handling
Mix of `throw` and error-string returns. `Codison.createProvider` throws when no API keys exist (`src/codison/codison.ts:74`). Many tools return error strings (`src/tools/read.ts:51`, `src/tools/write.ts:35`), while some tools log errors but return nothing (see inconsistencies).

### Testing
No test files were found under `src/` by name patterns. The `test` script points to `./src/scripts/excel.ts` (`package.json:19`), but no `src/scripts` directory exists in the repo tree (unclear).

## Inconsistencies Found

1. Tool schema required fields vs optional execution
   * `ReadTool` requires `offset`/`limit` in schema but defaults them in execution (`src/tools/read.ts:10`, `src/tools/read.ts:35`).
   * `ReadManyTool` requires `offset`/`limit` but also defaults them (`src/tools/read-many.ts:9`, `src/tools/read-many.ts:60`).
   * `LsTool` requires `depth` but defaults it in execute (`src/tools/ls.ts:10`, `src/tools/ls.ts:27`).
   * -> Interview question: Should tool schemas mark these fields optional to match runtime defaults?

2. Tool error returns are inconsistent with `Tool` interface
   * `Tool.execute` returns `Promise<string>` (`src/tools/types.ts:1`) but `LsTool`, `PatchTool`, `GetProjectInfoTool`, and `GetDependenciesTool` have error paths without a return value (`src/tools/ls.ts:45`, `src/tools/patch.ts:55`, `src/tools/get-project-info.ts:49`, `src/tools/get-dependencies.ts:41`).
   * Other tools return explicit error strings (`src/tools/read.ts:51`, `src/tools/write.ts:35`).
   * -> Interview question: Should tools throw on error, or always return an error string?

3. Logging approach is inconsistent
   * `logger` suppresses logs unless `debug` is true (`src/logger/logger.ts:2`).
   * Some tools and modules use `console.log` directly (e.g., `SearchFilesTool` and `Recorder`) (`src/tools/search-files.ts:51`, `src/recorder/recorder.ts:39`).
   * -> Interview question: Is the logger intentionally disabled by default, and should all modules route logging through it?

4. Provider feature parity
   * `OpenAIProvider.createResponse` is implemented with JSON schema parsing (`src/provider/openai.ts:157`).
   * `GeminiProvider.createResponse` currently returns `null` after `console.log` (`src/provider/gemini.ts:162`).
   * `Codison.runNonInteractive` relies on `createResponse` when `schema` is provided (`src/codison/codison.ts:93`).
   * -> Interview question: Is Gemini schema-based response intentionally unsupported, or is it a TODO?

5. README features vs code
   * README references a `KnowledgeBase` class (`README.md:98`) but no implementation was found in `src/` during sampling (unclear).
   * -> Interview question: Is `KnowledgeBase` implemented elsewhere or removed from the codebase?

6. Test script points to non-existent file
   * `package.json` has `test` script pointing to `./src/scripts/excel.ts` (`package.json:19`), but no `src/scripts` directory exists in the repo tree (unclear).
   * -> Interview question: Is the test script outdated or is the file generated elsewhere?

## Existing Standards
1. `README.md` provides product description and usage examples (`README.md:3`).
2. ESLint config with TypeScript + Prettier integration (`.eslintrc.json:6`).
3. Prettier formatting config (`.prettierrc.json:1`).
4. TypeScript compiler options with path alias `@/*` (`tsconfig.json:19`).

## Interview Questions (Generated)

### Architecture
* Q: \"Is the intended core flow `Codison` → `Agent` → `Provider` → tools/history, and are there other orchestration layers?\" Why: Confirm the observed wiring in `src/codison/codison.ts:32` and `src/agent/agent.ts:26`.

### Layer Responsibilities
* Q: \"Should tools always return error strings or throw exceptions on failure?\" Why: Mixed return styles across tools (`src/tools/read.ts:51` vs `src/tools/ls.ts:45`).
* Q: \"Should provider implementations be feature-parity, especially for schema responses?\" Why: OpenAI implements `createResponse` but Gemini is stubbed (`src/provider/openai.ts:157`, `src/provider/gemini.ts:162`).

### Code Style
* Q: \"Should tool schemas mark optional fields as optional to match defaults?\" Why: Schema requires `offset/limit/depth`, but execution defaults them (`src/tools/read.ts:10`, `src/tools/read.ts:35`, `src/tools/ls.ts:27`).
* Q: \"What is the preferred logging approach (custom `logger` vs `console`), and should logging be enabled by default?\" Why: Logger is disabled by default; some modules use `console.log` (`src/logger/logger.ts:2`, `src/tools/search-files.ts:51`).

### Testing
* Q: \"Are there any tests in this repo, or is the `test` script outdated?\" Why: `test` script references `src/scripts/excel.ts`, but no such folder was found (`package.json:19`).

### What to Ignore
* Q: \"Which categories of lint/style issues should ReviewBot never comment on?\" Why: To avoid noisy feedback given explicit Prettier + ESLint configs (`.eslintrc.json:6`, `.prettierrc.json:1`).

### Confirm/Correct
* Q: \"We detected a domain-based module layout under `src/` with re-exporting `index.ts` files. Is that the intended pattern?\" Why: Sampled from `src/agent/index.ts:1` and `src/provider/index.ts:1`.

---

If you want, I can expand the profile with more module sampling (e.g., `transcriptor`, `recorder`, `audiotee`) or focus on a specific feature area.