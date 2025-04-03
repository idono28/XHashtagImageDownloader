async function downloadImages() {
    // ステータス表示用の関数
    function updateStatus(message) {
        chrome.runtime.sendMessage({ type: 'updateStatus', message: message });
    }

    // スクロール処理
    async function scrollToPosition(position) {
        window.scrollTo(0, position);
        await new Promise(resolve => setTimeout(resolve, 1500));
    }

    updateStatus("画像を収集中...");

    // 画像を収集するセット
    const images = new Set();
    
    // スクロールしながら画像を収集する関数
    async function collectImagesWhileScrolling() {
        // まず最上部にスクロール
        await scrollToPosition(0);
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // 現在表示されている画像を収集
        collectCurrentImages();
        
        // 画面の高さを取得
        const totalHeight = document.documentElement.scrollHeight;
        
        // 段階的にスクロールして画像を読み込む
        const scrollSteps = 10; // スクロール回数を増やす
        for (let i = 1; i <= scrollSteps; i++) {
            const scrollPosition = (i / scrollSteps) * totalHeight;
            updateStatus(`画像を収集中... (${i}/${scrollSteps}回スクロール)`);
            await scrollToPosition(scrollPosition);
            
            // 各スクロール位置で画像を収集
            collectCurrentImages();
            
            // 少し待機して画像の読み込みを確実にする
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    // 現在表示されている画像を収集する関数
    function collectCurrentImages() {
        document.querySelectorAll('img[src*="pbs.twimg.com/media"]').forEach(img => {
            const originalSrc = img.src.replace(/&name=\w+$/, "&name=large");
            images.add(originalSrc);
        });
    }
    
    // スクロールしながら画像を収集
    await collectImagesWhileScrolling();

    if (images.size === 0) {
        updateStatus("画像が見つかりませんでした");
        return;
    }

    updateStatus(`${images.size}枚の画像をダウンロード中...`);
    let downloadCount = 0;

    for (const imgSrc of images) {
        try {
            const response = await fetch(imgSrc);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            
            // 画像要素とその親要素の取得を改善
            const imgElements = document.querySelectorAll(`img[src*="${imgSrc.split('?')[0]}"]`);
            let username = "unknown";
            let tweetDate = "";
            
            // 見つかった画像要素から最適なものを探す
            for (const img of imgElements) {
                const tweetContainer = img.closest('article');
                if (tweetContainer) {
                    // ユーザー名を取得
                    const usernameElement = tweetContainer.querySelector('a[href^="/"]:not([href*="/status/"])');
                    if (usernameElement) {
                        username = usernameElement.getAttribute('href').replace('/', '');
                    }
                    
                    // 投稿日時を取得
                    const timeElement = tweetContainer.querySelector('time');
                    if (timeElement) {
                        const datetime = new Date(timeElement.getAttribute('datetime'));
                        const dateStr = datetime.toISOString().split('T')[0];
                        const timeStr = datetime.toTimeString().split(' ')[0].replace(/:/g, '');
                        tweetDate = `${dateStr}_${timeStr}`;
                        break;
                    }
                }
            }

            // ファイル名を組み立て
            let fileName;
            if (tweetDate) {
                fileName = `${username}_${tweetDate}_${String(downloadCount+1).padStart(3, '0')}.jpg`;
            } else {
                const now = new Date();
                const currentDate = now.toISOString().split('T')[0];
                const currentTime = now.toTimeString().split(' ')[0].replace(/:/g, '');
                fileName = `${username}_${currentDate}_${currentTime}_${String(downloadCount+1).padStart(3, '0')}.jpg`;
            }
            
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            a.click();
            
            window.URL.revokeObjectURL(url);
            downloadCount++;
            updateStatus(`ダウンロード中... (${downloadCount}/${images.size})`);
        } catch (error) {
            console.error("画像のダウンロードに失敗しました:", error);
            downloadCount++;
            updateStatus(`ダウンロード中... (${downloadCount}/${images.size}) - 一部失敗`);
        }
    }

    updateStatus(`${downloadCount}枚の画像をダウンロードしました`);
}

// メッセージリスナーを追加
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'downloadImages') {
        downloadImages();
    }
}); 
