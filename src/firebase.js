// 匯入 Firebase 初始化所需函式
import { initializeApp, getApp, getApps } from 'firebase/app';
// 匯入即時資料庫存取方法
import { getDatabase } from 'firebase/database';

// Firebase 連線設定：僅保留資料庫位址
const firebaseConfig = {
  databaseURL: 'https://misp-d56cb-default-rtdb.asia-southeast1.firebasedatabase.app/',
};

// 若尚未初始化應用則建立新實例
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// 導出資料庫供其他模組使用
export const database = getDatabase(app);

