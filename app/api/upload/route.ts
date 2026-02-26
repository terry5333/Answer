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

    const buffer = Buffer.from(await file.arrayBuffer());
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    // --- 🏆 終極大絕招：直接解析整包 JSON ---
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

    if (!serviceAccountJson) {
      console.error("找不到 GOOGLE_SERVICE_ACCOUNT_JSON 變數");
      return NextResponse.json({ error: '伺服器缺少 Google 憑證' }, { status: 500 });
    }

    let credentials;
    try {
      // JSON.parse 會自動把字串裡的 \n 完美轉換成真正的換行，徹底解決 OpenSSL 解析錯誤！
      credentials = JSON.parse(serviceAccountJson);
    } catch (e) {
      console.error("JSON 解析失敗，請確認 Vercel 貼上的是完整的 JSON 格式");
      return NextResponse.json({ error: '金鑰 JSON 格式損毀' }, { status: 500 });
    }

    // 將解析出來的 email 和 private_key 餵給 Google API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // 上傳檔案至指定資料夾
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

    // 將資料寫入 Firestore
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
