/** Lightweight catalog finish choices; importing the properties UI must not load Three.js. */
export const furnitureFinishes: Record<string, { roughness: number; metalness: number; opacity?: number }> = {
  Wood: { roughness: 0.75, metalness: 0 },
  Metal: { roughness: 0.25, metalness: 0.85 },
  Fabric: { roughness: 1, metalness: 0 },
  Leather: { roughness: 0.55, metalness: 0 },
  Glass: { roughness: 0.1, metalness: 0, opacity: 0.35 },
  Plastic: { roughness: 0.35, metalness: 0 },
  Stone: { roughness: 0.9, metalness: 0 },
  Ceramic: { roughness: 0.2, metalness: 0 },
};
