import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initSentry } from './utils/sentry'
import './index.css'
import App from './App.tsx'

initSentry();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
