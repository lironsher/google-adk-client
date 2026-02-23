export type UIMessagePart =
  | { type: "text"; text: string }
  | { type: "file"; url: string; filename?: string; mediaType: string };

export interface UIMessage {
  role: string;
  parts: UIMessagePart[];
}
