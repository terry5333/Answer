import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const subject = formData.get('subject') as string;
    const title = formData.get('title') as string;

    if (!file || !subject || !title) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 });
    }

    // 1. 處理檔案轉換為 Stream (Google API 需求格式)
    const buffer = Buffer.from(await file.arrayBuffer());
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    // 2. 初始化 Google Drive API (使用 Vercel 環境變數)
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        // 處理 Vercel 傳遞私鑰時可能發生的換行符號問題
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // 3. 上傳檔案至指定資料夾
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

    // 4. 將資料與 Drive ID 寫入 Firestore 的 solutions 表
    await addDoc(collection(db, "solutions"), {
      subject,
      title,
      drive_file_id: driveFileId,
      view_count: 0,
      created_at: serverTimestamp()
    });

    return NextResponse.json({ success: true, fileId: driveFileId });

  } catch (error) {
    console.error('上傳處理發生錯誤:', error);
    return NextResponse.json({ error: '內部伺服器錯誤' }, { status: 500 });
  }
}
