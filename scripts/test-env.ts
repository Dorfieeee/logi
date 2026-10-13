/** Deterministic, non-production credentials required by isolated test workers. */
process.env.INTERNAL_AUTH_SECRET ??= "dev-internal-auth-secret"
process.env.JWT_SECRET ??= "test-jwt-secret"
