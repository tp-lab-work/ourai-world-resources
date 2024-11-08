const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

// 認証設定
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.SERVICE_ACCOUNT_JSON_PATH,
  scopes: ["https://www.googleapis.com/auth/drive.readonly"],
});

const drive = google.drive({ version: "v3", auth });

async function downloadFileByQuery() {
  // クエリを使用してファイルを検索
  const res = await drive.files.list({
    q: process.env.QUERY,
    fields: "files(id, name)",
  });

  if (res.data.files.length === 0) {
    console.log("No files found.");
    return;
  }

  // 保存先のパスをリポジトリのルートからの相対パスで生成
  const destDir = path.join(
    process.env.GITHUB_WORKSPACE,
    process.env.DESTINATION
  );

  // 並列でダウンロードを行う
  const downloadPromises = res.data.files.map((file) => {
    return new Promise(async (resolve, reject) => {
      console.log(`Found file: ${file.name} (${file.id})`);

      const destPath = `${destDir}/${file.name}`;
      const dest = fs.createWriteStream(destPath);

      try {
        const response = await drive.files.get(
          {
            fileId: file.id,
            alt: "media",
          },
          { responseType: "stream" }
        );

        response.data
          .on("end", () => {
            console.log(`Downloaded file to ${destPath}`);
            resolve();
          })
          .on("error", (err) => {
            console.error("Error downloading file:", err);
            reject(err);
          })
          .pipe(dest);
      } catch (error) {
        reject(error);
      }
    });
  });

  // すべてのダウンロードが完了するまで待機
  try {
    await Promise.all(downloadPromises);
    console.log("All downloads completed.");
  } catch (error) {
    console.error("Error in downloading files:", error);
  }
}

downloadFileByQuery();
