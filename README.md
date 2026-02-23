# Google ADK Client Library

A TypeScript client library for the Google ADK (Agent Development Kit).


## Breaking Changes

This repository is a fork of @lironsher/google-adk and introduces several breaking changes.

Key differences:
- Enhanced logging capabilities
- Full TypeScript support

Upgrading from the original repository will require manual code adjustments.

## Features

- **Simple and robust:** A high-level, easy-to-use client library that abstracts away the complexities of the Google ADK agent API.
- **Strongly-typed:** Written in TypeScript to provide strong type safety for all API interactions.
- **Flexible:** Can be used in any TypeScript project, including Next.js, Node.js, and browser-based applications.
- **Seamless AI SDK Integration:** Provides a simple and robust way to connect the Google ADK agent service to the Vercel AI SDK and its ecosystem of UI components.
- **Built-in logging:** Customizable log handler for debugging and monitoring API calls.

## Installation

```bash
npm install @lironsher/google-adk
```

## Usage

### `AdkClient`

The core of the library is the `AdkClient` class. It provides methods for all the Google ADK agent API endpoints, organized into logical groups.

```typescript
import { AdkClient } from "@lironsher/google-adk";

// The client can be configured with environment variables:
// process.env.ADK_BASE_URL = "https://my-adk-agent.example.com";
// process.env.ADK_APP_NAME = "my-app-name";

const client = new AdkClient({
  userId: "user-123",
});

// Access API groups
const sessions = await client.sessions.list();
const artifacts = await client.artifacts.listNames("session-456");
```

#### Constructor Options

| Option | Type | Description |
|---|---|---|
| `userId` | `string` | **Required.** The user ID for the ADK session. |
| `appName` | `string` | The ADK app name. Falls back to `ADK_APP_NAME` env var. |
| `baseUrl` | `string` | The base URL of the ADK agent. Falls back to `ADK_BASE_URL` env var. |
| `onLog` | `LogHandler` | Optional callback for receiving log events. |

### Running the Agent

#### `runSse(sessionId, messages)` → `Promise<ReadableStream<UIMessageChunk>>`

Sends messages to the ADK agent via SSE and returns a `ReadableStream<UIMessageChunk>` ready for use with the Vercel AI SDK.

```typescript
const stream = await client.runSse("session-123", messages);
```

#### `run<T>(sessionId, messages)` → `Promise<T>`

Sends messages to the ADK agent without streaming and returns the parsed JSON response.

```typescript
const result = await client.run("session-123", messages);
```

#### `processResponseText(text)` → `ReadableStream<UIMessageChunk>`

Converts a raw SSE response body (string) into a `ReadableStream<UIMessageChunk>`. Useful when you already have the raw text from an SSE response.

```typescript
const stream = client.processResponseText(rawSseText);
```

#### `createSessionWithPreferences(sessionId?, options?)` → `Promise<unknown>`

Creates a new session, optionally with a custom session ID and initial state. If no `sessionId` is provided, one is generated automatically.

```typescript
const session = await client.createSessionWithPreferences("my-session", {
  preferredLanguage: "en",
});
```

### Logging

The client emits structured log events at `"debug"` and `"error"` levels. You can subscribe to these via the `onLog` constructor option or by calling `setLogHandler()` at any time.

```typescript
import { AdkClient, type LogEntry } from "@lironsher/google-adk";

const client = new AdkClient({
  userId: "user-123",
  onLog: (entry: LogEntry) => {
    console.log(`[${entry.level}] ${entry.message}`, entry.data);
  },
});

// Or set the handler later:
client.setLogHandler((entry) => {
  myLogger.log(entry.level, entry.message, entry.data);
});
```

Log events are emitted for:
- Every outgoing request (method + URL)
- Successful responses (status code + URL)
- Failed responses (status text, URL, response body)
- Message transformation errors

### Vercel AI SDK Connectors

The library provides two connectors for the Vercel AI SDK:

#### 1. Server-Side Connector

`createAdkAiSdkStream` wraps a raw SSE `Response` and converts it into a `UIMessageStreamResponse` for use in Next.js route handlers.

```typescript
// src/app/api/chat/route.ts
import { createAdkAiSdkStream } from "@lironsher/google-adk/ai-sdk";

export async function POST(req: Request) {
  const { messages } = await req.json();

  // Obtain a raw SSE Response (e.g. from your own fetch to the ADK endpoint)
  const sseResponse = await fetch(`${process.env.ADK_BASE_URL}/run_sse`, {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify({ /* ADK payload */ }),
  });

  return createAdkAiSdkStream(sseResponse);
}
```

#### 2. Client-Side Connector (`AdkChatTransport`)

This connector is a class that extends `HttpChatTransport` from the `ai` package. It allows the `useChat` hook to communicate directly with the Google ADK agent from the client-side. It calls `client.runSse()` internally and handles SSE parsing.

```typescript
// Example usage in a React component
import { useChat } from "@ai-sdk/react";
import { AdkClient } from "@lironsher/google-adk";
import { AdkChatTransport } from "@lironsher/google-adk/ai-sdk";

const client = new AdkClient({
  baseUrl: "https://my-adk-agent.example.com",
  appName: "my-app-name",
  userId: "user-123",
});

const transport = new AdkChatTransport(client);

function MyChatComponent() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    transport,
  });

  // ... render the chat UI
}
```

## Development

To get started with development, clone the repository and install the dependencies:

```bash
git clone https://github.com/KenTandrian/google-adk-client.git
cd google-adk-client
pnpm install
```

### Testing

To run the tests, use the following command:

```bash
pnpm test
```
