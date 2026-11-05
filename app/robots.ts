import type { MetadataRoute } from "next";

// 검색 엔진이 어떤 페이지도 수집하지 않게 한다.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
