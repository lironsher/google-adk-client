import type { UIMessageChunk } from "ai";

import { Apps } from "./api/apps";
import { Artifacts } from "./api/artifacts";
import { Debug } from "./api/debug";
import { Evals } from "./api/evals";
import { Events } from "./api/events";
import { Sessions } from "./api/sessions";
import type { AgentRunSsePayload, LogHandler, LogLevel, UIMessage } from "./types";
import { generateUUID } from "./utils";

export interface AdkClientOptions {
  appName?: string;
  baseUrl?: string;
  userId: string;
  onLog?: LogHandler;
}

/**
 * The main entry point for interacting with the ADK API.
 * It provides methods to manage applications, sessions, artifacts, evaluations,
 * and events.
 *
 * @example
 * const adkClient = new AdkClient({
 *   appName: "myApp",
 *   baseUrl: "https://api.example.com",
 *   userId: "user123",
 * });
 */
export class AdkClient {
  private readonly appName: string;
  private readonly baseUrl: string;
  private readonly userId: string;
  private logHandler?: LogHandler;

  public readonly sessions: Sessions;
  public readonly artifacts: Artifacts;
  public readonly evals: Evals;
  public readonly apps: Apps;
  public readonly debug: Debug;
  public readonly events: Events;

  constructor(options: AdkClientOptions) {
    const appName = options.appName ?? process.env.ADK_APP_NAME;
    const baseUrl = options.baseUrl ?? process.env.ADK_BASE_URL;
    this.userId = options.userId;
    this.logHandler = options.onLog;

    if (!appName) {
      throw new Error(
        "App name is required. Provide it in the constructor or set the ADK_APP_NAME environment variable."
      );
    }

    if (!baseUrl) {
      throw new Error(
        "Base URL is required. Provide it in the constructor or set the ADK_BASE_URL environment variable."
      );
    }
    this.appName = appName;
    this.baseUrl = baseUrl;

    this.apps = new Apps({
      appName: this.appName,
      userId: this.userId,
      request: this.request.bind(this),
      requestJson: this.requestJson.bind(this),
    });

    this.artifacts = new Artifacts({
      appName: this.appName,
      userId: this.userId,
      request: this.request.bind(this),
      requestJson: this.requestJson.bind(this),
    });

    this.debug = new Debug({
      appName: this.appName,
      userId: this.userId,
      request: this.request.bind(this),
      requestJson: this.requestJson.bind(this),
    });

    this.evals = new Evals({
      appName: this.appName,
      userId: this.userId,
      request: this.request.bind(this),
      requestJson: this.requestJson.bind(this),
    });

    this.events = new Events({
      appName: this.appName,
      userId: this.userId,
      request: this.request.bind(this),
      requestJson: this.requestJson.bind(this),
    });

    this.sessions = new Sessions({
      appName: this.appName,
      userId: this.userId,
      request: this.request.bind(this),
      requestJson: this.requestJson.bind(this),
    });
  }

  setLogHandler(handler: LogHandler): void {
    this.logHandler = handler;
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    this.logHandler?.({ level, message, data });
  }

  private async request(
    endpoint: string,
    options?: RequestInit
  ): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    this.log("debug", `${options?.method ?? "GET"} ${url}`, { options });

    const response = await fetch(url, {
      ...options,
      headers: {
        accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      this.log("error", `API call failed: ${response.statusText}`, {
        response,
        url,
        body: await response.text(),
      });
      throw new Error(`API call failed: ${response.statusText}`);
    }

    this.log("debug", `${response.status} ${url}`, { response });
    return response;
  }

  private async requestJson<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await this.request(endpoint, options);
    return response.json();
  }

  private transformMessagesToAdkNewMessage(
    messages: UIMessage[]
  ): AgentRunSsePayload["newMessage"] {
    try {
      const lastMessage = messages[messages.length - 1];

      const parts = lastMessage.parts.map((part) => {
        switch (part.type) {
          case "text":
            return { text: part.text };
          case "file": {
            const [_, base64Data] = part.url?.split(",") ?? [];
            return {
              inlineData: {
                data: base64Data,
                displayName: part.filename ?? "file",
                mimeType: part.mediaType,
              },
            };
          }
          default:
            return {};
        }
      });

      return {
        parts,
        role: lastMessage.role,
      };
    } catch (error) {
      this.log("error", "Failed to transform messages to ADK format, USE UIMessage format instead", {
        error,
        messages,
      });
      throw error;
    }
  }

  async runSse(sessionId: string, messages: UIMessage[]): Promise<ReadableStream<UIMessageChunk>> {
    const newMessage = this.transformMessagesToAdkNewMessage(messages);
    const body: AgentRunSsePayload = {
      appName: this.appName,
      userId: this.userId,
      sessionId: sessionId,
      newMessage,
      streaming: true,
    };

    const response = await this.request("/run_sse", {
      body: JSON.stringify(body),
      headers: { accept: "text/event-stream" },
      method: "POST",
    });

    return this.processResponseText(await response.text());
  }

  processResponseText(text: string): ReadableStream<UIMessageChunk> {
    const messageId = generateUUID();
    const lines = text.split("\n");

    return new ReadableStream({
      start(controller) {
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const json = JSON.parse(line.substring(6));
              if (json?.partial && json?.content?.parts?.[0].text) {
                const chunk: UIMessageChunk = {
                  type: "text-delta",
                  id: messageId,
                  delta: json.content.parts[0].text,
                };
                controller.enqueue(chunk);
              }
            } catch (error) {
              console.error(error);
            }
          }
        }
        controller.close();
      },
    });
  }

  async run<T = unknown>(
    sessionId: string,
    messages: UIMessage[]
  ): Promise<T> {
    const newMessage = this.transformMessagesToAdkNewMessage(messages);
    const body: AgentRunSsePayload = {
      appName: this.appName,
      userId: this.userId,
      sessionId: sessionId,
      newMessage,
      streaming: false,
    };

    const response = await this.request("/run", {
      body: JSON.stringify(body),
      method: "POST",
    });

    return response.json();
  }

  async createSessionWithPreferences(sessionId?: string, options?: any): Promise<any> {
    if (!sessionId) {
      sessionId = `session_${Math.random().toString(36).substring(2, 15)}`;
    }

    return this.requestJson(`/apps/${this.appName}/users/${this.userId}/sessions/${sessionId}`, {
      method: "POST",
      body: JSON.stringify(options || {}),
    });
  }
}

export * from "./types";

