/* @refresh reload */
import { render } from 'solid-js/web'
import { Router } from '@solidjs/router'
import App from './app'
import './styles/global.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root 挂载点缺失')

render(
  () => (
    <Router root={App}>{App.routes}</Router>
  ),
  root,
)
