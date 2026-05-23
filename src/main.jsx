import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { CommaProvider } from './contexts/CommaContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CommaProvider>
      <App />
    </CommaProvider>
  </StrictMode>,
)
