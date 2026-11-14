// Pure helpers for auto-renewal. No database, no network: so the rules that decide
// "may we save this card?" and "is it time to charge?" are unit-tested.

export const RENEW_AHEAD_MS = 24 * 3600 * 1000;      // charge when the plan has <= 24h left
export const RENEW_GRACE_MS = 7 * 24 * 3600 * 1000;  // ...but never surprise-charge someone whose plan lapsed over a week ago
export const RETRY_GAP_MS = 6 * 3600 * 1000;         // wait between attempts for the same person
export const MAX_RENEW_FAILURES = 3;                 // then auto-renew switches itself off
// Charge results that need the customer present (PIN, OTP...). A background charge can't finish these.
export const NEEDS_CUSTOMER = new Set(["send_pin", "send_otp", "send_phone", "send_birthday", "send_address", "open_url", "pay_offline"]);

/**
 * Pulls a reusable CARD authorization out of a Paystack transaction, or null.
 * Only the opaque `authorization_code` and display details are kept — never a card number.
 */
export function extractAuthorization(tx) {
  const a = tx?.authorization;
  if (!a || !a.reusable || !a.authorization_code) return null;
  if (a.channel && a.channel !== "card") return null;
  return {
    authorizationCode: String(a.authorization_code),
    signature: a.signature ? String(a.signature) : undefined,
    card: {
      brand: a.card_type ? String(a.card_type).trim() : undefined,
      last4: a.last4 ? String(a.last4) : undefined,
      expMonth: a.exp_month ? String(a.exp_month) : undefined,
      expYear: a.exp_year ? String(a.exp_year) : undefined,
      bank: a.bank ? String(a.bank) : undefined,
    },
  };
}

/** Is it time to renew a plan whose latest paid period ends at `latestExpiresAt`? */
export function isRenewalDue({ latestExpiresAt, now = new Date() }) {
  if (!latestExpiresAt) return false; // never bought this plan: nothing to renew
  const left = new Date(latestExpiresAt).getTime() - new Date(now).getTime();
  return left <= RENEW_AHEAD_MS && left >= -RENEW_GRACE_MS;
}
