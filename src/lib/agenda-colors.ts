export type ProviderColor = {
  bg: string;
  bgLight: string;
  border: string;
  text: string;
};

const PALETTE: ProviderColor[] = [
  { bg: "#f9a8d4", bgLight: "#fce7f3", border: "#f472b6", text: "#9d174d" }, // rosa
  { bg: "#93c5fd", bgLight: "#eff6ff", border: "#60a5fa", text: "#1e40af" }, // azul
  { bg: "#6ee7b7", bgLight: "#ecfdf5", border: "#34d399", text: "#065f46" }, // esmeralda
  { bg: "#c4b5fd", bgLight: "#f5f3ff", border: "#a78bfa", text: "#4c1d95" }, // violeta
  { bg: "#fdba74", bgLight: "#fff7ed", border: "#fb923c", text: "#7c2d12" }, // naranja
  { bg: "#5eead4", bgLight: "#f0fdfa", border: "#2dd4bf", text: "#134e4a" }, // teal
  { bg: "#fcd34d", bgLight: "#fffbeb", border: "#fbbf24", text: "#78350f" }, // amarillo
  { bg: "#a5b4fc", bgLight: "#eef2ff", border: "#818cf8", text: "#312e81" }, // índigo
];

export function buildProviderColorMap(providerIds: string[]): Map<string, ProviderColor> {
  const map = new Map<string, ProviderColor>();
  providerIds.forEach((id, i) => {
    map.set(id, PALETTE[i % PALETTE.length]!);
  });
  return map;
}

export function getProviderColor(
  colorMap: Map<string, ProviderColor>,
  providerId: string,
): ProviderColor {
  return colorMap.get(providerId) ?? PALETTE[0]!;
}
