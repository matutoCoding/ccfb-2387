import type { Recipe, RecipeVersion } from './types'

const DB_NAME = 'copper-workbench'
const DB_VERSION = 1
const STORE_RECIPES = 'recipes'
const STORE_VERSIONS = 'versions'
const META_KEY = 'currentRecipeId'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_RECIPES)) db.createObjectStore(STORE_RECIPES, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(STORE_VERSIONS)) db.createObjectStore(STORE_VERSIONS, { keyPath: 'id' })
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = fn(db.transaction(store, mode).objectStore(store))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      }),
  )
}

export const storage = {
  async listRecipes(): Promise<Recipe[]> {
    const all = await tx(STORE_RECIPES, 'readonly', (s) => s.getAll() as IDBRequest<Recipe[]>)
    return all.sort((a, b) => b.updatedAt - a.updatedAt)
  },

  async saveRecipe(recipe: Recipe): Promise<void> {
    await tx(STORE_RECIPES, 'readwrite', (s) => s.put(recipe))
    await tx('meta', 'readwrite', (s) => s.put(recipe.id, META_KEY))
  },

  async deleteRecipe(id: string): Promise<void> {
    await tx(STORE_RECIPES, 'readwrite', (s) => s.delete(id))
  },

  async currentRecipeId(): Promise<string | undefined> {
    return tx('meta', 'readonly', (s) => s.get(META_KEY) as IDBRequest<string | undefined>)
  },

  async listVersions(recipeId: string): Promise<RecipeVersion[]> {
    const all = await tx(STORE_VERSIONS, 'readonly', (s) => s.getAll() as IDBRequest<RecipeVersion[]>)
    return all.filter((v) => v.recipeId === recipeId).sort((a, b) => b.createdAt - a.createdAt)
  },

  async saveVersion(version: RecipeVersion): Promise<void> {
    await tx(STORE_VERSIONS, 'readwrite', (s) => s.put(version))
  },

  async deleteVersion(id: string): Promise<void> {
    await tx(STORE_VERSIONS, 'readwrite', (s) => s.delete(id))
  },
}
