// 匯入 React 嚴格模式協助偵測潛在問題
import { StrictMode } from 'react'
// 匯入 React 18 root 建立函式
import { createRoot } from 'react-dom/client'
// 全域樣式初始化
import './index.css'
// 匯入主應用程式元件
import App from './App.jsx'

// 於 root 節點掛載應用程式並套用 StrictMode
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
