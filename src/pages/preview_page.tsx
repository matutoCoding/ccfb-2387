import { createSignal, For } from 'solid-js'
import { SceneBridge, type ViewChannel } from '~/three/scene'
import { useEvaluation } from '~/core/evaluation'
import { currentRecipe, mutateRecipe } from '~/core/store'
import { buildDefaultRecipe } from '~/core/seed_recipe'
import './preview_page.css'

const CHANNELS: { label: string; value: ViewChannel }[] = [
  { label: 'PBR 灯光', value: 'lit' },
  { label: '基础色', value: 'baseColor' },
  { label: '法线', value: 'normal' },
  { label: '粗糙度', value: 'roughness' },
  { label: '金属度', value: 'metallic' },
  { label: '高度', value: 'height' },
]

export default function PreviewPage() {
  const { report } = useEvaluation()
  const [channel, setChannel] = createSignal<ViewChannel>('lit')
  const [lightRotation, setLightRotation] = createSignal(35)
  const [autoRotate, setAutoRotate] = createSignal(false)
  const [showSeams, setShowSeams] = createSignal(false)
  const [seedInput, setSeedInput] = createSignal(String(currentRecipe().seed))

  const rebuild = () => {
    const seed = Number(seedInput()) || 0
    const fresh = buildDefaultRecipe(seed)
    mutateRecipe((draft) => {
      draft.seed = seed
      draft.nodes = fresh.nodes
      draft.edges = fresh.edges
    })
  }

  return (
    <div class="preview-page">
      <div class="preview-stage card">
        <SceneBridge
          channel={channel}
          lightRotation={lightRotation}
          autoRotate={autoRotate}
          showSeams={showSeams}
        />
      </div>
      <div class="preview-controls card">
        <section class="control-section">
          <h3>通道查看</h3>
          <div class="chip-group">
            <For each={CHANNELS}>
              {(item) => (
                <button
                  classList={{ primary: channel() === item.value }}
                  onClick={() => setChannel(item.value)}
                >
                  {item.label}
                </button>
              )}
            </For>
          </div>
        </section>

        <section class="control-section">
          <h3>灯光</h3>
          <label>主光旋转 {lightRotation()}°</label>
          <input
            type="range"
            min={0}
            max={360}
            value={lightRotation()}
            onInput={(e) => setLightRotation(Number(e.currentTarget.value))}
          />
          <label class="check-row">
            <input type="checkbox" checked={autoRotate()} onChange={(e) => setAutoRotate(e.currentTarget.checked)} />
            <span>自动旋转展示</span>
          </label>
        </section>

        <section class="control-section">
          <h3>接缝定位</h3>
          <label class="check-row">
            <input type="checkbox" checked={showSeams()} onChange={(e) => setShowSeams(e.currentTarget.checked)} />
            <span>高亮 UV 接缝（红点）</span>
          </label>
        </section>

        <section class="control-section">
          <h3>种子重建</h3>
          <div class="seed-row">
            <input type="number" value={seedInput()} onChange={(e) => setSeedInput(e.currentTarget.value)} />
            <button onClick={rebuild}>重建</button>
          </div>
        </section>

        <section class="control-section">
          <h3>求值状态</h3>
          <p class="muted">
            耗时 {report() ? `${report()!.ms.toFixed(2)}ms` : '-'} ·
            坏线 {report()?.brokenEdges.length ?? 0} 条（兜底出图）
          </p>
        </section>
      </div>
    </div>
  )
}
