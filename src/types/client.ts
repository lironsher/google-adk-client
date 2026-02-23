export interface ApiClient {
  appName: string;
  userId: string;
  requestJson: <T>(endpoint: string, options?: RequestInit) => Promise<T>;
  request: (endpoint: string, options?: RequestInit) => Promise<Response>;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
}

export type LogHandler = (entry: LogEntry) => void;
