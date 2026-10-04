import '../styles/base.css'
import { startViewer } from '@/viewer'

const app = document.querySelector<HTMLDivElement>('#app')
if (app) startViewer(app)
