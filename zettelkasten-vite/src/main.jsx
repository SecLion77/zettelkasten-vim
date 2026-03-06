// Importeer alleen de CSS — Vite bundelt Tailwind + onze globals
// app.js blijft een apart vanilla-script (te groot om te migreren)
import './index.css'

// Export de cn utility zodat toekomstige modules hem kunnen importeren
export { cn } from './lib/utils'
