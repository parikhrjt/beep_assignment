import type { NextConfig } from "next";

const config: NextConfig = {
  // Ship the SQLite file inside every server function that might open it.
  outputFileTracingIncludes: { "/**": ["./data/beep-jobs.db"] },
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
    ] }];
  },
};
export default config;
