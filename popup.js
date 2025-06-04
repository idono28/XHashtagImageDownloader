// 多言語対応の初期化
function initializeI18n() {
    // data-i18n属性を持つ要素のテキストを更新
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const messageKey = element.getAttribute('data-i18n');
        const message = chrome.i18n.getMessage(messageKey);
        if (message) {
            element.textContent = message;
        }
    });
    
    // data-i18n-placeholder属性を持つ要素のプレースホルダーを更新
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const messageKey = element.getAttribute('data-i18n-placeholder');
        const message = chrome.i18n.getMessage(messageKey);
        if (message) {
            element.placeholder = message;
        }
    });
}

// ページ読み込み時に多言語対応を初期化
document.addEventListener('DOMContentLoaded', function() {
    initializeI18n();
    document.getElementById('downloadBtn').disabled = true;
    
    // 現在の時間を取得して表示
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ja-JP');
    document.getElementById('statusText').innerHTML = 
        `<div class="status-line">[${timeStr}] ${chrome.i18n.getMessage('pressSearchButton')}</div>`;
});

// 日付と時間の初期設定
const today = new Date().toISOString().split('T')[0];
document.getElementById('endDate').value = today;
document.getElementById('endHour').value = '23';
document.getElementById('endMinute').value = '59';
document.getElementById('endSecond').value = '59';

const weekAgo = new Date();
weekAgo.setDate(weekAgo.getDate() - 7);
document.getElementById('startDate').value = weekAgo.toISOString().split('T')[0];
document.getElementById('startHour').value = '00';
document.getElementById('startMinute').value = '00';
document.getElementById('startSecond').value = '00';

// 時間入力欄のバリデーション用関数
function validateTimeInput(input, min, max) {
    // 空欄ならデフォルト値を設定
    if (input.value === '') {
        input.value = input.id.includes('Hour') ? '00' : 
                      (input.id.includes('End') ? '59' : '00');
        return;
    }
    
    // 数値以外の入力を削除
    let value = input.value.replace(/[^0-9]/g, '');
    
    // 数値を範囲内に収める
    value = Math.max(min, Math.min(max, parseInt(value) || 0));
    
    // 2桁でパディング
    input.value = String(value).padStart(2, '0');
}

// 時間入力欄のイベントリスナーを設定
document.querySelectorAll('.time-input').forEach(input => {
    // フォーカスが外れたとき
    input.addEventListener('blur', function() {
        const isHour = this.id.includes('Hour');
        const isMinuteOrSecond = this.id.includes('Minute') || this.id.includes('Second');
        validateTimeInput(this, 0, isHour ? 23 : 59);
    });
    
    // 入力中の処理
    input.addEventListener('input', function() {
        // 2文字以上なら自動的に次のフィールドにフォーカス
        if (this.value.length >= 2) {
            const next = this.nextElementSibling?.nextElementSibling;
            if (next && next.classList.contains('time-input')) {
                next.focus();
                next.select();
            }
        }
    });
});

// 検索ボタンの処理
document.getElementById('searchBtn').addEventListener('click', () => {
    const hashtag = document.getElementById('hashtagInput').value.trim();
    if (!hashtag) {
        alert(chrome.i18n.getMessage('enterHashtagAlert'));
        return;
    }

    const startDate = document.getElementById('startDate').value;
    const startHour = document.getElementById('startHour').value.padStart(2, '0');
    const startMinute = document.getElementById('startMinute').value.padStart(2, '0');
    const startSecond = document.getElementById('startSecond').value.padStart(2, '0');
    
    const endDate = document.getElementById('endDate').value;
    const endHour = document.getElementById('endHour').value.padStart(2, '0');
    const endMinute = document.getElementById('endMinute').value.padStart(2, '0');
    const endSecond = document.getElementById('endSecond').value.padStart(2, '0');
    
    if (!startDate || !endDate) {
        alert(chrome.i18n.getMessage('enterDateAlert'));
        return;
    }

    // ダウンロードボタンの状態をリセット
    const downloadBtn = document.getElementById('downloadBtn');
    downloadBtn.disabled = true;
    
    // ステータスメッセージを初期化
    const statusText = document.getElementById('statusText');
    statusText.innerHTML = '';
    
    // 現在の時間を取得して表示
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ja-JP');
    statusText.innerHTML += `<div class="status-line">[${timeStr}] ${chrome.i18n.getMessage('searching')}</div>`;

    // 開始日時と終了日時をDateオブジェクトとして生成（JST）
    const startDateObj = new Date(startDate);
    startDateObj.setHours(parseInt(startHour), parseInt(startMinute), parseInt(startSecond));
    
    const endDateObj = new Date(endDate);
    endDateObj.setHours(parseInt(endHour), parseInt(endMinute), parseInt(endSecond));
    
    // 日付と時間を整形（JST形式）
    const formatJSTDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        const second = String(date.getSeconds()).padStart(2, '0');
        
        return `${year}-${month}-${day}_${hour}:${minute}:${second}_JST`;
    };
    
    // JST形式での日時文字列
    let startDateFormatted = formatJSTDate(startDateObj);
    
    // 終了時間が23:59:59の場合は次の日の00:00:00として扱う
    let endDateFormatted;
    if (endHour === '23' && endMinute === '59' && endSecond === '59') {
        const nextDay = new Date(endDateObj);
        nextDay.setDate(nextDay.getDate() + 1);
        nextDay.setHours(0, 0, 0);
        endDateFormatted = formatJSTDate(nextDay);
    } else {
        endDateFormatted = formatJSTDate(endDateObj);
    }
    
    // URLエンコード
    const encodedStartDate = encodeURIComponent(startDateFormatted);
    const encodedEndDate = encodeURIComponent(endDateFormatted);
    
    // 検索用URLの生成
    const searchUrl = `https://twitter.com/search?q=%23${hashtag}%20since%3A${encodedStartDate}%20until%3A${encodedEndDate}&src=typed_query&f=live`;
    
    // 検索パラメータのログ表示（デバッグ用）
    console.log(`検索: ${decodeURIComponent(searchUrl)}`);
    console.log(`JST 開始日時: ${startDateObj.toLocaleString('ja-JP')}`);
    console.log(`JST 終了日時: ${endDateObj.toLocaleString('ja-JP')}`);
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.update(tabs[0].id, {url: searchUrl});
        
        // ページが読み込まれるのを待ってからダウンロードボタンを有効化
        chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo, tab) {
            if (tabId === tabs[0].id && changeInfo.status === 'complete' && tab.url.includes("/search?q=%23")) {
                // リスナーを削除して重複を避ける
                chrome.tabs.onUpdated.removeListener(listener);
                
                // 1秒待ってから有効化（コンテンツが読み込まれるのを待つ）
                setTimeout(() => {
                    downloadBtn.disabled = false;
                    
                    // 現在の時間を取得して表示
                    const completedTime = new Date();
                    const completedTimeStr = completedTime.toLocaleTimeString('ja-JP');
                    statusText.innerHTML += `<div class="status-line">[${completedTimeStr}] ${chrome.i18n.getMessage('searchComplete')}</div>`;
                    
                    // 自動スクロール（最新メッセージを表示）
                    statusText.scrollTop = statusText.scrollHeight;
                }, 1000);
            }
        });
    });
});

// ダウンロードボタンの処理を修正
document.getElementById('downloadBtn').addEventListener('click', async () => {
    const downloadBtn = document.getElementById('downloadBtn');
    const statusText = document.getElementById('statusText');
    
    downloadBtn.disabled = true;
    statusText.textContent = chrome.i18n.getMessage('preparing');
    
    // content scriptにダウンロード開始を通知
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs || !tabs[0] || !tabs[0].id) {
            statusText.textContent = chrome.i18n.getMessage('tabNotFoundError');
            downloadBtn.disabled = false;
            return;
        }
        
        // content scriptが確実に読み込まれるように実行
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            function: () => {
                // すでにロード済みのページでスクリプトを実行することを確認
                return document.readyState;
            }
        }, (results) => {
            if (chrome.runtime.lastError) {
                statusText.textContent = "エラー: " + chrome.runtime.lastError.message;
                downloadBtn.disabled = false;
                return;
            }
            
            // メッセージを送信
            chrome.tabs.sendMessage(tabs[0].id, { action: 'downloadImages' }, (response) => {
                if (chrome.runtime.lastError) {
                    // エラーがあれば再度content scriptを注入して実行
                    chrome.scripting.executeScript({
                        target: { tabId: tabs[0].id },
                        files: ['content.js']
                    }, () => {
                        // スクリプト注入後に再度メッセージを送信
                        setTimeout(() => {
                            chrome.tabs.sendMessage(tabs[0].id, { action: 'downloadImages' });
                        }, 500);
                    });
                }
            });
        });
    });
});

// ステータス更新用のメッセージリスナーを追加
chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type === 'updateStatus') {
        const statusText = document.getElementById('statusText');
        
        // ステータスメッセージが空でなければスクロール表示
        if (message.message) {
            // 現在の時間を取得して表示
            const now = new Date();
            const timeStr = now.toLocaleTimeString('ja-JP');
            
            // 新しいメッセージを追加（時間付き）
            statusText.innerHTML += `<div class="status-line">[${timeStr}] ${message.message}</div>`;
            
            // 自動スクロール（最新メッセージを表示）
            statusText.scrollTop = statusText.scrollHeight;
        } else {
            statusText.innerHTML = '';
        }
        
        // ダウンロード完了またはエラー時にボタンを再度有効化
        if (message.message.includes('枚の画像をダウンロードしました') || 
            message.message.includes('画像をZIPファイル') ||
            message.message.includes('見つかりませんでした') ||
            message.message.includes('エラーが発生しました') ||
            message.message.includes('images') ||
            message.message.includes('found') ||
            message.message.includes('error')) {
            document.getElementById('downloadBtn').disabled = false;
        }
    }
});

// URLに基づいてダウンロードボタンの状態を設定
chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs || !tabs[0] || !tabs[0].url) return;
    
    const url = tabs[0].url;
    if (url.includes("/search?q=%23")) {
        document.getElementById('downloadBtn').disabled = false;
        
        // 現在の時間を取得して表示
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ja-JP');
        document.getElementById('statusText').innerHTML = 
            `<div class="status-line">[${timeStr}] ${chrome.i18n.getMessage('downloadButtonEnabled')}</div>`;
        
        // URLからハッシュタグと日付を抽出
        try {
            const urlParams = new URLSearchParams(new URL(url).search);
            const query = urlParams.get('q');
            
            const hashtagMatch = query.match(/#([^#\s]+)/);
            if (hashtagMatch) {
                document.getElementById('hashtagInput').value = hashtagMatch[1];
            }

            // 日付と時間の正規表現を改善
            const sinceMatch = query.match(/since:(\d{4}-\d{2}-\d{2})_(\d{2}):(\d{2}):(\d{2})_JST/);
            const untilMatch = query.match(/until:(\d{4}-\d{2}-\d{2})_(\d{2}):(\d{2}):(\d{2})_JST/);
            
            if (sinceMatch) {
                const year = parseInt(sinceMatch[1].split('-')[0]);
                const month = parseInt(sinceMatch[1].split('-')[1]) - 1; // JavaScriptの月は0始まり
                const day = parseInt(sinceMatch[1].split('-')[2]);
                const hour = parseInt(sinceMatch[2]);
                const minute = parseInt(sinceMatch[3]);
                const second = parseInt(sinceMatch[4]);
                
                const sinceDate = new Date(year, month, day, hour, minute, second);
                
                document.getElementById('startDate').value = sinceDate.toISOString().split('T')[0];
                document.getElementById('startHour').value = String(sinceDate.getHours()).padStart(2, '0');
                document.getElementById('startMinute').value = String(sinceDate.getMinutes()).padStart(2, '0');
                document.getElementById('startSecond').value = String(sinceDate.getSeconds()).padStart(2, '0');
            }
            
            if (untilMatch) {
                const year = parseInt(untilMatch[1].split('-')[0]);
                const month = parseInt(untilMatch[1].split('-')[1]) - 1; // JavaScriptの月は0始まり
                const day = parseInt(untilMatch[1].split('-')[2]);
                const hour = parseInt(untilMatch[2]);
                const minute = parseInt(untilMatch[3]);
                const second = parseInt(untilMatch[4]);
                
                const untilDate = new Date(year, month, day, hour, minute, second);
                
                // until日時が00:00:00の場合、前日の23:59:59に変換
                if (hour === 0 && minute === 0 && second === 0) {
                    untilDate.setDate(untilDate.getDate() - 1);
                    untilDate.setHours(23, 59, 59);
                }
                
                document.getElementById('endDate').value = untilDate.toISOString().split('T')[0];
                document.getElementById('endHour').value = String(untilDate.getHours()).padStart(2, '0');
                document.getElementById('endMinute').value = String(untilDate.getMinutes()).padStart(2, '0');
                document.getElementById('endSecond').value = String(untilDate.getSeconds()).padStart(2, '0');
            }
        } catch (e) {
            console.error(chrome.i18n.getMessage('urlParseError'), e);
        }
    } else {
        document.getElementById('downloadBtn').disabled = true;
        
        // 現在の時間を取得して表示
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ja-JP');
        document.getElementById('statusText').innerHTML = 
            `<div class="status-line">[${timeStr}] ${chrome.i18n.getMessage('pressSearchButton')}</div>`;
    }
}); 
