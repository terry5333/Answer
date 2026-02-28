import { NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';

export async function GET() {
  try {
    // 檢查有沒有抓到環境變數
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      return NextResponse.json({ error: '伺服器缺少 Google 憑證' }, { status: 500 });
    }

    const auth = new GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        // 🚀 關鍵：Vercel 常常會把金鑰的換行符號吃掉，這裡幫你強制轉換回來
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const client = await auth.getClient();
    const token = await client.getAccessToken();

    return NextResponse.json({ access_token: token.token });
  } catch (error: any) {
    console.error('獲取 Google Token 失敗:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
