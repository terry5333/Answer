import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// 無敵金鑰解析器：處理各種 Vercel 環境變數貼錯的情況
const formatPrivateKey = (key: string | undefined) => {
  if (!key) return undefined;
  return key
    .replace(/\\n/g, '\n') // 替換被跳脫的換行符號
    .replace(/^"|"$/g, '') // 移除頭尾不小心貼上的雙引號
    .split(String.raw`\n`).join('\n'); // 處理更深層的跳脫字元
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const subject = formData.get('subject') as string;
    const title = formData.get('title') as string;

    if (!file || !subject || !title) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    // 取得並清洗私鑰
    const formattedPrivateKey = formatPrivateKey(process.env.GOOGLE_PRIVATE_KEY);

    if (!formattedPrivateKey || !formattedPrivateKey.includes('BEGIN PRIVATE KEY')) {
      console.error("私鑰格式嚴重錯誤，請檢查 Vercel 設定！");
      return NextResponse.json({ error: '伺服器金鑰設定錯誤' }, { status: 500 });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: formattedPrivateKey,
      },
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    const driveResponse = await drive.files.create({
      requestBody: {
        name: file.name,
        parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!],
      },
      media: {
        mimeType: file.type,
        body: stream,
      },
      fields: 'id',
    });

    const driveFileId = driveResponse.data.id;

    await addDoc(collection(db, "solutions"), {
      subject,
      title,
      drive_file_id: driveFileId,
      view_count: 0,
      created_at: serverTimestamp()
    });

    return NextResponse.json({ success: true, fileId: driveFileId });

  } catch (error: any) {
    console.error('上傳處理發生錯誤:', error);
    return NextResponse.json({ error: error.message || '內部伺服器錯誤' }, { status: 500 });
  }
}
