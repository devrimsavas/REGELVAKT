// Norwegian organization numbers have 9 digits. The last digit is a
// modulus 11 check digit calculated from the first eight.
const ORG_NUMBER_PATTERN = /^\d{9}$/;
const WEIGHTS = [3, 2, 7, 6, 5, 4, 3, 2] as const;

export function isValidOrgNumber(value: unknown): value is string {
  if (typeof value !== "string" || !ORG_NUMBER_PATTERN.test(value)) {
    return false;
  }

  const digits = [...value].map(Number);
  const sum = WEIGHTS.reduce(
    (total, weight, index) => total + weight * (digits.at(index) ?? 0),
    0,
  );

  const remainder = sum % 11;
  const checkDigit = remainder === 0 ? 0 : 11 - remainder;

  // A check digit of 10 is never issued
  if (checkDigit === 10) {
    return false;
  }

  return checkDigit === digits.at(8);
}
