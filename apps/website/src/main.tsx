import { ViteReactSSG } from 'vite-react-ssg'
import { routes } from './routes'
import './index.css'

/**
 * vite-react-ssg entry. It prerenders each static route to HTML at build time and
 * hydrates on the client. `createRoot` is invoked by the framework runtime, not
 * called manually.
 */
export const createRoot = ViteReactSSG({ routes })
