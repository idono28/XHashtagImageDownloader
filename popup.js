// 日付の初期設定
const today = new Date().toISOString().split('T')[0];
document.getElementById('endDate').value = today;

const weekAgo = new Date();
weekAgo.setDate(weekAgo.getDate() - 7);
document.getElementById('startDate').value = weekAgo.toISOString().split('T')[0];

// 検索ボタンの処理
document.getElementById('searchBtn').addEventListener('click', () => {
    const hashtag = document.getElementById('hashtagInput').value.trim();
    if (!hashtag) {
        alert("ハッシュタグを入力してください");
        return;
    }

    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    if (!startDate || !endDate) {
        alert("日付を指定してください");
        return;
    }

    const searchUrl = `https://twitter.com/search?q=%23${hashtag}%20since%3A${startDate}%20until%3A${endDate}&src=typed_query&f=live`;
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.update(tabs[0].id, {url: searchUrl});
    });
});

// ダウンロードボタンの処理を修正
document.getElementById('downloadBtn').addEventListener('click', async () => {
    const downloadBtn = document.getElementById('downloadBtn');
    const statusText = document.getElementById('statusText');
    
    downloadBtn.disabled = true;
    
    // content scriptにダウンロード開始を通知
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'downloadImages' });
    });
});

// ステータス更新用のメッセージリスナーを追加
chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type === 'updateStatus') {
        document.getElementById('statusText').textContent = message.message;
        
        // ダウンロード完了またはエラー時にボタンを再度有効化
        if (message.message.includes('枚の画像をダウンロードしました') || 
            message.message.includes('見つかりませんでした')) {
            document.getElementById('downloadBtn').disabled = false;
        }
    }
});

// URLに基づいてダウンロードボタンの状態を設定
chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const url = tabs[0].url;
    if (url.includes("/search?q=%23")) {
        document.getElementById('downloadBtn').disabled = false;
        
        // URLからハッシュタグと日付を抽出
        const urlParams = new URLSearchParams(new URL(url).search);
        const query = urlParams.get('q');
        
        const hashtagMatch = query.match(/#([^#\s]+)/);
        if (hashtagMatch) {
            document.getElementById('hashtagInput').value = hashtagMatch[1];
        }

        const sinceMatch = query.match(/since:(\d{4}-\d{2}-\d{2})/);
        const untilMatch = query.match(/until:(\d{4}-\d{2}-\d{2})/);
        if (sinceMatch) document.getElementById('startDate').value = sinceMatch[1];
        if (untilMatch) document.getElementById('endDate').value = untilMatch[1];
    }
}); 
