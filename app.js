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

let questions = [];
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
const overlay = document.getElementById('judge-overlay');

// 定数 (100年 = 50px = ボタン1つ分の高さ)
const YEAR_HEIGHT = 0.5; 
const STORAGE_KEY = 'chronos_timeline_progress';

// 初期化
function init() {
    loadQuestions();
    
    // 中断データがあるか確認
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && questions.length > 0) {
        try {
            const data = JSON.parse(saved);
            // 埋め込まれた問題セットと同じかチェック（簡易的に件数で）
            if (data.questions && data.questions.length === questions.length) {
                if (confirm("前回の続きから再開しますか？")) {
                    questions = data.questions;
                    currentQuestionIndex = data.index;
                    // すでに正解したラベルを配置
                    questions.slice(0, currentQuestionIndex).forEach(q => {
                        placeLabel(parseInt(q.a), q.q, q.result, true);
                    });
                } else {
                    localStorage.removeItem(STORAGE_KEY);
                }
            }
        } catch(e) { console.error(e); }
    }

    generateTimeline();
    generateDecadeButtons();
    generateYearButtons();
    showQuestion();
    
    okButton.addEventListener('click', () => judge(false));
    const ngBtn = document.getElementById('ng-button');
    if (ngBtn) {
        ngBtn.addEventListener('click', () => judge(true));
    }
    
    // スクロール同期
    timelineWrapper.addEventListener('scroll', () => {
        mainDisplayArea.scrollTop = timelineWrapper.scrollTop;
    });
}

function loadQuestions() {
    try {
        const dataText = document.getElementById('question-data').textContent;
        const cleanJson = dataText.replace(/\/\*[\s\S]*?\*\//g, '');
        const rawData = JSON.parse(cleanJson);
        // 元の順序を記憶させつつ、出題用にシャッフル
        questions = rawData.map((q, i) => ({ ...q, originalIndex: i, result: null }));
        questions.sort(() => Math.random() - 0.5);
    } catch (e) {
        console.error("Failed to load questions", e);
        questionText.textContent = "データの読み込みに失敗しました";
    }
}

function saveProgress() {
    const data = {
        index: currentQuestionIndex,
        questions: questions
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
        
        block.addEventListener('click', () => selectCentury(c));
        timelineWrapper.appendChild(block);

        // メインエリアに薄い区切り線
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
    
    document.querySelectorAll('.century-block').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.century) === c);
    });
    
    decadeSection.classList.add('visible');
    yearSection.classList.remove('visible');
    decadeGrid.querySelectorAll('.digit-btn').forEach(b => b.classList.remove('selected'));
}

function selectDecade(d) {
    selectedDecade = d;
    selectedYear = null;
    updateDisplay();
    highlightHint();
    
    decadeGrid.querySelectorAll('.digit-btn').forEach((b, idx) => {
        b.classList.toggle('selected', idx * 10 === d);
    });
    
    yearSection.classList.add('visible');
    yearGrid.querySelectorAll('.digit-btn').forEach(b => b.classList.remove('selected'));
}

function selectYearDigit(y) {
    selectedYear = y;
    updateDisplay();
    highlightHint();
    
    yearGrid.querySelectorAll('.digit-btn').forEach((b, idx) => {
        b.classList.toggle('selected', idx === y);
    });
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
    if (currentQuestionIndex >= questions.length) {
        if (progressEl) progressEl.textContent = "DONE";
        showFinalResults();
        return;
    }
    
    if (progressEl) {
        progressEl.textContent = `${currentQuestionIndex + 1} / ${questions.length}`;
    }

    const q = questions[currentQuestionIndex];
    questionText.textContent = q.q;
    
    selectedCentury = null;
    selectedDecade = null;
    selectedYear = null;
    updateDisplay();
    
    document.querySelectorAll('.century-block').forEach(b => b.classList.remove('active'));
    decadeSection.classList.remove('visible');
    yearSection.classList.remove('visible');
    highlightHint();
}

function judge(isForcedNG = false) {
    const q = questions[currentQuestionIndex];
    const correctYear = parseInt(q.a);
    const inputYear = selectedCentury + selectedDecade + selectedYear;
    
    const isCorrect = isForcedNG ? false : (inputYear === correctYear);
    q.result = isCorrect;
    
    showOverlay(isCorrect);
    placeLabel(correctYear, q.q, isCorrect);
    
    currentQuestionIndex++;
    saveProgress(); // 進捗保存

    setTimeout(() => {
        showQuestion();
    }, 1200);
}

function showFinalResults() {
    localStorage.removeItem(STORAGE_KEY); // 完了したら削除

    const sorted = [...questions].sort((a, b) => a.originalIndex - b.originalIndex);
    
    let resultText = "【歴史年号テスト結果】\n";
    sorted.forEach(q => {
        const symbol = q.result === true ? "◯" : (q.result === false ? "×" : "－");
        resultText += `${q.a} ${symbol}\n`;
    });

    questionText.innerHTML = `全問終了！<br><button id="line-btn" class="digit-btn" style="width:auto; padding:10px 20px; margin-top:10px; background:#00c300; color:white; border-radius:10px;">結果をコピーしてLINE送信</button>`;
    okButton.style.display = 'none';
    yearDisplay.textContent = "お疲れ様でした！";

    document.getElementById('line-btn').addEventListener('click', () => {
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

function showOverlay(isCorrect) {
    overlay.textContent = isCorrect ? "○" : "×";
    overlay.style.color = isCorrect ? "#4cd964" : "#ff3b30";
    overlay.style.display = "flex";
    setTimeout(() => { overlay.style.display = "none"; }, 800);
}

function placeLabel(year, title, isCorrect, isQuiet = false) {
    const labelContainer = document.getElementById('label-container');
    if (!labelContainer) return;

    const label = document.createElement('div');
    label.className = `event-label ${isCorrect ? 'correct' : 'wrong'}`;
    label.textContent = `${year} ${title}`;
    
    const yPos = (year - 500) * YEAR_HEIGHT;
    label.style.top = `${yPos}px`;

    let leftOffset = 10;
    const existingLabels = labelContainer.querySelectorAll('.event-label');
    existingLabels.forEach(ex => {
        const exTop = parseFloat(ex.style.top);
        const exLeft = parseFloat(ex.style.left) || 10;
        if (Math.abs(exTop - yPos) < 25) {
            leftOffset = Math.max(leftOffset, exLeft + 80);
        }
    });
    
    label.style.left = `${leftOffset}px`;
    labelContainer.appendChild(label);
    
    if (!isQuiet) {
        const targetScroll = Math.max(0, yPos - mainDisplayArea.clientHeight / 2);
        timelineWrapper.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }
}

function highlightHint() {
    document.querySelectorAll('.hint').forEach(el => el.classList.remove('hint'));
    
    const q = questions[currentQuestionIndex];
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
        btns.forEach(btn => {
            if (parseInt(btn.textContent) === d) btn.classList.add('hint');
        });
    } else if (selectedYear === null) {
        const btns = yearGrid.querySelectorAll('.digit-btn');
        btns.forEach(btn => {
            if (parseInt(btn.textContent) === y) btn.classList.add('hint');
        });
    }
}

init();
