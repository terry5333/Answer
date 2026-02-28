// 在檔案最上方加入這行：
import { getStorage } from "firebase/storage";

// 在檔案最下方加入這行匯出：
export const storage = getStorage(app);
