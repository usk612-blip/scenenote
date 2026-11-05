import { NextResponse } from "next/server";
import { ExtractError } from "@/lib/extract";
import { readScript } from "@/lib/request";
import { analyzeScenes } from "@/lib/scenes";

// 대본은 이 요청을 처리하는 동안만 메모리에 있고, 저장하거나 로그에 남기지 않는다.
// 여기서는 대본 내용이나 파일 이름을 console 에 절대 출력하지 않는다.

export async function POST(request: Request) {
  let script: string;
  let fromPdf: boolean;
  try {
    ({ script, fromPdf } = await readScript(request));
  } catch (error) {
    const message = error instanceof ExtractError ? error.message : "대본을 읽지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
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
