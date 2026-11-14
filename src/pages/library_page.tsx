import { createSignal, For, onMount, Show } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import type { DiffEntry, Recipe, RecipeVersion } from '~/core/types'
import { storage } from '~/core/storage'
import { buildDefaultRecipe, uid } from '~/core/seed_recipe'
import { currentRecipe, replaceRecipe } from '~/core/store'
import { diffRecipes } from '~/core/diff'
import { tileToCanvas } from '~/core/image'
import { getEngine, scheduleEvaluation } from '~/core/evaluation'
import './library_page.css'

function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`


export default function LibraryPage() {
  const navigate = useNavigate()
  const [recipes, setRecipes] = createSignal<Recipe[]>([])
  const [versions, setVersions] = createSignal<RecipeVersion[]>([])
  const [compareBase, setCompareBase] = createSignal<RecipeVersion | null>(null)
  const [diffEntries, setDiffEntries] = createSignal<DiffEntry[] | null>(null)

  const refresh = async (): Promise<void> => {
    setRecipes(await storage.listRecipes())
    setVersions(await storage.listVersions(currentRecipe().id))
  }

  onMount(refresh)

  const createRecipe = (): void => {
    const seed = Math.floor(Math.random() * 99999)
    const recipe = buildDefaultRecipe(seed)
    recipe.name = `新配方 · 种子 ${seed}`
    replaceRecipe(recipe)
    scheduleEvaluation()
    void refresh()
  }

  const openRecipe = (recipe: Recipe): void => {
    replaceRecipe(recipe)
    scheduleEvaluation()
    void refresh()
    navigate('/editor')
  }

  const removeRecipe = async (id: string): Promise<void> => {
    await storage.deleteRecipe(id)
    await refresh()
  }

  const saveVersion = async (): Promise<void> => {
    const version: RecipeVersion = {
      id: uid('ver'),
      recipeId: currentRecipe().id,
      label: `快照 ${formatTime(Date.now())}`,
      snapshot: structuredClone(currentRecipe()),
      createdAt: Date.now(),
    }
    await storage.saveVersion(version)
    await refresh()
  }

  const restoreVersion = (version: RecipeVersion): void => {
    replaceRecipe(version.snapshot, true)
    scheduleEvaluation()
    void refresh()
  }

  const toggleCompare = (version: RecipeVersion): void => {
    if (compareBase()?.id === version.id) {
      setCompareBase(null)
      setDiffEntries(null)
      return
    }
    if (!compareBase()) {
      setCompareBase(version)
      return
    }
    setDiffEntries(diffRecipes(compareBase()!.snapshot, version.snapshot))
  }

  const renderThumb = (recipe: Recipe): string => {
    try {
      const { material } = getEngine().evaluate(recipe, 128)
      return tileToCanvas(material.baseColor).toDataURL()
    } catch {
      return ''
    }
  }

  return (
    <div class="library-page">
      <section class="library-section">
        <div class="section-head">
          <h2>配方库</h2>
          <button class="primary" onClick={createRecipe}>新建配方</button>
        </div>
        <Show
          when={recipes().length > 0}
          fallback={
            <div class="empty-state card">
              <div class="empty-icon">
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M4 6h16M4 12h16M4 18h10" stroke-linecap="round" />
                </svg>
              </div>
              <h3>还没有存档配方</h3>
              <p>新建一个配方，或在编辑器中自动保存当前工作配方</p>
            </div>
          }
        >
          <div class="recipe-grid">
            <For each={recipes()}>
              {(recipe) => (
                <div class="recipe-card card" classList={{ active: recipe.id === currentRecipe().id }}>
                  <img class="recipe-thumb" src={renderThumb(recipe)} alt={recipe.name} />
                  <div class="recipe-info">
                    <h4>{recipe.name}</h4>
                    <p class="muted">种子 {recipe.seed} · {recipe.nodes.length} 节点</p>
                    <p class="muted">更新于 {formatTime(recipe.updatedAt)}</p>
                  </div>
                  <div class="recipe-actions">
                    <button onClick={() => openRecipe(recipe)}>打开</button>
                    <button class="danger" onClick={() => removeRecipe(recipe.id)}>删除</button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </section>

      <section class="library-section">
        <div class="section-head">
          <h2>当前配方的版本快照</h2>
          <button onClick={saveVersion}>保存当前为快照</button>
        </div>
        <Show
          when={versions().length > 0}
          fallback={<p class="muted">暂无快照，保存后可在两个版本之间做参数级对比</p>}
        >
          <div class="version-list card">
            <For each={versions()}>
              {(version) => (
                <div class="version-row">
                  <div>
                    <strong>{version.label}</strong>
                    <p class="muted">{formatTime(version.createdAt)} · {version.snapshot.nodes.length} 节点</p>
                  </div>
                  <div class="version-actions">
                    <button
                      classList={{ primary: compareBase()?.id === version.id }}
                      onClick={() => toggleCompare(version)}
                    >
                      {compareBase()?.id === version.id ? '对比基准（再点一个）' : '选择对比'}
                    </button>
                    <button onClick={() => restoreVersion(version)}>恢复</button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>

        <Show when={diffEntries()}>
          <div class="diff-panel card">
            <h3>版本差异（{diffEntries()!.length} 项）</h3>
            <For each={diffEntries()!.slice(0, 60)}>
              {(entry) => (
                <div class="diff-row">
                  <span class={`diff-badge ${entry.kind}`}>{entry.kind}</span>
                  <span class="diff-path">{entry.path}</span>
                  <span class="muted">{String(entry.before ?? '∅')} → {String(entry.after ?? '∅')}</span>
                </div>
              )}
            </For>
            <Show when={diffEntries()!.length > 60}>
              <p class="muted">仅展示前 60 项，共 {diffEntries()!.length} 项</p>
            </Show>
          </div>
        </Show>
      </section>
    </div>
  )
}
