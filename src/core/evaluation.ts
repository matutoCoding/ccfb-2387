import { createSignal } from 'solid-js'
import { currentRecipe } from './store'
import { GraphEngine, type MaterialTiles } from './engine'
import type { EvalReport } from './types'

export const PREVIEW_SIZE = 256

// 模块级单例：编辑器、预览、烘焙共用同一引擎与缓存
const engine = new GraphEngine()
const [material, setMaterial] = createSignal<MaterialTiles | null>(null)
const [report, setReport] = createSignal<EvalReport | null>(null)
const [evalMs, setEvalMs] = createSignal(0)
const [evalVersion, setEvalVersion] = createSignal(0)
let timer: ReturnType<typeof setTimeout> | undefined
let lastDirty: string | undefined

// 配方变化后防抖重算；dirtyId 命中时只重算受影响子图
export function scheduleEvaluation(dirtyId?: string): void {
  lastDirty = dirtyId
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    const recipe = currentRecipe()
    const result = engine.evaluate(recipe, PREVIEW_SIZE, lastDirty)
    setMaterial(result.material)
    setReport(result.report)
    setEvalMs(result.report.ms)
    setEvalVersion((v) => v + 1)
  }, 120)
}

export function evaluateNow(dirtyId?: string): MaterialTiles {
  const result = engine.evaluate(currentRecipe(), PREVIEW_SIZE, dirtyId)
  setMaterial(result.material)
  setReport(result.report)
  setEvalMs(result.report.ms)
  setEvalVersion((v) => v + 1)
  return result.material
}

export function getEngine(): GraphEngine {
  return engine
}

export function useEvaluation() {
  return {
    material,
    report,
    evalMs,
    evalVersion,
    scheduleEvaluation,
    evaluateNow,
    getEngine,
  }
}

// 首次进入立即求值一次
