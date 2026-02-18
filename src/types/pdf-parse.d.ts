declare module "pdf-parse" {
  function pdfParse(buf: Buffer): Promise<{ text?: string; numpages?: number }>;
  export default pdfParse;
}
