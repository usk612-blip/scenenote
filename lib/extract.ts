import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

// 올린 파일에서 글자만 꺼낸다. 전부 메모리에서 처리하고 디스크에 쓰지 않는다.

export const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export class ExtractError extends Error {}

function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // 한국어 윈도우 메모장 등에서 저장한 파일은 EUC-KR(CP949)일 수 있다.
    return new TextDecoder("euc-kr").decode(bytes);
  }
}

export async function extractFromFile(file: File): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new ExtractError("파일이 너무 큽니다. 5MB 이하로 올려 주세요.");
  }
  const name = file.name.toLowerCase();
  const bytes = new Uint8Array(await file.arrayBuffer());

  if (name.endsWith(".txt")) {
    return decodeText(bytes);
  }

  if (name.endsWith(".docx")) {
    try {
      const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      return value;
    } catch {
      throw new ExtractError("워드 파일을 읽지 못했습니다. 파일이 손상되지 않았는지 확인해 주세요.");
    }
  }

  if (name.endsWith(".pdf")) {
    try {
      const pdf = await getDocumentProxy(bytes);
      const { text } = await extractText(pdf, { mergePages: true });
      if (!text.trim()) {
        throw new ExtractError(
          "PDF에서 글자를 찾지 못했습니다. 스캔한 이미지 PDF는 지원하지 않습니다.",
        );
      }
      return text;
    } catch (error) {
      if (error instanceof ExtractError) throw error;
      throw new ExtractError("PDF를 읽지 못했습니다. 암호가 걸렸거나 손상된 파일일 수 있습니다.");
    }
  }

  throw new ExtractError("지원하는 형식은 .txt, .docx, .pdf 입니다. (또는 글자를 붙여넣어 주세요.)");
}
