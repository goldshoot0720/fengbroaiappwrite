/**
 * Verify Vercel Cron / manual secret access.
 * When CRON_SECRET is unset, allow (dev convenience).
 */
export function verifyAuth(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) return true;

  const { searchParams } = new URL(request.url);
  if (searchParams.get("secret") === cronSecret) return true;

  return false;
}
