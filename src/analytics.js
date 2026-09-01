import { inject } from "@vercel/analytics";

// Keep analytics website-only and production-only. Vercel's same-origin script
// records anonymized page views without cookies or application/node data.
if (import.meta.env.PROD) {
  inject({ mode: "production", debug: false });
}
