import { NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  SESSION_SECONDS,
  checkAccessCode,
  createSessionToken,
  isConfigured,
  lockRemainingSeconds,
  recordFailure,
  recordSuccess,
} from "@/lib/access";

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: Request) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "서버에 접근 암호가 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  const ip = clientIp(request);
  const locked = lockRemainingSeconds(ip);
  if (locked > 0) {
    return NextResponse.json(
      { error: "시도 횟수를 넘었습니다. 잠시 후 다시 시도해 주세요.", retryAfter: locked },
      { status: 429, headers: { "Retry-After": String(locked) } },
    );
  }

  let code = "";
  try {
    const body = (await request.json()) as { code?: unknown };
    if (typeof body.code === "string") code = body.code.slice(0, 200);
  } catch {
    // 본문이 잘못된 경우는 틀린 암호와 똑같이 처리한다.
  }

  if (!checkAccessCode(code)) {
    recordFailure(ip);
    return NextResponse.json({ error: "접근 암호가 맞지 않습니다." }, { status: 401 });
  }

  recordSuccess(ip);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_COOKIE, createSessionToken(), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
  return response;
}

// 접근 해제(로그아웃)
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ACCESS_COOKIE);
  return response;
}
