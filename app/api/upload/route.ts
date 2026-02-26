// 🚀 老師端：直接對 Google Drive 上傳的邏輯 (不經 Vercel)
  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUploading(true);
    
    const formData = new FormData(e.currentTarget);
    const file = formData.get('file') as File;
    const subject = formData.get('subject') as string;
    const title = formData.get('title') as string;

    try {
      // 1. 取得 Google API 的 Access Token (這部分需要 OAuth2 流程取得)
      // 這裡假設你已經有 GOOGLE_REFRESH_TOKEN，我們改呼叫一個只拿 Token 的輕量 API
      const tokenRes = await fetch('/api/auth/google-token');
      const { access_token } = await tokenRes.json();

      // 2. 直接使用瀏覽器的 fetch 把檔案丟向 Google API (這能繞過 Vercel 限制)
      const metadata = {
        name: file.name,
        parents: [process.env.NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID],
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', file);

      const driveRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST',
        headers: { Authorization: `Bearer ${access_token}` },
        body: form,
      });

      const driveData = await driveRes.json();
      const driveFileId = driveData.id;

      // 3. 寫回 Firestore
      await addDoc(collection(db, "solutions"), {
        subject,
        title,
        drive_file_id: driveFileId,
        view_count: 0,
        created_at: new Date()
      });

      alert("✅ 成功！大檔案也沒問題且完全免費！");
      fetchAdminData();
    } catch (error) {
      alert("❌ 上傳失敗");
    } finally {
      setIsUploading(false);
    }
  };
