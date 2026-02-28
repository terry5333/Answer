import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // ⚠️ 請換成你部署好的 GAS 網址
    const GAS_URL = "://script.google.com/macros/s/AKfycbygibovMu_M60vb67idUpFTibjBGSQknsm6XOyx-_wY7WXZGfDMeKuopLjfdysVEAuS/exec;

    const response = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
