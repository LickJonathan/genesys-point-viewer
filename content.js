// ポイントデータを格納
let pointData = {};

// 1. JSONデータを読み込む
async function loadPoints() {
  try {
    const url = chrome.runtime.getURL('points.json');
    const response = await fetch(url);
    pointData = await response.json();

    // 公式サイトのローディングが終わるまで待機
    await waitForLoading();

    runScript();
  } catch (e) {
    console.error("ポイントデータの読み込みに失敗しました:", e);
  }
}

// 公式サイトのローディング待機
function waitForLoading() {
  return new Promise((resolve) => {
    const checkLoading = () => {
      // db.yugioh-card.com のローディング表示（通常は id="loading" や overlay クラス）
      const loading = document.getElementById('loading') || document.querySelector('.overlay');
      if (!loading || loading.style.display === 'none' || loading.classList.contains('hidden')) {
        resolve();
      } else {
        setTimeout(checkLoading, 100);
      }
    };
    checkLoading();
  });
}

// 2. 実行ロジック
function runScript() {
  let isProcessing = false;
  let debounceTimer = null;

  const observerCallback = () => {
    if (isProcessing) return;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      isProcessing = true;
      // 処理中に自身が発生させる変更を無視するために一時的に切断
      observer.disconnect();

      processPage();

      // 処理後に再接続
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      isProcessing = false;
    }, 300); // 300ms デバウンス
  };

  const observer = new MutationObserver(observerCallback);

  processPage();

  // document.body全体を監視
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// 3. ページ内のカード名を探してバッジを付ける & ポイントを合計する
function processPage() {
  // バッジ付与処理のセレクタ（最も内側のカード名要素に限定）
  const badgeSelectors = [
    'span.card_name',    // カード詳細表示のカード名
    'td.card_name span'  // テキスト表示のカード名 (td.card_name内のspan)
  ];

  // ------------------------------------
  // I. バッジ付与処理
  // ------------------------------------
  // テキスト表示のカード名td.card_name直下のspanを確実に含むため、セレクタを調整
  const badgeElements = document.querySelectorAll(badgeSelectors.join(', '));

  badgeElements.forEach(element => {
    // 処理済みチェック
    if (element.dataset.genesysProcessed === 'true' || element.querySelector('.genesys-badge')) {
      return; // バッジ付与は一度きり
    }

    const cardName = element.textContent.trim();
    if (!cardName) return;

    if (pointData.hasOwnProperty(cardName)) {
      // 2. バッジ付与
      addBadge(element, pointData[cardName]);

      // 3. 処理済みフラグをセット
      element.dataset.genesysProcessed = 'true';
    }
  });

  // ------------------------------------
  // II. ポイント合計処理 (枚数に基づいて計算)
  // ------------------------------------
  let totalPoints = 0;
  // すべてのカードエントリの親要素 (.t_row: 詳細表示, tr.row: テキスト表示) を取得
  const cardEntries = document.querySelectorAll('.t_row, tr.row');

  cardEntries.forEach(entry => {
    // 1. カード名と枚数情報を取得

    let nameElement = entry.querySelector('td.card_name span');
    let countElement = entry.querySelector('td.num span');

    // テキスト表示の要素が見つからない場合、
    if (!nameElement || !countElement) {
      nameElement = entry.querySelector('span.card_name');
      countElement = entry.querySelector('.cards_num_set span');
    }

    if (!nameElement || !countElement) {
      return; // カード名または枚数情報がない場合はスキップ
    }

    const cardName = nameElement.textContent.trim();
    const cardCountText = countElement.textContent.trim();
    // バッジのテキストが残っている可能性があるため除去
    let cleanCardName = cardName.replace(/\s*\d+pt\s*$/, '').trim();

    const count = parseInt(cardCountText);

    if (isNaN(count) || count <= 0) {
      return; // 枚数が無効な場合はスキップ
    }

    // 2. ポイントデータを参照し、ポイント * 枚数を加算
    if (pointData.hasOwnProperty(cleanCardName)) {
      const point = pointData[cleanCardName];
      totalPoints += point * count;
    }
  });


  // ------------------------------------
  // III. 合計ポイント表示
  // ------------------------------------
  displayTotalPoints(totalPoints);
}

// 4. バッジの追加処理 (変更なし)
function addBadge(targetElement, point) {
  const badge = document.createElement('span');
  badge.className = 'genesys-badge';
  badge.innerText = `${point}pt`;
  badge.dataset.point = point;
  targetElement.appendChild(badge);
}

// 5. 合計ポイントの表示処理 (変更なし)
function displayTotalPoints(totalPoints) {
  const totalDiv = document.getElementById('num_total');
  if (!totalDiv) return;

  // 既にポイント合計が表示されていないかチェック
  let existingTotal = document.getElementById('num_total_pt');
  if (existingTotal) {
    // 既に表示があれば値を更新して終了
    existingTotal.querySelector('span').textContent = totalPoints;
    return;
  }

  // 新しい表示要素を作成し、一番右側に追加
  const totalElement = document.createElement('a');
  totalElement.id = 'num_total_pt';
  totalElement.className = 'navbtn hex btn';

  totalElement.innerHTML = `
        <h4>ポイント合計</h4>
        <span>${totalPoints}</span>
    `;

  totalDiv.appendChild(totalElement);
}

// 開始
loadPoints();