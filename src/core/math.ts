// 确定性随机与噪声：同种子必须重建同一结果

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

// 整数格点哈希，输出 [0,1)
export function hash2i(x: number, y: number, seed: number): number {
  let h = seed | 0
  h = Math.imul(h ^ (x | 0), 374761393)
  h = Math.imul(h ^ (y | 0), 668265263)
  h ^= h >>> 13
  h = Math.imul(h, 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

// 一维序列随机，供配方工厂做确定性布局
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function fade(t: number): number {
  return t * t * (3 - 2 * t)
}

// 双线性插值值噪声，输出 [0,1)
export function valueNoise2(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = fade(x - x0)
  const fy = fade(y - y0)
  const v00 = hash2i(x0, y0, seed)
  const v10 = hash2i(x0 + 1, y0, seed)
  const v01 = hash2i(x0, y0 + 1, seed)
  const v11 = hash2i(x0 + 1, y0 + 1, seed)
  const top = lerp(v00, v10, fx)
  const bottom = lerp(v01, v11, fx)
  return lerp(top, bottom, fy)
}

// 分形布朗运动，输出约 [0,1]
export function fbm2(
  x: number,
  y: number,
  seed: number,
  octaves: number,
  lacunarity = 2,
  gain = 0.5,
): number {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2(x * freq, y * freq, seed + i * 1013)
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return sum / norm
}
