import { createSignal, For, Show } from 'solid-js'
import type { BakeSize } from '~/core/types'
import { getEngine } from '~/core/evaluation'
import { currentRecipe } from '~/core/store'
import { downloadImageData } from '~/core/image'
import { NODE_DEFS } from '~/core/node_defs'
import './bake_page.css'

const SIZES: BakeSize[] = [256, 512, 1024, 2048]

interface BakedSet {
  baseColor: ImageData
  normal: ImageData
  packed: ImageData
  height: ImageData
  ms: number
  brokenEdges: string[]
}

const CHANNEL_CARDS: { key: keyof Omit<BakedSet, 'ms' | 'brokenEdges'>; label: string; hint: string }[] = [
  { key: 'baseColor', label: '基础色 BaseColor', hint: 'RGB · sRGB' },
  { key: 'normal', label: '法线 Normal', hint: '切线空间 RGB' },
  { key: 'packed', label: '打包 ORM', hint: 'R=1 G=粗糙度 B=金属度 A=1' },
  { key: 'height', label: '高度 Height', hint: '灰度' },
]

function BakedCard(props: { image: ImageData; label: string; hint: string; filename: string }) {
  let canvas: HTMLCanvasElement | undefined
  const draw = (el: HTMLCanvasElement) => {
    canvas = el
    el.width = props.image.width
    el.height = props.image.height
    el.getContext('2d')!.putImageData(props.image, 0, 0)
  }
  return (
    <div class="baked-card card">
      <div class="baked-head">
        <div>
          <h4>{props.label}</h4>
          <p class="muted">{props.hint}</p>
        </div>
        <button onClick={() => canvas && downloadImageData(props.image, props.filename)}>下载 PNG</button>
      </div>
      <canvas ref={draw} class="baked-canvas" />
    </div>
  )
}

export default function BakePage() {
  const [size, setSize] = createSignal<BakeSize>(512)
  const [baking, setBaking] = createSignal(false)
  const [progress, setProgress] = createSignal(0)
  const [result, setResult] = createSignal<BakedSet | null>(null)
  const [cancelled, setCancelled] = createSignal(false)
  let cancelSignal = { cancelled: false }

  const startBake = async (): Promise<void> => {
    setBaking(true)
    setCancelled(false)
    setProgress(0)
    cancelSignal = { cancelled: false }
    try {
      const engine = getEngine()
      const baked = await engine.bake(
        currentRecipe(),
        { size: size(), pack: 'orm' },
        cancelSignal,
        (p) => setProgress(p),
      )
      setResult({
        baseColor: baked.baseColor,
        normal: baked.normal,
        packed: baked.packed,
        height: baked.heightImg,
        ms: baked.report.ms,
        brokenEdges: baked.report.brokenEdges,
      })
    } catch (err) {
      if ((err as Error).message.includes('取消')) setCancelled(true)
    } finally {
      setBaking(false)
    }
  }

  const cancelBake = (): void => {
    cancelSignal.cancelled = true
  }

  const downloadAll = (): void => {
    const r = result()
    if (!r) return
    const stem = currentRecipe().name.replace(/[^\w一-龥]+/g, '_')
    downloadImageData(r.baseColor, `${stem}_basecolor.png`)
    setTimeout(() => downloadImageData(r.normal, `${stem}_normal.png`), 150)
    setTimeout(() => downloadImageData(r.packed, `${stem}_orm.png`), 300)
    setTimeout(() => downloadImageData(r.height, `${stem}_height.png`), 450)
  }

  const brokenLabels = (): string[] => {
    const r = result()
    if (!r) return []
    return r.brokenEdges.map((edgeId) => {
      const edge = currentRecipe().edges.find((e) => e.id === edgeId)
      if (!edge) return edgeId
      const from = NODE_DEFS[currentRecipe().nodes.find((n) => n.id === edge.fromNode)?.type ?? '']?.label ?? '?'
      const to = NODE_DEFS[currentRecipe().nodes.find((n) => n.id === edge.toNode)?.type ?? '']?.label ?? '?'
      return `${from} → ${to}`
    })
  }

  return (
    <div class="bake-page">
      <div class="bake-config card">
        <h3>烘焙设置</h3>
        <label>输出分辨率</label>
        <div class="size-group">
          <For each={SIZES}>
            {(s) => (
              <button classList={{ primary: size() === s }} disabled={baking()} onClick={() => setSize(s)}>
                {s} × {s}
              </button>
            )}
          </For>
        </div>

        <div class="pack-info">
          <h4>通道打包</h4>
          <div class="channel-row"><span class="swatch r" />R：保留 1.0</div>
          <div class="channel-row"><span class="swatch g" />G：粗糙度 Roughness</div>
          <div class="channel-row"><span class="swatch b" />B：金属度 Metallic</div>
          <div class="channel-row"><span class="swatch a" />A：保留 1.0</div>
        </div>

        <div class="bake-actions">
          <button class="primary" disabled={baking()} onClick={startBake}>
            {baking() ? `烘焙中 ${Math.round(progress() * 100)}%` : '开始烘焙'}
          </button>
          <button danger disabled={!baking()} onClick={cancelBake}>取消烘焙</button>
          <button disabled={!result() || baking()} onClick={downloadAll}>全部下载</button>
        </div>

        <Show when={baking()}>
          <div class="progress-track">
            <div class="progress-fill" style={{ width: `${progress() * 100}%` }} />
          </div>
        </Show>
        <Show when={cancelled()}>
          <p class="danger-text">烘焙已取消，未输出贴图</p>
        </Show>
        <Show when={result()}>
          <p class="muted">完成，总耗时 {result()!.ms.toFixed(0)}ms</p>
        </Show>
        <Show when={brokenLabels().length > 0}>
          <div class="broken-note">
            <strong class="danger-text">坏连线保留出图（{brokenLabels().length} 条）</strong>
            <ul>
              <For each={brokenLabels()}>{(label) => <li>{label}</li>}</For>
            </ul>
          </div>
        </Show>
      </div>

      <div class="bake-results">
        <Show
          when={result()}
          fallback={
            <div class="empty-state card">
              <div class="empty-icon">
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 15l5-5 4 4 3-3 6 6" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </div>
              <h3>尚未烘焙</h3>
              <p>选择分辨率后开始烘焙，坏连线不会阻断出图</p>
            </div>
          }
        >
          <div class="baked-grid">
            <For each={CHANNEL_CARDS}>
              {(card) => (
                <BakedCard
                  image={result()![card.key]}
                  label={card.label}
                  hint={card.hint}
                  filename={`${currentRecipe().id}_${card.key}.png`}
                />
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  )
}
