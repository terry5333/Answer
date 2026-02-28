import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // 🚀 核心修正：確保網址完整且有成對的引號
    const GAS_URL = "https://script.google.com/macros/s/AKfycbygibovMu_M60vb67idUpFTibjBGSQknsm6XOyx-_wY7WXZGfDMeKuopLjfdysVEAuS/exec";

    const response = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('上傳 API 發生錯誤:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
