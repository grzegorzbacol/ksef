declare module "mailparser" {
  export interface Attachment {
    filename?: string;
    content: Buffer;
    contentType: string;
  }
  export interface ParsedMail {
    from?: { text?: string };
    subject?: string;
    text?: string;
    html?: string;
    date?: Date;
    messageId?: string | null;
    attachments?: Attachment[];
  }
  export function simpleParser(input: Buffer | unknown, options?: unknown): Promise<ParsedMail>;
}
