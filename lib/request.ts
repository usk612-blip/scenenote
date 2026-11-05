import { ACCESS_COOKIE, verifySessionToken } from "@/lib/access";
import { ExtractError, MAX_BYTES, extractFromFile } from "@/lib/extract";

// 대본을 받는 API들이 함께 쓰는 처리. 대본은 메모리에서만 다루고 저장·로그하지 않는다.

// proxy.ts 에서 한 번 막지만, 각 API에서도 서버가 한 번 더 확인한다.
export function isAuthorized(request: Request): boolean {
  const cookie = request.headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((part) => part.startsWith(`${ACCESS_COOKIE}=`))
    ?.slice(ACCESS_COOKIE.length + 1);
  return verifySessionToken(cookie);
}

export async function readScript(request: Request): Promise<{ script: string; fromPdf: boolean }> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.includes("multipart/form-data")) {
    throw new ExtractError("요청 형식이 올바르지 않습니다.");
  }
  const form = await request.formData();
  const file = form.get("file");
  const text = form.get("text");
  let script = "";
  let fromPdf = false;
  if (file instanceof File && file.size > 0) {
    fromPdf = file.name.toLowerCase().endsWith(".pdf");
    script = await extractFromFile(file);
  } else if (typeof text === "string") {
    if (text.length > MAX_BYTES) throw new ExtractError("글자가 너무 깁니다.");
    script = text;
  }
  if (!script.trim()) throw new ExtractError("대본이 비어 있습니다.");
  return { script, fromPdf };
}
