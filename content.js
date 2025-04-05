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

    // ページの高さを取得する関数
    function getPageHeight() {
        return Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.offsetHeight
        );
    }
    
    // ファイル名に使用できない文字を置換
    function sanitizeFileName(name) {
        return name.replace(/[\\/:*?"<>|]/g, '_');
    }

    updateStatus("画像を収集中...");
    
    try {
        // 画像を収集するセット
        const images = new Set();
        
        // 投稿IDとその画像URLを保存するマップ
        const postImages = new Map();
        
        // 投稿を収集してマップに保存する関数
        function collectPostsAndImages() {
            // 投稿記事を取得
            const articles = document.querySelectorAll('article[data-testid="tweet"]');
            console.log(`検出された投稿記事数: ${articles.length}`);
            
            // 収集前の投稿数と画像数を記録
            const prevPostsCount = postImages.size;
            const prevImagesCount = images.size;
            
            articles.forEach((article, index) => {
                // 投稿IDを取得
                const tweetLinks = article.querySelectorAll('a[href*="/status/"]');
                let tweetId = null;
                
                for (const link of tweetLinks) {
                    const href = link.getAttribute('href');
                    const match = href.match(/\/status\/(\d+)/);
                    if (match && match[1]) {
                        tweetId = match[1];
                        break;
                    }
                }
                
                if (!tweetId) {
                    console.log(`投稿ID取得失敗: インデックス ${index} の投稿`);
                    return;
                }
                
                // この投稿内の画像を取得
                const imageElements = article.querySelectorAll('img[src*="pbs.twimg.com/media"]');
                const imageUrls = new Set();
                
                imageElements.forEach(img => {
                    const originalSrc = img.src.replace(/&name=\w+$/, "&name=large");
                    imageUrls.add(originalSrc);
                    images.add(originalSrc);
                });
                
                // 既存のエントリがあれば画像を追加、なければ新規作成
                if (postImages.has(tweetId)) {
                    const existingUrls = postImages.get(tweetId);
                    imageUrls.forEach(url => existingUrls.add(url));
                } else {
                    postImages.set(tweetId, imageUrls);
                }
                
                // このタイミングでメタデータの初期取得も試みる
                if (!postMetadata.has(tweetId) && imageUrls.size > 0) {
                    try {
                        // ユーザー名（@username）を取得
                        let username = "unknown_user";
                        let displayName = "Unknown User";
                        
                        // 新しいX（Twitter）のDOM構造に対応 - 複数の方法でユーザー情報取得を試みる
                        
                        // 方法1: dir="ltr"を使用した取得（最新の構造）
                        const usernameElements = article.querySelectorAll('div[dir="ltr"] > span');
                        for (const element of usernameElements) {
                            const text = element.textContent;
                            if (text && text.startsWith('@')) {
                                username = text.substring(1); // '@'を削除
                                
                                // 表示名も取得（親要素のテキスト）
                                const parentElement = element.closest('div[dir="ltr"]').previousElementSibling;
                                if (parentElement) {
                                    displayName = parentElement.textContent.trim();
                                }
                                break;
                            }
                        }
                        
                        // 方法2: 投稿者情報が含まれる要素を探す
                        if (username === "unknown_user" || displayName === "Unknown User") {
                            const authorNameElements = article.querySelectorAll('[data-testid="User-Name"]');
                            if (authorNameElements.length > 0) {
                                // ユーザー名（@username）を取得
                                const usernameSpan = authorNameElements[0].querySelector('span:nth-child(2)');
                                if (usernameSpan) {
                                    const usernameText = usernameSpan.textContent;
                                    if (usernameText && usernameText.startsWith('@')) {
                                        username = usernameText.substring(1);
                                    }
                                }
                                
                                // 表示名を取得
                                const displayNameElement = authorNameElements[0].querySelector('span:nth-child(1)');
                                if (displayNameElement) {
                                    displayName = displayNameElement.textContent.trim();
                                }
                            }
                        }
                        
                        // 方法3: プロフィールリンクから取得
                        if (username === "unknown_user") {
                            const profileLinks = article.querySelectorAll('a[role="link"]');
                            for (const link of profileLinks) {
                                const href = link.getAttribute('href');
                                if (href && href.startsWith('/') && !href.includes('/status/')) {
                                    username = href.substring(1).split('/')[0];
                                    
                                    // 表示名も取得できるか試みる
                                    if (displayName === "Unknown User") {
                                        const nameElement = link.querySelector('div, span');
                                        if (nameElement) {
                                            displayName = nameElement.textContent.trim();
                                        }
                                    }
                                    break;
                                }
                            }
                        }
                        
                        // 方法4：さらにフォールバック - より広い範囲で検索
                        if (username === "unknown_user" || displayName === "Unknown User") {
                            const allText = article.textContent;
                            const usernameMatch = allText.match(/@([a-zA-Z0-9_]+)/);
                            if (usernameMatch && usernameMatch[1]) {
                                username = usernameMatch[1];
                            }
                        }
                        
                        // 投稿日時を取得
                        let tweetDate = "";
                        let formattedDateTime = "";
                        const timeElement = article.querySelector('time');
                        if (timeElement) {
                            const datetime = timeElement.getAttribute('datetime');
                            if (datetime) {
                                const date = new Date(datetime);
                                
                                // ISO形式の日付と時間（ファイル名用）
                                const dateStr = date.toISOString().split('T')[0];
                                const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '');
                                tweetDate = `${dateStr}_${timeStr}`;
                                
                                // 人間が読みやすい形式（CSV表示用）
                                formattedDateTime = date.toLocaleString('ja-JP', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                    hour12: false
                                });
                            }
                        }
                        
                        // 投稿テキストを取得
                        let tweetText = "";
                        try {
                            // まずdata-testid="tweetText"を試す
                            const tweetTextElements = article.querySelectorAll('[data-testid="tweetText"]');
                            if (tweetTextElements.length > 0) {
                                // テキストと絵文字を含む完全なテキストを取得
                                const textContent = [];
                                
                                // すべての子ノードを再帰的に処理する関数
                                function processTextNodes(node) {
                                    if (node.nodeType === Node.TEXT_NODE) {
                                        const text = node.textContent.trim();
                                        if (text) textContent.push(text);
                                    } else if (node.nodeType === Node.ELEMENT_NODE) {
                                        // 絵文字の場合はalt属性またはaria-labelを取得
                                        if (node.tagName === 'IMG') {
                                            const alt = node.getAttribute('alt');
                                            if (alt) textContent.push(alt);
                                        } else {
                                            // 子ノードを処理
                                            node.childNodes.forEach(child => processTextNodes(child));
                                        }
                                    }
                                }
                                
                                // tweetTextの内容を処理
                                tweetTextElements[0].childNodes.forEach(child => processTextNodes(child));
                                tweetText = textContent.join(' ').trim();
                            }
                        } catch (textError) {
                            console.error("投稿テキスト取得中にエラー:", textError);
                        }
                        
                        // デバッグ情報
                        console.log(`メタデータ収集: ID=${tweetId} ユーザーID=${username} 表示名=${displayName}`);
                        
                        // メタデータをセット
                        postMetadata.set(tweetId, { 
                            username, 
                            displayName,
                            tweetDate, 
                            formattedDateTime,
                            tweetText 
                        });
                    } catch (metadataError) {
                        console.error(`メタデータ収集中にエラー (投稿ID: ${tweetId}):`, metadataError);
                    }
                }
            });
            
            // 新たに追加された投稿と画像の数をログ出力
            const newPostsCount = postImages.size - prevPostsCount;
            const newImagesCount = images.size - prevImagesCount;
            if (newPostsCount > 0 || newImagesCount > 0) {
                console.log(`新たに追加: ${newPostsCount}件の投稿, ${newImagesCount}枚の画像`);
            }
            
            console.log(`現在の投稿数: ${postImages.size}, 画像数: ${images.size}`);
        }
        
        // 現在表示されている画像を収集する関数
        function collectCurrentImages() {
            // 投稿と画像を最初に収集
            collectPostsAndImages();
            
            // 単純にすべての画像も収集（念のため）
            document.querySelectorAll('img[src*="pbs.twimg.com/media"]').forEach(img => {
                const originalSrc = img.src.replace(/&name=\w+$/, "&name=large");
                images.add(originalSrc);
            });
        }
        
        // スクロールしながら画像を収集する関数
        async function collectImagesWhileScrolling() {
            // まず最上部にスクロール
            await scrollToPosition(0);
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // 現在表示されている画像を収集（初期投稿一覧を保存）
            collectCurrentImages();
            
            // 初期表示の投稿数を記録
            const initialPostCount = postImages.size;
            updateStatus(`${initialPostCount}件の投稿を検出しました`);
            
            // 初期表示の投稿がない場合は早期リターン
            if (initialPostCount === 0) {
                updateStatus("投稿が見つかりませんでした。ハッシュタグを確認してください。");
                return;
            }
            
            // スクロールが新しい画像を見つけなくなるまで継続する
            let previousImageCount = images.size;
            let previousPostCount = postImages.size;
            let previousHeight = getPageHeight();
            let scrollCount = 0;
            let noNewImagesCount = 0;
            let noHeightChangeCount = 0;
            const maxScrolls = 50; // 最大スクロール回数の上限をさらに増やす
            
            // 初期位置に一旦戻してから先頭投稿を確実に取得
            await scrollToPosition(0);
            await new Promise(resolve => setTimeout(resolve, 1000));
            collectCurrentImages();
            
            while (scrollCount < maxScrolls) {
                scrollCount++;
                
                // 現在のスクロール位置を取得
                const currentScrollY = window.scrollY;
                // スクロール単位をさらに小さくして、より多くの回数でスクロール
                const newScrollPosition = currentScrollY + window.innerHeight * 0.5;
                
                updateStatus(`画像を収集中... (${scrollCount}回目のスクロール、${postImages.size}件の投稿、${images.size}枚の画像を検出)`);
                await scrollToPosition(newScrollPosition);
                
                // 各スクロール位置で画像を収集
                collectCurrentImages();
                
                // 新しい画像や投稿が見つかったかチェック
                const currentImageCount = images.size;
                const currentPostCount = postImages.size;
                const currentHeight = getPageHeight();
                
                // 終了条件をチェック
                let shouldStop = false;
                
                // 1. 新しい画像または投稿が見つからない
                if (currentImageCount > previousImageCount || currentPostCount > previousPostCount) {
                    previousImageCount = currentImageCount;
                    previousPostCount = currentPostCount;
                    noNewImagesCount = 0; // リセット
                } else {
                    noNewImagesCount++;
                    if (noNewImagesCount >= 5) { // 判定回数をさらに増やす
                        updateStatus(`新しい投稿や画像が見つからないためスクロールを終了します (${scrollCount}回スクロールしました)`);
                        shouldStop = true;
                    }
                }
                
                // 2. ページの高さが変わらない（これ以上コンテンツがロードされていない）
                if (Math.abs(currentHeight - previousHeight) < 10) { // 誤差を許容
                    noHeightChangeCount++;
                    if (noHeightChangeCount >= 5) { // 判定回数をさらに増やす
                        updateStatus(`ページの高さが変化しないためスクロールを終了します (${scrollCount}回スクロールしました)`);
                        shouldStop = true;
                    }
                } else {
                    previousHeight = currentHeight;
                    noHeightChangeCount = 0; // リセット
                }
                
                // 3. ページの最下部に到達
                if (window.innerHeight + window.scrollY >= getPageHeight() - 20) { // マージンをさらに小さくする
                    updateStatus(`ページ最下部に到達したためスクロールを終了します (${scrollCount}回スクロールしました)`);
                    // 最下部に到達した場合は、少し待ってから再度画像を収集（最後の投稿を確実に取得するため）
                    await new Promise(resolve => setTimeout(resolve, 3000)); // 待機時間を増やす
                    collectCurrentImages();
                    shouldStop = true;
                }
                
                if (shouldStop) {
                    break;
                }
                
                // 少し待機して画像の読み込みを確実にする
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            if (scrollCount >= maxScrolls) {
                updateStatus(`最大スクロール回数(${maxScrolls}回)に達しました`);
            }
            
            // 最後に最下部までスクロールして、最後の投稿を確実に取得
            updateStatus("最下部まで移動して最後の投稿を確認中...");
            await scrollToPosition(getPageHeight() - window.innerHeight);
            await new Promise(resolve => setTimeout(resolve, 3000)); // 待機時間を増やす
            collectCurrentImages();
            
            // もう一度最下部をチェック（DOMが更新された可能性がある）
            await scrollToPosition(getPageHeight() - window.innerHeight);
            await new Promise(resolve => setTimeout(resolve, 2000));
            collectCurrentImages();
            
            // そして最上部に戻る
            await scrollToPosition(0);
            await new Promise(resolve => setTimeout(resolve, 1500));
            collectCurrentImages();
        }
        
        // 投稿IDをキーにしてメタデータを保存
        const postMetadata = new Map();
        
        // 投稿メタデータを再収集（新しい状態で）
        async function collectPostMetadata() {
            const articles = document.querySelectorAll('article[data-testid="tweet"]');
            
            for (const article of articles) {
                // 投稿IDを取得
                const tweetLinks = article.querySelectorAll('a[href*="/status/"]');
                let tweetId = null;
                
                for (const link of tweetLinks) {
                    const href = link.getAttribute('href');
                    const match = href.match(/\/status\/(\d+)/);
                    if (match && match[1]) {
                        tweetId = match[1];
                        break;
                    }
                }
                
                if (!tweetId) continue;
                
                // 既に処理済みの場合はスキップするが、メタデータが不完全な場合は再取得
                const existingMetadata = postMetadata.get(tweetId);
                if (existingMetadata && 
                    existingMetadata.username !== "unknown_user" && 
                    existingMetadata.displayName !== "Unknown User" && 
                    existingMetadata.formattedDateTime) {
                    continue;
                }
                
                // ユーザー名（@username）を取得
                let username = "unknown_user";
                let displayName = "Unknown User";
                
                // 新しいX（Twitter）のDOM構造に対応 - 複数の方法でユーザー情報取得を試みる
                
                // 方法1: dir="ltr"を使用した取得（最新の構造）
                const usernameElements = article.querySelectorAll('div[dir="ltr"] > span');
                for (const element of usernameElements) {
                    const text = element.textContent;
                    if (text && text.startsWith('@')) {
                        username = text.substring(1); // '@'を削除
                        
                        // 表示名も取得（親要素のテキスト）
                        const parentElement = element.closest('div[dir="ltr"]').previousElementSibling;
                        if (parentElement) {
                            displayName = parentElement.textContent.trim();
                        }
                        break;
                    }
                }
                
                // 方法2: 投稿者情報が含まれる要素を探す
                if (username === "unknown_user" || displayName === "Unknown User") {
                    const authorNameElements = article.querySelectorAll('[data-testid="User-Name"]');
                    if (authorNameElements.length > 0) {
                        // ユーザー名（@username）を取得
                        const usernameSpan = authorNameElements[0].querySelector('span:nth-child(2)');
                        if (usernameSpan) {
                            const usernameText = usernameSpan.textContent;
                            if (usernameText && usernameText.startsWith('@')) {
                                username = usernameText.substring(1);
                            }
                        }
                        
                        // 表示名を取得
                        const displayNameElement = authorNameElements[0].querySelector('span:nth-child(1)');
                        if (displayNameElement) {
                            displayName = displayNameElement.textContent.trim();
                        }
                    }
                }
                
                // 方法3: プロフィールリンクから取得
                if (username === "unknown_user") {
                    const profileLinks = article.querySelectorAll('a[role="link"]');
                    for (const link of profileLinks) {
                        const href = link.getAttribute('href');
                        if (href && href.startsWith('/') && !href.includes('/status/')) {
                            username = href.substring(1).split('/')[0];
                            
                            // 表示名も取得できるか試みる
                            if (displayName === "Unknown User") {
                                const nameElement = link.querySelector('div, span');
                                if (nameElement) {
                                    displayName = nameElement.textContent.trim();
                                }
                            }
                            break;
                        }
                    }
                }
                
                // 方法4：さらにフォールバック - より広い範囲で検索
                if (username === "unknown_user" || displayName === "Unknown User") {
                    const allText = article.textContent;
                    const usernameMatch = allText.match(/@([a-zA-Z0-9_]+)/);
                    if (usernameMatch && usernameMatch[1]) {
                        username = usernameMatch[1];
                    }
                }
                
                // 投稿日時を取得
                let tweetDate = "";
                let formattedDateTime = "";
                const timeElement = article.querySelector('time');
                if (timeElement) {
                    const datetime = timeElement.getAttribute('datetime');
                    if (datetime) {
                        const date = new Date(datetime);
                        
                        // ISO形式の日付と時間（ファイル名用）
                        const dateStr = date.toISOString().split('T')[0];
                        const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '');
                        tweetDate = `${dateStr}_${timeStr}`;
                        
                        // 人間が読みやすい形式（CSV表示用）
                        formattedDateTime = date.toLocaleString('ja-JP', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false
                        });
                    }
                }
                
                // 投稿テキストを取得
                let tweetText = "";
                
                // まずdata-testid="tweetText"を試す
                const tweetTextElements = article.querySelectorAll('[data-testid="tweetText"]');
                if (tweetTextElements.length > 0) {
                    // テキストと絵文字を含む完全なテキストを取得
                    const textContent = [];
                    
                    // すべての子ノードを再帰的に処理する関数
                    function processTextNodes(node) {
                        if (node.nodeType === Node.TEXT_NODE) {
                            const text = node.textContent.trim();
                            if (text) textContent.push(text);
                        } else if (node.nodeType === Node.ELEMENT_NODE) {
                            // 絵文字の場合はalt属性またはaria-labelを取得
                            if (node.tagName === 'IMG') {
                                const alt = node.getAttribute('alt');
                                if (alt) textContent.push(alt);
                            } else {
                                // 子ノードを処理
                                node.childNodes.forEach(child => processTextNodes(child));
                            }
                        }
                    }
                    
                    // tweetTextの内容を処理
                    tweetTextElements[0].childNodes.forEach(child => processTextNodes(child));
                    tweetText = textContent.join(' ').trim();
                }
                
                // tweetTextがない場合は別の方法で取得を試みる
                if (!tweetText) {
                    // ツイート本文と思われる要素を探す
                    const paragraphs = article.querySelectorAll('div[lang] > span');
                    if (paragraphs.length > 0) {
                        const textArray = [];
                        paragraphs.forEach(p => {
                            if (p.textContent && !p.textContent.startsWith('@')) {
                                textArray.push(p.textContent.trim());
                            }
                        });
                        tweetText = textArray.join(' ').trim();
                    }
                }
                
                // デバッグ情報
                console.log(`メタデータ収集: ID=${tweetId} ユーザーID=${username} 表示名=${displayName}`);
                
                postMetadata.set(tweetId, { 
                    username, 
                    displayName,
                    tweetDate, 
                    formattedDateTime,
                    tweetText 
                });
            }
        }
        
        // 投稿の先頭から順にスクロールしながらメタデータを収集
        async function collectAllPostMetadata() {
            // 最上部から開始
            await scrollToPosition(0);
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 最初の画面のメタデータを収集
            await collectPostMetadata();
            
            // 全投稿IDを配列にする
            const allPostIds = Array.from(postImages.keys());
            
            // 全投稿数をスクロールするために必要な回数を計算（1スクロールあたり平均3投稿と仮定）
            const estimatedScrolls = Math.ceil(allPostIds.length / 3);
            
            // スクロールしながらすべての投稿のメタデータを収集
            for (let i = 0; i < Math.min(estimatedScrolls, 30); i++) {
                const currentScrollY = window.scrollY;
                const newPosition = currentScrollY + window.innerHeight * 0.8;
                
                updateStatus(`メタデータ収集中... (${postMetadata.size}/${postImages.size}件の投稿)`);
                await scrollToPosition(newPosition);
                await collectPostMetadata();
                
                // すべての投稿のメタデータが集まったら終了
                if (postMetadata.size >= postImages.size) {
                    break;
                }
            }
            
            // 最後に最上部に戻る
            await scrollToPosition(0);
        }
        
        // スクロールしながら画像を収集
        await collectImagesWhileScrolling();

        if (images.size === 0) {
            updateStatus("画像が見つかりませんでした");
            return;
        }
        
        // メタデータを収集
        await collectAllPostMetadata();
        
        // ハッシュタグを取得
        let hashtag = "download";
        const hashtagMatch = window.location.href.match(/%23([^%&]+)/);
        if (hashtagMatch) {
            hashtag = decodeURIComponent(hashtagMatch[1]);
        }
        
        // ZIP形式でダウンロードを試みる
        try {
            // JSZipが使えるかチェック
            if (typeof JSZip !== 'undefined') {
                // ZIP保存用のフォルダを作成
                updateStatus(`${postImages.size}件の投稿から${images.size}枚の画像をZIPに圧縮中...`);
                
                // 日付を取得してZIPファイル名に使用
                const now = new Date();
                const dateStr = now.toISOString().split('T')[0];
                const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
                const zipFileName = sanitizeFileName(`${hashtag}_images_${dateStr}_${timeStr}.zip`);
                
                // ZIPインスタンスを作成
                const zip = new JSZip();
                
                // CSV作成のための情報を格納する配列
                const csvData = [
                    ['投稿日時', '表示名', 'ユーザーID', '投稿ID', '投稿内容', '画像枚数', '画像ファイル名']
                ];
                
                // 投稿ごとに画像をZIPファイルに追加
                let processedCount = 0;

                // postMetadataに基づいて処理を行う（より信頼性の高いデータを使用）
                for (const [tweetId, metadata] of postMetadata.entries()) {
                    // 画像URLがない場合はスキップ
                    if (!postImages.has(tweetId) || postImages.get(tweetId).size === 0) continue;
                    
                    const { username, displayName, tweetDate, formattedDateTime, tweetText } = metadata;
                    
                    // 画像URLのセットを配列に変換
                    const imageUrlsArray = Array.from(postImages.get(tweetId));
                    // この投稿の画像枚数
                    const imageCount = imageUrlsArray.length;
                    
                    // CSV用のファイル名リスト
                    const fileNames = [];
                    
                    let imageIndex = 0;
                    for (const imgSrc of imageUrlsArray) {
                        try {
                            const response = await fetch(imgSrc);
                            if (!response.ok) {
                                throw new Error(`画像の取得に失敗しました (HTTP ${response.status})`);
                            }
                            
                            const blob = await response.blob();
                            
                            // ファイル名を組み立て
                            let fileName;
                            if (tweetDate) {
                                fileName = sanitizeFileName(`${username}_${tweetDate}_${tweetId}_${String(imageIndex+1).padStart(2, '0')}.jpg`);
                            } else {
                                const currentDate = dateStr;
                                const currentTime = timeStr;
                                fileName = sanitizeFileName(`${username}_${currentDate}_${currentTime}_${tweetId}_${String(imageIndex+1).padStart(2, '0')}.jpg`);
                            }
                            
                            // CSVにファイル名を追加
                            fileNames.push(fileName);
                            
                            // ZIPファイルに画像を追加
                            zip.file(fileName, blob);
                            
                            processedCount++;
                            imageIndex++;
                            
                            // 進捗表示
                            if (processedCount % 5 === 0 || processedCount === images.size) {
                                updateStatus(`ZIPファイル作成中... (${processedCount}/${images.size}枚、${Array.from(postMetadata.keys()).indexOf(tweetId) + 1}/${postMetadata.size}件目の投稿)`);
                            }
                        } catch (error) {
                            console.error("画像の取得に失敗しました:", error);
                            processedCount++;
                            updateStatus(`ZIPファイル作成中... (${processedCount}/${images.size}枚) - 一部失敗`);
                        }
                    }
                    
                    // CSVデータに行を追加
                    csvData.push([
                        formattedDateTime || tweetDate?.replace(/_/g, ' ') || "-",
                        displayName || "Unknown User",
                        username,
                        tweetId,
                        tweetText || "",
                        imageCount.toString(),
                        fileNames.join(', ')
                    ]);
                }
                
                // CSVデータを文字列に変換（UTF-8 BOMあり）
                let csvContent = "\uFEFF"; // BOMを追加してExcelで開いたときに日本語が文字化けしないようにする
                csvData.forEach(row => {
                    // 各フィールドをダブルクォートで囲み、カンマで区切る
                    const quotedFields = row.map(field => `"${String(field).replace(/"/g, '""')}"`);
                    csvContent += quotedFields.join(',') + '\r\n';
                });
                
                // CSVファイルをZIPに追加
                const csvFileName = sanitizeFileName(`${hashtag}_画像一覧_${dateStr}_${timeStr}.csv`);
                zip.file(csvFileName, csvContent);
                
                // ZIPファイルを生成してダウンロード
                updateStatus("ZIPファイルを生成中...");
                const content = await zip.generateAsync({
                    type: "blob",
                    compression: "DEFLATE",
                    compressionOptions: { level: 6 }
                });
                
                // ZIPファイルをダウンロード (FileSaverを使用)
                saveAs(content, zipFileName);
                
                // 処理した投稿数を計算（実際に画像があった投稿数）
                const processedPostCount = Array.from(postImages.entries()).filter(([_, urls]) => urls.size > 0).length;

                updateStatus(`${processedCount}枚の画像と${processedPostCount}件の投稿データをZIPファイル「${zipFileName}」でダウンロードしました`);
                return;
            } else {
                throw new Error("JSZipライブラリが利用できません");
            }
        } catch (error) {
            console.error("ZIPでのダウンロードに失敗しました。個別ダウンロードに切り替えます:", error);
            updateStatus("ZIPでのダウンロードに失敗しました。個別ダウンロードに切り替えます...");
            
            // 個別ダウンロード用の処理に進む
        }
        
        // 個別ダウンロード用の処理
        let downloadCount = 0;

        // 日付を取得
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');

        // 実際の画像総数を計算
        let imagesTotal = 0;
        for (const [tweetId, imageUrls] of postImages.entries()) {
            imagesTotal += imageUrls.size;
        }

        updateStatus(`${postImages.size}件の投稿から${imagesTotal}枚の画像をダウンロード中...`);

        // CSV作成のための情報を格納する配列
        const csvData = [
            ['投稿日時', '表示名', 'ユーザーID', '投稿ID', '投稿内容', '画像枚数', '画像ファイル名']
        ];

        // postImagesに基づいて処理を行う（全ての画像を確実に処理するため）
        for (const [tweetId, imageUrls] of postImages.entries()) {
            // 画像がない場合はスキップ
            if (imageUrls.size === 0) continue;
            
            // メタデータを取得（なければデフォルト値を使用）
            const metadata = postMetadata.get(tweetId) || {
                username: "unknown_user",
                displayName: "Unknown User",
                tweetDate: "",
                formattedDateTime: "取得できませんでした",
                tweetText: "投稿内容を取得できませんでした"
            };
            
            const { username, displayName, tweetDate, formattedDateTime, tweetText } = metadata;
            
            // 画像URLのセットを配列に変換
            const imageUrlsArray = Array.from(imageUrls);
            // この投稿の画像枚数
            const imageCount = imageUrlsArray.length;
            
            // CSV用のファイル名リスト
            const fileNames = [];
            
            let imageIndex = 0;
            for (const imgSrc of imageUrlsArray) {
                try {
                    const response = await fetch(imgSrc);
                    if (!response.ok) {
                        throw new Error(`画像の取得に失敗しました (HTTP ${response.status})`);
                    }
                    
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    
                    // ファイル名を組み立て
                    let fileName;
                    if (tweetDate) {
                        fileName = sanitizeFileName(`${username}_${tweetDate}_${tweetId}_${String(imageIndex+1).padStart(2, '0')}.jpg`);
                    } else {
                        const currentDate = dateStr;
                        const currentTime = timeStr;
                        fileName = sanitizeFileName(`${username}_${currentDate}_${currentTime}_${tweetId}_${String(imageIndex+1).padStart(2, '0')}.jpg`);
                    }
                    
                    // CSVにファイル名を追加
                    fileNames.push(fileName);
                    
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = fileName;
                    a.click();
                    
                    window.URL.revokeObjectURL(url);
                    downloadCount++;
                    imageIndex++;
                    
                    // 進捗表示（5枚ごと）
                    if (downloadCount % 5 === 0 || downloadCount === imagesTotal) {
                        updateStatus(`ダウンロード中... (${downloadCount}/${imagesTotal}枚、${Array.from(postImages.keys()).indexOf(tweetId) + 1}/${postImages.size}件目の投稿)`);
                    }
                    
                    // ダウンロード間隔を空ける（ブラウザの制限回避）
                    await new Promise(resolve => setTimeout(resolve, 300));
                } catch (error) {
                    console.error("画像のダウンロードに失敗しました:", error, imgSrc);
                    downloadCount++;
                    updateStatus(`ダウンロード中... (${downloadCount}/${imagesTotal}枚) - 一部失敗`);
                }
            }
            
            // CSVデータに行を追加
            csvData.push([
                formattedDateTime || tweetDate?.replace(/_/g, ' ') || "-",
                displayName || "Unknown User",
                username,
                tweetId,
                tweetText || "",
                imageCount.toString(),
                fileNames.join(', ')
            ]);
        }
        
        // CSVデータを文字列に変換（UTF-8 BOMあり）
        try {
            let csvContent = "\uFEFF"; // BOMを追加してExcelで開いたときに日本語が文字化けしないようにする
            csvData.forEach(row => {
                // 各フィールドをダブルクォートで囲み、カンマで区切る
                const quotedFields = row.map(field => `"${String(field).replace(/"/g, '""')}"`);
                csvContent += quotedFields.join(',') + '\r\n';
            });
            
            // CSVファイルをダウンロード
            const csvFileName = sanitizeFileName(`${hashtag}_画像一覧_${dateStr}_${timeStr}.csv`);
            const csvBlob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
            const csvUrl = window.URL.createObjectURL(csvBlob);
            
            const a = document.createElement("a");
            a.href = csvUrl;
            a.download = csvFileName;
            a.click();
            
            window.URL.revokeObjectURL(csvUrl);
            
            // 処理した投稿数を計算（実際に画像があった投稿数）
            const processedPostCount = Array.from(postImages.entries()).filter(([_, urls]) => urls.size > 0).length;

            updateStatus(`${downloadCount}枚の画像を個別にダウンロードしました (全${processedPostCount}件の投稿から) CSVファイル「${csvFileName}」も保存されました`);
        } catch (error) {
            console.error("CSVファイルの作成に失敗しました:", error);
            updateStatus(`${downloadCount}枚の画像を個別にダウンロードしました (全${postImages.size}件の投稿から) ※CSVファイルの作成に失敗しました`);
        }
    } catch (error) {
        console.error("処理中にエラーが発生しました:", error);
        updateStatus(`エラーが発生しました: ${error.message}`);
    }
}

// メッセージリスナーを追加
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
console.log("メッセージを受信しました:", message);
if (message.action === 'downloadImages') {
    // 処理開始を通知
    sendResponse({ status: "started" });
    // 非同期処理を開始
    downloadImages().catch(err => {
        console.error("画像ダウンロード中にエラーが発生しました:", err);
        chrome.runtime.sendMessage({ 
            type: 'updateStatus', 
            message: "エラーが発生しました: " + err.message 
        });
    });
    // リスナーはtrueを返して非同期処理を継続
    return true;
}
});
