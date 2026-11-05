// Anthropic Messages API 호출. 대본이 외부로 나가는 유일한 곳이다.
// 필요한 환경 변수: ANTHROPIC_API_KEY  (.env 또는 Vercel 환경 변수에만 둔다)
// 선택: ANTHROPIC_MODEL (기본값 claude-sonnet-5-5), ANTHROPIC_BASE_URL (시험용)
// 대본·답변·오류 내용을 로그에 남기지 않는다.

export class AiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function askClaude(system: string, user: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new AiError("AI 서비스 키가 설정되지 않았습니다.", 503);

  const base = process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com";
  let response: Response;
  try {
    response = await fetch(`${base}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5",
        max_tokens: 4096,
        temperature: 0,
        system,
        messages: [{ role: "user", content: user }],
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    throw new AiError("AI 서비스에 연결하지 못했습니다.", 502);
  }

  if (!response.ok) {
    // 응답 본문에는 입력 일부가 들어 있을 수 있으므로 읽어서 남기지 않는다.
    throw new AiError(
      response.status === 401
        ? "AI 서비스 키가 올바르지 않습니다."
        : response.status === 429
          ? "AI 서비스 사용 한도를 넘었습니다. 잠시 후 다시 시도해 주세요."
          : "AI 서비스에서 오류가 났습니다.",
      502,
    );
  }

  let data: { content?: { type: string; text?: string }[]; stop_reason?: string };
  try {
    data = await response.json();
  } catch {
    throw new AiError("AI 서비스의 답을 읽지 못했습니다. 다시 시도해 주세요.", 502);
  }

  // 답이 최대 길이에서 잘렸으면 끝까지 받지 못한 것이므로 정상 결과처럼 쓰지 않는다.
  if (data.stop_reason === "max_tokens") {
    throw new AiError(
      "AI 답이 너무 길어서 끝까지 받지 못했습니다. 인물이 많은 대본은 나눠서 올려 주세요.",
      502,
    );
  }

  return (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
}
