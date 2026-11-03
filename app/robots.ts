import type { MetadataRoute } from "next";

// Keep the signed-in surfaces and scratch pages out of search engines.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: ["/api/", "/dashboard", "/demo", "/test", "/onboarding"] }],
  };
}
