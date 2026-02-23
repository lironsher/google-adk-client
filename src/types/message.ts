export type UIMessagePart = { type: string; text?: string; url?: string; filename?: string; mediaType?: string; };

export interface UIMessage {
  role: string;
  parts: UIMessagePart[];
}
