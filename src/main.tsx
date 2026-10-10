import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { loadAtlas } from './data/atlas'
import { AppProvider } from './state'
import './styles.css'

const root = createRoot(document.getElementById('root')!)
root.render(<div className="loading">载入中</div>)

loadAtlas()
  .then((ix) =>
    root.render(
      <StrictMode>
        <AppProvider ix={ix}>
          <App />
        </AppProvider>
      </StrictMode>,
    ),
  )
  .catch((err) => root.render(<div className="loading">数据载入失败：{String(err)}</div>))
