import { NextResponse } from "next/server";
import { AiError, askClaude } from "@/lib/ai";
import {
  MAX_CHARS_FOR_AI,
  SYSTEM_PROMPT,
  buildUserMessage,
  extractSpeakers,
  parseAiJson,
  validate,
} from "@/lib/characters";
import { ExtractError } from "@/lib/extract";
import { readScript } from "@/lib/request";

// 이 API는 대본을 외부 AI 서비스로 보낸다. 그래서 화면에서 사용자가 동의했을 때만 호출된다.
// 대본·AI 답변은 저장하지 않고 console 에도 출력하지 않는다.

export async function POST(request: Request) {
  let script: string;
  let consent: boolean;
  try {
    // 동의 여부는 readScript 가 form 을 읽기 전에 헤더로 먼저 받는다.
    consent = request.headers.get("x-ai-consent") === "yes";
    if (!consent) {
      return NextResponse.json(
        { error: "대본을 AI 서비스로 보내는 것에 동의해야 합니다." },
        { status: 400 },
      );
    }
    ({ script } = await readScript(request));
  } catch (error) {
    const message = error instanceof ExtractError ? error.message : "대본을 읽지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (script.length > MAX_CHARS_FOR_AI) {
    return NextResponse.json({ error: "대본이 너무 깁니다. 나눠서 올려 주세요." }, { status: 400 });
  }

  const speakers = extractSpeakers(script);
  if (speakers.length === 0) {
    return NextResponse.json(
      { error: "대사 줄(예: 민수: 안녕)에서 인물을 찾지 못했습니다." },
      { status: 400 },
    );
  }

  try {
    const answer = await askClaude(SYSTEM_PROMPT, buildUserMessage(script, speakers));
    // AI 답을 읽을 수 없으면 "정보 부족"으로 채운 정상 결과처럼 내보내지 않고 오류로 알린다.
    const parsed = parseAiJson(answer);
    if (!parsed || !Array.isArray((parsed as { characters?: unknown }).characters)) {
      return NextResponse.json(
        { error: "AI 답을 읽지 못해 인물 설명을 만들지 못했습니다. 다시 시도해 주세요." },
        { status: 502 },
      );
    }
    const result = validate(parsed, script, speakers);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "인물을 정리하지 못했습니다." }, { status: 500 });
  }
}
