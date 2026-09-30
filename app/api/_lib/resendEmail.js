const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** Sends one email through Resend; `to` may be a comma-separated list. */
export async function sendResendEmail({ apiKey, from, to, subject, html, text, idempotencyKey }) {
  const recipients = String(to)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!recipients.length) throw new Error("RESEND_TO_EMAIL is missing");

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ from, to: recipients, subject, html, text }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || `Resend ${response.status}`);
  }
  return payload;
}
