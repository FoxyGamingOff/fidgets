export const SIZES = [
  { key: "small", label: "Petit", multiplier: 0.75 },
  { key: "normal", label: "Normal", multiplier: 1.0 },
  { key: "medium", label: "Moyen", multiplier: 1.6 },
  { key: "large", label: "Grand", multiplier: 2.0 },
  { key: "gargantuan", label: "Gargantuesque", multiplier: 2.5 },
] as const;

export type SizeKey = (typeof SIZES)[number]["key"];

export function sizeMultiplier(key: SizeKey): number {
  return SIZES.find((s) => s.key === key)?.multiplier ?? 1;
}

export function sizeLabel(key: SizeKey): string {
  return SIZES.find((s) => s.key === key)?.label ?? "Normal";
}
