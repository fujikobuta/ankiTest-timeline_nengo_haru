const eraConfig = [
    { name: "飛鳥", start: 592, end: 710, class: "asuka" },
    { name: "奈良", start: 710, end: 794, class: "nara" },
    { name: "平安", start: 794, end: 1185, class: "heian" },
    { name: "鎌倉", start: 1185, end: 1333, class: "kamakura" },
    { name: "室町", start: 1336, end: 1573, class: "muromachi" },
    { name: "安土桃山", start: 1573, end: 1603, class: "azuchi" },
    { name: "江戸", start: 1603, end: 1868, class: "edo" },
    { name: "明治以降", start: 1868, end: 2100, class: "modern" }
];

let allQuestions = [];
let phase1Questions = []; // 正引き
let phase2Questions = []; // 逆引き
let currentPhase = 1; // 1: 正引き, 2: 逆引き
let currentQuestionIndex = 0;

let selectedCentury = null;
let selectedDecade = null;
let selectedYear = null;

const timelineWrapper = document.getElementById('timeline-wrapper');
const mainDisplayArea = document.getElementById('main-display-area');
const decadeSection = document.getElementById('decade-section');
const yearSection = document.getElementById('year-section');
const decadeGrid = document.getElementById('decade-grid');
const yearGrid = document.getElementById('year-grid');
const questionText = document.getElementById('question-text');
const yearDisplay = document.getElementById('selected-year-display');
const okButton = document.getElementById('ok-button');
const passButton = document.getElementById('ng-button');
const overlay = document.getElementById('judge-overlay');
const choiceOverlay = document.getElementById('choice-overlay');
const choiceContainer = document.getElementById('choice-container');

let YEAR_HEIGHT = 0.35; 
const STORAGE_KEY = 'chronos_timeline_progress_v3';

function init() {
    loadQuestions();
    
    const availableHeight = mainDisplayArea.clientHeight;
    YEAR_HEIGHT = availableHeight / 1600;
    const blockHeight = YEAR_HEIGHT * 100;
    document.documentElement.style.setProperty('--block-height', `${blockHeight}px`);

    // 中断データ復元
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const data = JSON.parse(saved);
            if (confirm("前回の続きから再開しますか？")) {
                currentPhase = data.phase || 1;
                currentQuestionIndex = data.index || 0;
                
                if (data.phase1) {
                    phase1Questions = data.phase1
                        .filter(q => !q.isPoolOnly)
                        .map(q => ({...q, missed: q.missed || false}));
                }
                if (data.phase2) {
                    phase2Questions = data.phase2
                        .filter(q => !q.isPoolOnly)
                        .map(q => ({...q, missed: q.missed || false}));
                }
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        } catch(e) { console.error(e); }
    }

    generateTimeline();
    generateDecadeButtons();
    generateYearButtons();
    
    if (currentPhase === 1) {
        // フェーズ1なら過去のラベルを復元
        phase1Questions.forEach(q => {
            if (q.result !== null && q.result !== undefined) {
                placeLabel(parseInt(q.a), q.q, q.result, true);
            }
        });
        showQuestion();
    } else {
        startPhase2();
    }
    
    okButton.addEventListener('click', () => judge(false));
    passButton.addEventListener('click', () => judge(true)); // パス
    
    timelineWrapper.addEventListener('scroll', () => {
        mainDisplayArea.scrollTop = timelineWrapper.scrollTop;
    });

    // 逆引き用：画面外タップでメニューを閉じる
    choiceOverlay.addEventListener('click', (e) => {
        if (e.target === choiceOverlay) choiceOverlay.classList.add('hidden');
    });
}

function loadQuestions() {
    try {
        const dataText = document.getElementById('question-data').textContent;
        const cleanJson = dataText.replace(/\/\*[\s\S]*?\*\//g, '');
        allQuestions = JSON.parse(cleanJson);
        
        // フェーズ分け
        phase1Questions = allQuestions.filter(q => 
            (q.m == "年号あて" || q.m == "正引き" || q.m == "1" || !q.m) && !q.isPoolOnly
        ).map(q => ({...q, result: null, missed: false}));
        
        phase2Questions = allQuestions.filter(q => 
            (q.m == "出来事あて" || q.m == "逆引き" || q.m == "2") && !q.isPoolOnly
        ).map(q => ({...q, result: null, missed: false}));

        // 各フェーズ内をソート (優先度p -> 番号n)
        phase1Questions.sort((a, b) => (a.p - b.p) || (a.n - b.n));
        phase2Questions.sort((a, b) => (a.p - b.p) || (a.n - b.n));
        
        console.log(`Phase 1: ${phase1Questions.length}, Phase 2: ${phase2Questions.length}`);
    } catch (e) {
        console.error("Failed to load questions", e);
        questionText.textContent = "データの読み込みに失敗しました";
    }
}

function saveProgress() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        phase1: phase1Questions,
        phase2: phase2Questions,
        index: currentQuestionIndex,
        phase: currentPhase,
        date: new Date().toDateString()
    }));
}

function generateTimeline() {
    timelineWrapper.innerHTML = '';
    mainDisplayArea.innerHTML = '<div id="label-container" style="position:relative; width:100%;"></div>';
    const labelContainer = document.getElementById('label-container');
    labelContainer.style.height = `${(2100 - 500) * YEAR_HEIGHT}px`;
    
    for (let c = 500; c <= 2000; c += 100) {
        const block = document.createElement('div');
        block.className = 'century-block';
        block.dataset.century = c;
        const era = eraConfig.find(e => c >= Math.floor(e.start / 100) * 100 && c <= e.end);
        if (era) {
            const label = document.createElement('div');
            label.className = 'era-label';
            label.textContent = era.name;
            block.appendChild(label);
            block.classList.add(era.class);
        }
        const yearLabel = document.createElement('div');
        yearLabel.textContent = `${c}`;
        block.appendChild(yearLabel);
        block.addEventListener('click', () => {
            if (currentPhase === 1) selectCentury(c);
        });
        timelineWrapper.appendChild(block);

        const hr = document.createElement('div');
        hr.style.position = 'absolute';
        hr.style.top = `${(c - 500) * YEAR_HEIGHT}px`;
        hr.style.width = '100%';
        hr.style.borderTop = '1px dashed #eee';
        labelContainer.appendChild(hr);
    }
}

function generateDecadeButtons() {
    decadeGrid.innerHTML = '';
    for (let i = 0; i <= 90; i += 10) {
        const btn = document.createElement('button');
        btn.className = 'digit-btn';
        btn.textContent = String(i).padStart(2, '0');
        btn.addEventListener('click', () => selectDecade(i));
        decadeGrid.appendChild(btn);
    }
}

function generateYearButtons() {
    yearGrid.innerHTML = '';
    for (let i = 0; i <= 9; i++) {
        const btn = document.createElement('button');
        btn.className = 'digit-btn';
        btn.textContent = i;
        btn.addEventListener('click', () => selectYearDigit(i));
        yearGrid.appendChild(btn);
    }
}

function selectCentury(c) {
    selectedCentury = c;
    selectedDecade = null;
    selectedYear = null;
    updateDisplay();
    highlightHint();
    document.querySelectorAll('.century-block').forEach(b => b.classList.toggle('active', parseInt(b.dataset.century) === c));
    decadeSection.classList.add('visible');
    yearSection.classList.remove('visible');
}

function selectDecade(d) {
    selectedDecade = d;
    selectedYear = null;
    updateDisplay();
    highlightHint();
    decadeGrid.querySelectorAll('.digit-btn').forEach((b, idx) => b.classList.toggle('selected', idx * 10 === d));
    yearSection.classList.add('visible');
}

function selectYearDigit(y) {
    selectedYear = y;
    updateDisplay();
    highlightHint();
    yearGrid.querySelectorAll('.digit-btn').forEach((b, idx) => b.classList.toggle('selected', idx === y));
}

function updateDisplay() {
    let text = "";
    if (selectedCentury !== null) {
        const dStr = selectedDecade !== null ? String(selectedDecade).padStart(2, '0')[0] : "?";
        const yStr = selectedYear !== null ? String(selectedYear) : "?";
        const base = Math.floor(selectedCentury / 100);
        text = `${base}${dStr}${yStr} 年`;
    } else {
        text = "???? 年";
    }
    yearDisplay.textContent = text;
    okButton.disabled = (selectedCentury === null || selectedDecade === null || selectedYear === null);
}

function showQuestion() {
    const progressEl = document.getElementById('progress-counter');
    
    if (currentPhase === 1) {
        if (currentQuestionIndex >= phase1Questions.length) {
            if (phase2Questions.length > 0) {
                currentPhase = 2;
                currentQuestionIndex = 0;
                alert("正引き完了！逆引きフェーズを開始します。");
                startPhase2();
                return;
            } else {
                if (progressEl) progressEl.textContent = "DONE";
                showFinalResults();
                return;
            }
        }
        
        const q = phase1Questions[currentQuestionIndex];
        if (progressEl) progressEl.textContent = `${currentQuestionIndex + 1} / ${phase1Questions.length}`;

        questionText.textContent = q.q;
        yearDisplay.style.display = 'block';
        okButton.style.display = 'block';
        passButton.style.display = 'block';
        decadeSection.classList.remove('visible');
        yearSection.classList.remove('visible');
        
        selectedCentury = null;
        selectedDecade = null;
        selectedYear = null;
        updateDisplay();
        document.querySelectorAll('.century-block').forEach(b => b.classList.remove('active'));
        highlightHint();
    } else {
        // フェーズ2の進捗確認と終了判定
        const unanswered = phase2Questions.filter(q => q.result === null);
        const progressEl = document.getElementById('progress-counter');
        
        if (unanswered.length === 0 && phase2Questions.length > 0) {
            if (progressEl) progressEl.textContent = "DONE";
            showFinalResults();
        } else if (phase2Questions.length > 0) {
            const answeredCount = phase2Questions.length - unanswered.length;
            if (progressEl) progressEl.textContent = `${answeredCount} / ${phase2Questions.length}`;
        }
    }
}

// フェーズ2：初期化と全マーカーの配置
function startPhase2() {
    questionText.textContent = "年号ボタンを押して出来事を選んでください";
    yearDisplay.style.display = 'none';
    okButton.style.display = 'none';
    passButton.style.display = 'none';
    decadeSection.classList.remove('visible');
    yearSection.classList.remove('visible');
    
    // フェーズ1の選択状態をクリア
    selectedCentury = null;
    selectedDecade = null;
    selectedYear = null;
    document.querySelectorAll('.century-block').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.hint').forEach(el => el.classList.remove('hint'));
    
    const labelContainer = document.getElementById('label-container');
    // コンテナそのものや点線を消さず、ラベルとマーカーだけを削除
    labelContainer.querySelectorAll('.event-label, .year-marker').forEach(el => el.remove());
    
    const progressEl = document.getElementById('progress-counter');
    let answeredCount = 0;
    
    phase2Questions.forEach(q => {
        if (q.result !== null && q.result !== undefined) {
            // 既に解答済みの場合はラベルを配置
            placeLabel(parseInt(q.a), q.q, q.result, true);
            answeredCount++;
        } else {
            // 未解答の場合はマーカーを配置
            const marker = document.createElement('button');
            marker.className = 'year-marker active';
            marker.textContent = `[ ${q.a} ]`;
            const yPos = (parseInt(q.a) - 500) * YEAR_HEIGHT;
            marker.style.top = `${yPos}px`;
            marker.addEventListener('click', () => showChoices(q, marker));
            labelContainer.appendChild(marker);
        }
    });
    
    currentQuestionIndex = answeredCount;
    if (progressEl) progressEl.textContent = `${currentQuestionIndex} / ${phase2Questions.length}`;
    
    if (currentQuestionIndex >= phase2Questions.length) {
        if (progressEl) progressEl.textContent = "DONE";
    }
    
    // スクロールを一番上に戻す
    timelineWrapper.scrollTo({ top: 0, behavior: 'smooth' });

    // 初期状態での終了判定（再開時など）
    showQuestion();
}

// 逆引き用の10択メニューを表示
function showChoices(q, marker) {
    choiceContainer.innerHTML = '';
    
    // 選択肢の作成（正解 + ランダムな他問題の正解）
    // M列が逆引きに該当するものすべてからプールを作成
    let pool = allQuestions.filter(item => 
        (item.m == "出来事あて" || item.m == "逆引き" || item.m == "2") && item.q !== q.q
    ).map(item => item.q);
    
    pool = [...new Set(pool)].sort(() => Math.random() - 0.5).slice(0, 9);
    let choices = [q.q, ...pool].sort(() => Math.random() - 0.5);

    const isTraining = (q.qv === 0);

    choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        if (isTraining && choice === q.q) btn.classList.add('hint');
        btn.textContent = choice;
        btn.addEventListener('click', () => {
            if (choice === q.q) {
                judgePhase2(true, q, marker);
            } else {
                btn.classList.add('wrong');
                setTimeout(() => judgePhase2(false, q, marker), 500);
            }
        });
        choiceContainer.appendChild(btn);
    });
    
    // パスボタンの追加
    const passBtn = document.createElement('button');
    passBtn.className = 'choice-btn pass-btn';
    passBtn.textContent = 'パス（答えを見る）';
    passBtn.addEventListener('click', () => {
        judgePhase2("pass", q, marker);
    });
    choiceContainer.appendChild(passBtn);
    
    choiceOverlay.classList.remove('hidden');
}

function judge(isPass = false) {
    const currentList = (currentPhase === 1) ? phase1Questions : phase2Questions;
    const q = currentList[currentQuestionIndex];
    const correctYear = parseInt(q.a);
    
    let isCorrect = false;
    if (isPass) {
        isCorrect = "pass"; 
    } else {
        const inputYear = selectedCentury + selectedDecade + selectedYear;
        isCorrect = (inputYear === correctYear);
    }
    
    if (isCorrect === false) {
        // 誤答時：missedフラグを立てて、やり直し（登録はまだしない）
        q.missed = true;
        showOverlay("×", `正解は ${correctYear}年`);
        saveProgress();
        setTimeout(showQuestion, 1500);
    } else {
        // 正解またはパス時：ここで結果を登録
        // 正解なら true(◯), ミス後の正解またはパスなら false(×)
        const finalResult = (isCorrect === "pass") ? false : (q.missed ? false : true);
        q.result = finalResult;
        
        showOverlay(isCorrect === true ? "○" : "PASS", isCorrect === "pass" ? `正解は ${correctYear}年` : "");
        placeLabel(correctYear, q.q, finalResult);
        
        currentQuestionIndex++;
        saveProgress();
        setTimeout(showQuestion, 1200);
    }
}

function judgePhase2(isCorrect, q, marker) {
    choiceOverlay.classList.add('hidden');
    
    if (isCorrect === false) {
        // 逆引き誤答時：missedフラグを立てて、やり直し（登録はまだしない）
        q.missed = true;
        showOverlay("×", `正解は「${q.q}」`);
    } else {
        // 正解またはパス時：ここで結果を登録
        // 正解なら true(◯), ミス後の正解またはパスなら false(×)
        const finalResult = (isCorrect === "pass") ? false : (q.missed ? false : true);
        q.result = finalResult;
        
        const symbol = (isCorrect === true) ? "○" : "PASS";
        showOverlay(symbol, isCorrect === "pass" ? `正解は「${q.q}」` : "");
        
        // ラベルを配置
        placeLabel(parseInt(q.a), q.q, finalResult);
        
        // マーカー削除アニメーション
        if (marker && marker.parentNode) {
            marker.classList.add('pulsing');
            setTimeout(() => {
                if (marker.parentNode) marker.parentNode.removeChild(marker);
                showQuestion();
            }, 1000);
        } else {
            showQuestion();
        }
    }
    
    saveProgress();
}

function showOverlay(symbol, detail = "") {
    const color = (symbol === "○" || symbol === "PASS") ? "#4cd964" : "#ff3b30";
    overlay.innerHTML = `
        <div style="font-size: 10rem; color: ${color}; text-shadow: 0 0 20px rgba(255,255,255,0.8); font-weight: bold; line-height: 1;">${symbol}</div>
        <div style="font-size: 2.2rem; margin-top: 10px; color: #fff; text-shadow: 2px 2px 10px rgba(0,0,0,1), -2px -2px 10px rgba(0,0,0,1); font-weight: bold; text-align: center; padding: 0 20px;">${detail}</div>
    `;
    overlay.style.flexDirection = "column";
    overlay.style.display = "flex";
    overlay.style.background = "transparent";
    setTimeout(() => { overlay.style.display = "none"; }, detail ? 2000 : 800);
}

function placeLabel(year, title, isCorrect, isQuiet = false) {
    const labelContainer = document.getElementById('label-container');
    if (!labelContainer) return;

    const label = document.createElement('div');
    label.className = `event-label ${isCorrect ? 'correct' : 'wrong'}`;
    label.textContent = `${year} ${title}`;
    const yPos = (year - 500) * YEAR_HEIGHT;
    label.style.top = `${yPos}px`;

    // フェーズ2では、左側のマーカーと重ならないように開始位置を右にずらす
    let leftOffset = (currentPhase === 2) ? 120 : 10;
    
    const existingLabels = labelContainer.querySelectorAll('.event-label');
    existingLabels.forEach(ex => {
        const exTop = parseFloat(ex.style.top);
        const exLeft = parseFloat(ex.style.left) || 10;
        if (Math.abs(exTop - yPos) < 25) {
            leftOffset = Math.max(leftOffset, exLeft + 100);
        }
    });
    label.style.left = `${leftOffset}px`;
    labelContainer.appendChild(label);
    
    if (!isQuiet) {
        const targetScroll = Math.max(0, yPos - mainDisplayArea.clientHeight / 2);
        timelineWrapper.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }
}

function showFinalResults() {
    localStorage.removeItem(STORAGE_KEY);
    
    // 全結果の集計（フェーズ1と2を合体させて年号順にソート）
    const allResults = [...phase1Questions, ...phase2Questions]
        .filter(q => q.result !== null)
        .sort((a, b) => (a.p - b.p) || (a.n - b.n));
    
    let resultText = "【歴史年号テスト結果】\n";
    allResults.forEach(q => {
        const symbol = q.result === true ? "◯" : "×";
        resultText += `${q.a} ${symbol}\n`;
    });

    questionText.innerHTML = `全問終了！<br><button id="line-btn" style="width:auto; padding:8px 16px; margin-top:5px; background:#00c300; color:white; border:none; border-radius:10px; font-weight:bold; cursor:pointer;">結果をコピーしてLINE送信</button>`;
    okButton.style.display = 'none';
    passButton.style.display = 'none';
    yearDisplay.textContent = "お疲れ様でした！";

    const lineBtn = document.getElementById('line-btn');
    if (lineBtn) {
        lineBtn.addEventListener('click', () => {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(resultText).then(() => {
                    openLine(resultText);
                }).catch(() => {
                    fallbackCopy(resultText);
                });
            } else {
                fallbackCopy(resultText);
            }
        });
    }
}

function openLine(text) {
    window.location.href = `line://msg/text/${encodeURIComponent(text)}`;
    setTimeout(() => {
        alert("結果をクリップボードにコピーしました。LINEに貼り付けて報告してください。");
    }, 500);
}

function fallbackCopy(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        openLine(text);
    } catch (err) {
        alert("コピーに失敗しました。手動で選択してコピーしてください。");
    }
    document.body.removeChild(textArea);
}

function highlightHint() {
    if (currentPhase !== 1) return;
    document.querySelectorAll('.hint').forEach(el => el.classList.remove('hint'));
    const q = phase1Questions[currentQuestionIndex];
    if (!q || q.qv !== 0) return;
    const correctYear = parseInt(q.a);
    const c = Math.floor(correctYear / 100) * 100;
    const d = Math.floor((correctYear % 100) / 10) * 10;
    const y = correctYear % 10;
    
    if (selectedCentury === null) {
        const btn = document.querySelector(`.century-block[data-century="${c}"]`);
        if (btn) btn.classList.add('hint');
    } else if (selectedDecade === null) {
        const btns = decadeGrid.querySelectorAll('.digit-btn');
        btns.forEach(btn => { if (parseInt(btn.textContent) === d) btn.classList.add('hint'); });
    } else if (selectedYear === null) {
        const btns = yearGrid.querySelectorAll('.digit-btn');
        btns.forEach(btn => { if (parseInt(btn.textContent) === y) btn.classList.add('hint'); });
    }
}

init();
