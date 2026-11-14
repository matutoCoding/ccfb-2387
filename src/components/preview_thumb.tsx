import { createEffect, createSignal, For, Show } from 'solid-js'
import { useEvaluation } from '~/core/evaluation'
import { tileToCanvas } from '~/core/image'
import { currentRecipe } from '~/core/store'
import { NODE_DEFS } from '~/core/node_defs'
import './preview_thumb.css'

type ChannelMode = 'color' | 'r' | 'g' | 'b'

const CHANNEL_OPTIONS: { label: string; value: ChannelMode }[] = [
  { label: '彩色', value: 'color' },
  { label: 'R', value: 'r' },
  { label: 'G', value: 'g' },
  { label: 'B', value: 'b' },
]

export default function PreviewThumb() {
  const { material, report, evalVersion, evalMs } = useEvaluation()
  const [mode, setMode] = createSignal<ChannelMode>('color')
  const [canvas, setCanvas] = createSignal<HTMLCanvasElement>()

  createEffect(() => {
    // 依赖 evalVersion 与 mode，每次重算后刷新画面
    void evalVersion()
    const c = canvas()
    const mat = material()
    if (!c || !mat) return
    const ctx = c.getContext('2d')!
    const source = mat.baseColor
    const channel = mode() === 'color' ? undefined : mode() === 'r' ? 0 : mode() === 'g' ? 1 : 2
    const rendered = tileToCanvas(source, channel)
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.drawImage(rendered, 0, 0, c.width, c.height)
  })

  const slowestNodes = (): { id: string; ms: number }[] => {
    const r = report()
    if (!r) return []
    return Object.entries(r.timings)
      .map(([id, ms]) => ({ id, ms }))
      .filter((x) => x.ms > 0)
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 4)
  }

  const nodeLabel = (id: string): string =>
    NODE_DEFS[currentRecipe().nodes.find((n) => n.id === id)?.type ?? '']?.label ?? id

  return (
    <div class="preview-thumb card">
      <div class="thumb-header">
        <h3>局部预览</h3>
        <div class="channel-switch">
          <For each={CHANNEL_OPTIONS}>
            {(opt) => (
              <button
                class="ghost"
                classList={{ active: mode() === opt.value }}
                onClick={() => setMode(opt.value)}
              >
                {opt.label}
              </button>
            )}
          </For>
        </div>
      </div>
      <Show
        when={material()}
        fallback={<div class="thumb-loading muted">首次求值中…</div>}
      >
        <canvas ref={setCanvas} width={256} height={256} class="thumb-canvas" />
      </Show>
      <div class="thumb-meta">
        <div class="meta-row">
          <span class="muted">重算耗时</span>
          <span>{evalMs().toFixed(2)}ms</span>
        </div>
        <Show when={slowestNodes().length > 0}>
          <div class="meta-title muted">受影响节点</div>
          <For each={slowestNodes()}>
            {(item) => (
              <div class="meta-row">
                <span>{nodeLabel(item.id)}</span>
                <span>{item.ms.toFixed(2)}ms</span>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  )
}
