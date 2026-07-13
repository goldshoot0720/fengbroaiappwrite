export const RESEND_SLOT_COUNT = 21;
export const RESEND_DEFAULT_VISIBLE_SLOT_COUNT = 3;
export const RESEND_VISIBLE_SLOT_OPTIONS = [3, 6, 9, 12, 15, 18, 21] as const;
export const RESEND_DEFAULT_FROM = "FengBro <onboarding@resend.dev>";

export function getResendSuffix(slot: number): string {
  return slot === 1 ? "" : String(slot);
}

export function getResendSlotFields(slot: number) {
  const suffix = getResendSuffix(slot);
  return {
    apiKey: `apiKey${suffix}`,
    toEmail: `toEmail${suffix}`,
    envApiKey: `RESEND_API_KEY${suffix}`,
    envToEmail: `RESEND_TO_EMAIL${suffix}`,
    bodyApiKey: `resendApiKey${suffix}`,
    bodyToEmail: `resendTo${suffix}`,
  };
}

export function createEmptyResendConfig(): Record<string, string> {
  const config: Record<string, string> = {
    fromEmail: RESEND_DEFAULT_FROM,
  };

  for (let slot = 1; slot <= RESEND_SLOT_COUNT; slot++) {
    const fields = getResendSlotFields(slot);
    config[fields.apiKey] = "";
    config[fields.toEmail] = "";
  }

  return config;
}
