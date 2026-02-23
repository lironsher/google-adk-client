# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Compile TypeScript to dist/
pnpm test             # Run all tests (vitest)
pnpm test src/api/sessions.test.ts  # Run a single test file
pnpm lint             # Check code with Biome
pnpm lint:fix         # Auto-fix lint issues
```

Publishing is triggered automatically via GitHub Actions on a non-prerelease GitHub Release.

## Architecture

This is a TypeScript npm package (`@liron_sher/google-adk`) that wraps the Google ADK agent REST API with two entry points:

- **`@liron_sher/google-adk`** — exports `AdkClient` and all types
- **`@liron_sher/google-adk/ai-sdk`** — exports Vercel AI SDK connectors (`AdkChatTransport`, `createAdkAiSdkStream`)

### `AdkClient` (src/index.ts)

The main class. Requires `userId` and either constructor args or env vars (`ADK_BASE_URL`, `ADK_APP_NAME`). Exposes namespaced API groups as readonly properties:

- `client.sessions` — CRUD for ADK sessions
- `client.artifacts` — artifact management
- `client.evals` — evaluation sets
- `client.apps` — list available apps
- `client.events` — event retrieval
- `client.debug` — debug utilities

Each API group (under `src/api/`) receives an `ApiClient` interface (defined in `src/types/client.ts`) injected by `AdkClient`, giving each group access to `appName`, `userId`, `request()`, and `requestJson<T>()`.

The two main run methods on `AdkClient` itself:
- `runSse(sessionId, messages)` — POST to `/run_sse`, returns a streaming `Response`
- `run(sessionId, messages)` — POST to `/run`, returns a non-streaming `Response`

Both accept `UIMessage[]` from the `ai` package and internally transform the last message into the ADK `Content` format.

### AI SDK connectors (src/ai-sdk/)

**Server-side** (`server.ts`): `createAdkAiSdkStream(response)` takes the SSE `Response` from `client.runSse()` and converts it to a `UIMessageStreamResponse` for use in Next.js route handlers.

**Client-side** (`client.ts`): `AdkChatTransport` extends `HttpChatTransport` from the `ai` package. Override `sendMessages()` calls `client.runSse()` directly; override `processResponseStream()` parses ADK's SSE format into `UIMessageChunk` deltas. Pass to the `useChat` hook's `transport` option.

Both connectors parse ADK's SSE format: lines starting with `data: ` containing JSON where `json.partial === true` signals a streaming text delta at `json.content.parts[0].text`.

### Types (src/types/)

- `client.ts` — `ApiClient` interface (injected into each API group)
- `payloads.ts` — `AgentRunSsePayload` (body for `/run` and `/run_sse`)
- `session.ts`, `eval.ts`, `auth.ts` — domain-specific types
- `google-adk` / `google-genai` — re-exported types from `@google/adk`

### Testing

Tests use Vitest with globals enabled. `src/test-setup.ts` stubs `fetch` globally with `vi.fn()` and exports a `createMockResponse<T>` helper used across all API tests. Test files live alongside their source files (`*.test.ts`).

### Tooling

- **Biome** for linting and formatting (double quotes, space indent, trailing commas ES5, `useReadonlyClassProperties: error`)
- **TypeScript** compiled to CommonJS targeting ES6, output to `dist/`, test files excluded from build
- **pnpm** as the package manager; `ai` is an optional peer dependency
