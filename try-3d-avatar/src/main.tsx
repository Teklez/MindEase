import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// StrictMode disabled: TalkingHead owns the DOM node imperatively
// and doesn't survive React's double-mount in dev mode.
createRoot(document.getElementById('root')!).render(<App />)
