import { NextResponse } from "next/server";
import { ACCESS_COOKIE, verifySessionToken } from "@/lib/access";
import { ExtractError, MAX_BYTES, extractFromFile } from "@/lib/extract";
import { analyzeScenes } from "@/lib/scenes";

// 대본은 이 요청을 처리하는 동안만 메모리에 있고, 저장하거나 로그에 남기지 않는다.
// 여기서는 대본 내용이나 파일 이름을 console 에 절대 출력하지 않는다.

export async function POST(request: Request) {
  // proxy.ts 에서 한 번 막지만, 여기서도 서버가 한 번 더 확인한다.
  const cookie = request.headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((part) => part.startsWith(`${ACCESS_COOKIE}=`))
    ?.slice(ACCESS_COOKIE.length + 1);
  if (!verifySessionToken(cookie)) {
    return NextResponse.json({ error: "접근 암호가 필요합니다." }, { status: 401 });
  }

  let script = "";
  let fromPdf = false;
  try {
    const type = request.headers.get("content-type") ?? "";
    if (type.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      const text = form.get("text");
      if (file instanceof File && file.size > 0) {
        fromPdf = file.name.toLowerCase().endsWith(".pdf");
        script = await extractFromFile(file);
      } else if (typeof text === "string") {
        if (text.length > MAX_BYTES) throw new ExtractError("글자가 너무 깁니다.");
        script = text;
      }
    } else {
      return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 415 });
    }
  } catch (error) {
    if (error instanceof ExtractError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "대본을 읽지 못했습니다." }, { status: 400 });
  }

  if (!script.trim()) {
    return NextResponse.json({ error: "대본이 비어 있습니다." }, { status: 400 });
  }

  const result = analyzeScenes(script);

  // 일부 PDF는 한글 글꼴 정보가 없어 한글이 빠진 채로 읽힌다.
  // 씬은 찾았는데 장소가 하나도 읽히지 않으면 결과를 믿지 말라고 알려 준다.
  let warning: string | undefined;
  if (fromPdf && result.scenes.length > 0 && result.scenes.every((s) => !/[\p{L}\p{N}]/u.test(s.place))) {
    warning =
      "이 PDF에서는 한글이 제대로 읽히지 않은 것 같습니다. 결과를 믿지 마시고, 워드(.docx)나 .txt로 저장해서 다시 올려 주세요.";
  }

  return NextResponse.json({ ...result, warning }, { headers: { "Cache-Control": "no-store" } });
}
