import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const params = new URLSearchParams();
    params.append('client_id', process.env.GOOGLE_CLIENT_ID!);
    params.append('client_secret', process.env.GOOGLE_CLIENT_SECRET!);
    params.append('refresh_token', process.env.GOOGLE_REFRESH_TOKEN!);
    params.append('grant_type', 'refresh_token');

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: params,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const data = await res.json();
    return NextResponse.json({ access_token: data.access_token });
  } catch (error) {
    return NextResponse.json({ error: '無法取得 Token' }, { status: 500 });
  }
}
