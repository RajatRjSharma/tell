/** Re-export shared API rate limiting helpers. */
export {
  clientKey,
  enforceAuthIdentityRateLimit,
  enforceAuthRateLimit,
  enforceRateLimit,
} from "@/lib/api/rate-limit";
