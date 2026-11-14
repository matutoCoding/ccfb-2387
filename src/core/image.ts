import type { Tile } from './types'
import { clamp } from './math'

// 瓦片绘制到 canvas：float 灰度，其余按前 3 通道 RGB
export function tileToCanvas(tile: Tile, channel?: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = tile.size
  canvas.height = tile.size
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(tile.size, tile.size)
  const ch = tile.kind === 'float' ? 1 : tile.kind === 'vec2' ? 2 : tile.kind === 'vec3' ? 3 : 4
  for (let i = 0; i < tile.size * tile.size; i++) {
    let r: number
    let g: number
    let b: number
    if (channel !== undefined) {
      const v = clamp(tile.data[i * ch + Math.min(channel, ch - 1)], 0, 1) * 255
      r = v
      g = v
      b = v
    } else if (tile.kind === 'float') {
      const v = clamp(tile.data[i], 0, 1) * 255
      r = v
      g = v
      b = v
    } else {
      r = clamp(tile.data[i * ch], 0, 1) * 255
      g = clamp(tile.data[i * ch + 1], 0, 1) * 255
      b = clamp(tile.data[i * ch + 2], 0, 1) * 255
    }
    const p = i * 4
    image.data[p] = r
    image.data[p + 1] = g
    image.data[p + 2] = b
    image.data[p + 3] = 255
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

export function imageDataToCanvas(image: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  canvas.getContext('2d')!.putImageData(image, 0, 0)
  return canvas
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, 'image/png')
}

// 单张图触发浏览器下载
export function downloadImageData(image: ImageData, filename: string): void {
  downloadCanvas(imageDataToCanvas(image), filename)
}
