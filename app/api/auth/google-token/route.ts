import { NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';

export async function GET() {
  try {
    const auth = new GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        // 確保 Vercel 環境變數裡的換行符號能被正確解析
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'), 
      },
      scopes: ['https://www.googleapis.com/auth/drive.file'], // 只允許存取我們自己上傳的檔案
    });

    const client = await auth.getClient();
    const token = await client.getAccessToken();

    return NextResponse.json({ access_token: token.token });
  } catch (error) {
    console.error('獲取 Google Token 失敗:', error);
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
  }
}
