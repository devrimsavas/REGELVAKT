// Norwegian organization numbers: 9 digits, the last a modulus 11 check
// digit of the first eight. The same check as the API's, so a mistyped
// number is caught before Brønnøysundregistrene is asked.
const WEIGHTS = [3, 2, 7, 6, 5, 4, 3, 2] as const;

// What people type: "974 760 673", "974760673", " 974-760-673 "
export function normalizeOrgNumber(input: string): string {
  return input.replace(/[\s.-]/g, "");
}

export function isValidOrgNumber(value: string): boolean {
  if (!/^\d{9}$/.test(value)) return false;
  const digits = [...value].map(Number);
  const sum = WEIGHTS.reduce(
    (total, weight, index) => total + weight * (digits[index] ?? 0),
    0,
  );
  const remainder = sum % 11;
  const checkDigit = remainder === 0 ? 0 : 11 - remainder;
  // A check digit of 10 is never issued
  return checkDigit !== 10 && checkDigit === digits[8];
}

// 974760673 -> "974 760 673", as Brønnøysundregistrene writes it
export function formatOrgNumber(value: string): string {
  return /^\d{9}$/.test(value)
    ? `${value.slice(0, 3)} ${value.slice(3, 6)} ${value.slice(6)}`
    : value;
}
