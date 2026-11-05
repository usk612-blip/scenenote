import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE, verifySessionToken } from "@/lib/access";

// 모든 화면과 API 앞에서 접근 암호를 통과했는지 서버에서 확인한다.
// 통과하지 않았으면 화면은 /access 로 보내고, API는 401을 돌려준다.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 암호 입력 화면과 암호 확인 API는 누구나 접근할 수 있어야 한다.
  if (pathname === "/access" || pathname === "/api/access") {
    return NextResponse.next();
  }

  if (verifySessionToken(request.cookies.get(ACCESS_COOKIE)?.value)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "접근 암호가 필요합니다." }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/access", request.url));
}

export const config = {
  // 정적 파일(_next), 아이콘, robots.txt 는 제외한다.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
