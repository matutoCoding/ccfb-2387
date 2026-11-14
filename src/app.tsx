import type { RouteDefinition } from '@solidjs/router'
import { NavLink, useLocation } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { RecipeProvider } from './core/store'
import LibraryPage from './pages/library_page'
import EditorPage from './pages/editor_page'
import PreviewPage from './pages/preview_page'
import BakePage from './pages/bake_page'
import './styles/app.css'

const NAV_ITEMS = [
  { path: '/', label: '配方库', icon: 'M4 6h16M4 12h16M4 18h10' },
  { path: '/editor', label: '节点编排', icon: 'M6 3v8m0 0l-3-3m3 3l3-3M18 21v-8m0 0l3 3m-3-3l-3 3M12 3v18' },
  { path: '/preview', label: '实物预览', icon: 'M12 4l8 4v8l-8 4-8-4V8l8-4z' },
  { path: '/bake', label: '烘焙', icon: 'M4 4h16v16H4zM4 12h16M12 4v16' },
]

export default function App(props: { children?: JSX.Element }) {
  const location = useLocation()
  const currentTitle = () => NAV_ITEMS.find((n) => n.path === location.pathname)?.label ?? '配方台'

  return (
    <RecipeProvider>
      <div class="app-shell">
        <aside class="sidebar">
          <div class="brand">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7">
              <path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.6 7.1 18.2 8 12.7 4 8.8 9.5 8 12 3z" />
            </svg>
            <span>旧铜涂装台</span>
          </div>
          <nav class="nav-list">
            {NAV_ITEMS.map((item) => (
              <NavLink
                href={item.path}
                class="nav-item"
                activeClass="active"
                end={item.path === '/'}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                  <path d={item.icon} />
                </svg>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <div class="sidebar-foot">
            <span class="muted">种子驱动 · 确定性重建</span>
          </div>
        </aside>
        <main class="main-area">
          <header class="topbar">
            <h1>{currentTitle()}</h1>
          </header>
          <div class="page-body">{props.children}</div>
        </main>
      </div>
    </RecipeProvider>
  )
}

App.routes = [
  { path: '/', component: LibraryPage },
  { path: '/editor', component: EditorPage },
  { path: '/preview', component: PreviewPage },
  { path: '/bake', component: BakePage },
] satisfies RouteDefinition[]
