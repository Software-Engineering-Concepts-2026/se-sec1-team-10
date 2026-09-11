// Derive from the current profile instead of persisting a stale BMI value.
export function calculateBmi(weightKg: number | null, heightCm: number | null): number | null {
  if (weightKg === null || heightCm === null || weightKg <= 0 || heightCm <= 0) return null;
  return Math.round(weightKg / ((heightCm / 100) ** 2) * 10) / 10;
}
