import './index.css'

import App from './App'
import { AuthProvider } from './contexts/auth-context'
import { BrowserRouter } from 'react-router-dom'
import { ConfirmProvider } from './components/Confirm'
import { StrictMode } from 'react'
import { Toaster } from 'sonner'
import { createRoot } from 'react-dom/client'
import { initTheme } from './lib/theme'

initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ConfirmProvider>
          <Toaster />
          <App />
        </ConfirmProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
