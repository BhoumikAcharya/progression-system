import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app/App'
import { applyTheme, readTheme } from './themes/settings'
import './themes/tokens.css'
import './app/styles.css'
applyTheme(readTheme())
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // Online use remains available when installation is unsupported.
    })
  })
}
