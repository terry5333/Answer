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

    if (!file || !subject || !title) return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    // --- 改用 OAuth2 身份驗證 ---
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      "https://developers.google.com/oauthplayground"
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

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

    await addDoc(collection(db, "solutions"), {
      subject, title, drive_file_id: driveResponse.data.id, view_count: 0, created_at: serverTimestamp()
    });

    return NextResponse.json({ success: true, fileId: driveResponse.data.id });

  } catch (error: any) {
    console.error('上傳處理發生錯誤:', error);
    return NextResponse.json({ error: error.message || '內部伺服器錯誤' }, { status: 500 });
  }
}
