import { createContext, createSignal, useContext, type JSX } from 'solid-js'
import type { Recipe } from './types'
import { buildDefaultRecipe } from './seed_recipe'
import { History } from './history'
import { storage } from './storage'

interface StoreState {
  recipe: Recipe
  history: History<Recipe>
}

const StoreContext = createContext<StoreState>()

// 模块级单例，路由切换不丢状态
const [recipe, setRecipe] = createSignal<Recipe>(buildDefaultRecipe())
const history = new History<Recipe>()

export function RecipeProvider(props: { children: JSX.Element }) {
  const value: StoreState = {
    get recipe() {
      return recipe()
    },
    history,
  }
  return <StoreContext.Provider value={value}>{props.children}</StoreContext.Provider>
}

export function useRecipeStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('RecipeProvider 缺失')
  return ctx
}

// 带历史记录的变更入口；mutator 直接改 draft
export function mutateRecipe(mutator: (draft: Recipe) => void): void {
  const current = recipe()
  history.commit(current)
  const draft = structuredClone(current)
  mutator(draft)
  draft.updatedAt = Date.now()
  setRecipe(draft)
  void storage.saveRecipe(draft)
}

// 高频变更（如拖拽移动）：不入撤销栈，避免一次移动产生几十步历史
export function touchRecipe(mutator: (draft: Recipe) => void): void {
  const current = recipe()
  const draft = structuredClone(current)
  mutator(draft)
  setRecipe(draft)
}

// 拖拽结束后落库一次
export function persistRecipe(): void {
  void storage.saveRecipe(recipe())
}

export function replaceRecipe(next: Recipe, recordHistory = false): void {
  if (recordHistory) history.commit(recipe())
  setRecipe(structuredClone(next))
  void storage.saveRecipe(next)
}

export function undoRecipe(): void {
  const prev = history.undo(recipe())
  if (prev) {
    setRecipe(prev)
    void storage.saveRecipe(prev)
  }
}

export function redoRecipe(): void {
  const next = history.redo(recipe())
  if (next) {
    setRecipe(next)
    void storage.saveRecipe(next)
  }
}

export { recipe as currentRecipe }
