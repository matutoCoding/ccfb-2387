import type { DiffEntry, Recipe } from './types'

// 浅路径 JSON diff，输出节点/边/参数级变化
export function diffRecipes(before: Recipe, after: Recipe): DiffEntry[] {
  const entries: DiffEntry[] = []
  const walk = (path: string, a: unknown, b: unknown): void => {
    if (a === b) return
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
      const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)])
      for (const key of keys) {
        walk(`${path}.${key}`, (a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
      }
      return
    }
    if (a === undefined) entries.push({ path, kind: 'add', before: a, after: b })
    else if (b === undefined) entries.push({ path, kind: 'remove', before: a, after: b })
    else entries.push({ path, kind: 'change', before: a, after: b })
  }

  const beforeNodeIds = new Set(before.nodes.map((n) => n.id))
  const afterNodeIds = new Set(after.nodes.map((n) => n.id))
  for (const node of after.nodes) {
    if (!beforeNodeIds.has(node.id)) entries.push({ path: `nodes.${node.id}`, kind: 'add', before: undefined, after: node.type })
  }
  for (const node of before.nodes) {
    if (!afterNodeIds.has(node.id)) entries.push({ path: `nodes.${node.id}`, kind: 'remove', before: node.type, after: undefined })
  }
  const beforeEdges = new Set(before.edges.map((e) => e.id))
  const afterEdges = new Set(after.edges.map((e) => e.id))
  for (const id of afterEdges) {
    if (!beforeEdges.has(id)) entries.push({ path: `edges.${id}`, kind: 'add', before: undefined, after: '连线' })
  }
  for (const id of beforeEdges) {
    if (!afterEdges.has(id)) entries.push({ path: `edges.${id}`, kind: 'remove', before: '连线', after: undefined })
  }

  const beforeMap = new Map(before.nodes.map((n) => [n.id, n]))
  for (const node of after.nodes) {
    const old = beforeMap.get(node.id)
    if (old) walk(`nodes.${node.id}.params`, old.params, node.params)
  }
  if (before.seed !== after.seed) {
    entries.push({ path: 'seed', kind: 'change', before: before.seed, after: after.seed })
  }
  if (before.name !== after.name) {
    entries.push({ path: 'name', kind: 'change', before: before.name, after: after.name })
  }
  return entries
}
