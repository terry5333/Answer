import { NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';

// 🚀 就是這行！終極解藥：強制每次呼叫都重新執行，拒絕使用過期的快取 Token！
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      return NextResponse.json({ error: '伺服器缺少 Google 憑證' }, { status: 500 });
    }

    const auth = new GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
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
