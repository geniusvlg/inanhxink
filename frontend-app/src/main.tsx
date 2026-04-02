import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App'

Sentry.init({
  dsn: 'https://d79dd093cfddb2b41c149fe004c50ef1@o4511122905628672.ingest.us.sentry.io/4511126165454848',
  integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
  tracesSampleRate: 1.0,
  replaysOnErrorSampleRate: 1.0,
  environment: import.meta.env.MODE,
  ignoreErrors: [
    // Injected by Zalo in-app browser (iOS WebView) — not our code
    /zaloJSV2/,
  ],
});

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

