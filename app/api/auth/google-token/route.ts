import { NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';

export async function GET() {
  try {
    // 💡 確保環境變數有抓到
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      throw new Error("Vercel 環境變數未設定 (Missing Credentials)");
    }

    const auth = new GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        // 🚀 最關鍵的一行：修復 Vercel 吃掉換行符號的問題
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const client = await auth.getClient();
    const token = await client.getAccessToken();

    return NextResponse.json({ access_token: token.token });
  } catch (error: any) {
    console.error('獲取 Google Token 失敗:', error);
    return NextResponse.json({ error: error.message || '內部伺服器錯誤' }, { status: 500 });
  }
}
