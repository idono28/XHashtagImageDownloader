// // ハッシュタグ入力用のUIを作成
// const container = document.createElement("div");
// container.style.position = "fixed";
// container.style.top = "10px";
// container.style.right = "10px";
// container.style.zIndex = "9999";
// container.style.backgroundColor = "white";
// container.style.padding = "10px";
// container.style.borderRadius = "5px";
// container.style.boxShadow = "0 0 10px rgba(0,0,0,0.1)";

// // 入力フィールドとボタンの作成
// const input = document.createElement("input");
// input.placeholder = "ハッシュタグを入力 (# なし)";
// input.style.marginRight = "10px";

// const searchBtn = document.createElement("button");
// searchBtn.textContent = "検索";
// searchBtn.style.padding = "5px 10px";
// searchBtn.style.marginRight = "5px";

// const downloadBtn = document.createElement("button");
// downloadBtn.textContent = "画像をダウンロード";
// downloadBtn.style.padding = "5px 10px";
// downloadBtn.disabled = true; // 初期状態は無効

// // 日付選択部分の作成
// const dateContainer = document.createElement("div");
// dateContainer.style.marginTop = "5px";

// const startDate = document.createElement("input");
// startDate.type = "date";
// startDate.style.marginRight = "5px";

// const endDate = document.createElement("input");
// endDate.type = "date";

// // 今日の日付をデフォルトに設定
// const today = new Date().toISOString().split('T')[0];
// endDate.value = today;

// // 1週間前をデフォルトに設定
// const weekAgo = new Date();
// weekAgo.setDate(weekAgo.getDate() - 7);
// startDate.value = weekAgo.toISOString().split('T')[0];

// // ステータステキストの作成
// const statusText = document.createElement("div");
// statusText.style.marginTop = "5px";
// statusText.style.fontSize = "12px";

// // 要素を組み立てる
// dateContainer.appendChild(startDate);
// dateContainer.appendChild(endDate);

// // コンテナに要素を追加
// container.appendChild(input);
// container.appendChild(searchBtn);
// container.appendChild(downloadBtn);
// container.appendChild(dateContainer);
// container.appendChild(statusText);

// // bodyに追加
// document.body.appendChild(container);

// // スクロール処理
// async function scrollToBottom() {
//     const scrollHeight = document.documentElement.scrollHeight;
//     window.scrollTo(0, scrollHeight);
//     await new Promise(resolve => setTimeout(resolve, 2000)); // 画像読み込みを待つ
// }

// // 検索結果ページの場合、URLからハッシュタグと日付を取得して入力欄にセット
// if (window.location.href.includes("/search?q=%23")) {
//     const urlParams = new URLSearchParams(window.location.search);
//     const query = urlParams.get('q');
    
//     // ハッシュタグを抽出して設定
//     const hashtagMatch = query.match(/#([^#\s]+)/);
//     if (hashtagMatch) {
//         input.value = hashtagMatch[1];
//     }

//     // 日付を抽出して設定
//     const sinceMatch = query.match(/since:(\d{4}-\d{2}-\d{2})/);
//     const untilMatch = query.match(/until:(\d{4}-\d{2}-\d{2})/);
//     if (sinceMatch) startDate.value = sinceMatch[1];
//     if (untilMatch) endDate.value = untilMatch[1];

//     downloadBtn.disabled = false;
// }

// // 検索ボタンの処理
// searchBtn.addEventListener("click", () => {
//     const hashtag = input.value.trim();
//     if (!hashtag) {
//         alert("ハッシュタグを入力してください");
//         return;
//     }

//     // 日付のバリデーション
//     if (!startDate.value || !endDate.value) {
//         alert("日付を指定してください");
//         return;
//     }

//     const since = startDate.value;
//     const until = endDate.value;
//     const searchUrl = `https://twitter.com/search?q=%23${hashtag}%20since%3A${since}%20until%3A${until}&src=typed_query&f=live`;
//     window.location.href = searchUrl;
// });

// // ダウンロードボタンの処理
// downloadBtn.addEventListener("click", async () => {
//     downloadBtn.disabled = true;
//     statusText.textContent = "画像を収集中...";

//     // スクロールして画像を読み込む（5回まで）
//     for (let i = 0; i < 5; i++) {
//         statusText.textContent = `画像を収集中... (${i + 1}/5回スクロール)`;
//         await scrollToBottom();
//     }

//     const images = new Set();
//     document.querySelectorAll('img[src*="pbs.twimg.com/media"]').forEach(img => {
//         const originalSrc = img.src.replace(/&name=\w+$/, "&name=large");
//         images.add(originalSrc);
//     });

//     if (images.size === 0) {
//         alert("画像が見つかりませんでした");
//         downloadBtn.disabled = false;
//         statusText.textContent = "";
//         return;
//     }

//     statusText.textContent = `${images.size}枚の画像をダウンロード中...`;
//     let downloadCount = 0;

//     for (const imgSrc of images) {
//         try {
//             const response = await fetch(imgSrc);
//             const blob = await response.blob();
//             const url = window.URL.createObjectURL(blob);
            
//             // 画像要素とその親要素の取得を改善
//             const imgElements = document.querySelectorAll(`img[src*="${imgSrc.split('?')[0]}"]`);
//             let username = "unknown";
//             let tweetDate = "";
            
//             // 見つかった画像要素から最適なものを探す
//             for (const img of imgElements) {
//                 const tweetContainer = img.closest('article');
//                 if (tweetContainer) {
//                     // ユーザー名を取得
//                     const usernameElement = tweetContainer.querySelector('a[href^="/"]:not([href*="/status/"])');
//                     if (usernameElement) {
//                         username = usernameElement.getAttribute('href').replace('/', '');
//                     }
                    
//                     // 投稿日時を取得
//                     const timeElement = tweetContainer.querySelector('time');
//                     if (timeElement) {
//                         const datetime = new Date(timeElement.getAttribute('datetime'));
//                         const dateStr = datetime.toISOString().split('T')[0];
//                         const timeStr = datetime.toTimeString().split(' ')[0].replace(/:/g, '');
//                         tweetDate = `${dateStr}_${timeStr}`;
//                         break; // 情報が取得できたらループを抜ける
//                     }
//                 }
//             }

//             // URLからハッシュタグを取得
//             const hashtagMatch = window.location.href.match(/%23([^%&]+)/);
//             const hashtag = hashtagMatch ? hashtagMatch[1] : "download";
            
//             // ファイル名を組み立て
//             let fileName;
//             if (tweetDate) {
//                 fileName = `${username}_${tweetDate}_${String(downloadCount+1).padStart(3, '0')}.jpg`;
//             } else {
//                 const now = new Date();
//                 const currentDate = now.toISOString().split('T')[0];
//                 const currentTime = now.toTimeString().split(' ')[0].replace(/:/g, '');
//                 fileName = `${hashtag}_${username}_${currentDate}_${currentTime}_${String(downloadCount+1).padStart(3, '0')}.jpg`;
//             }
            
//             const a = document.createElement("a");
//             a.href = url;
//             a.download = fileName;
//             a.click();
            
//             window.URL.revokeObjectURL(url);
//             downloadCount++;
//             statusText.textContent = `ダウンロード中... (${downloadCount}/${images.size})`;
//         } catch (error) {
//             console.error("画像のダウンロードに失敗しました:", error);
//             // エラーが発生しても続行
//             downloadCount++;
//             statusText.textContent = `ダウンロード中... (${downloadCount}/${images.size}) - 一部失敗`;
//         }
//     }

//     statusText.textContent = `${downloadCount}枚の画像をダウンロードしました`;
//     downloadBtn.disabled = false;
// });
