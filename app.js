let harmfulBookMap = {};
let codeReader = new ZXing.BrowserMultiFormatReader();

// 스마트폰 환경에서 뷰포트 전체 바운스 및 밀림 현상을 완벽히 차단
document.addEventListener('touchmove', function (e) {
    e.preventDefault();
}, { passive: false });

// 1. CSV 데이터 로드 및 초기화
function initApp() {
    Papa.parse("data.csv", {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
            const rawData = results.data;
            rawData.forEach(item => {
                if (item["I"]) {
                    const cleanIsbnKey = String(item["I"]).replace(/[^0-9]/g, '');
                    harmfulBookMap[cleanIsbnKey] = item;
                }
            });

            console.log(`총 ${Object.keys(harmfulBookMap).length}건 로드 완료`);

            document.getElementById('loading-screen').style.display = 'none';
            document.getElementById('app-content').style.display = 'flex';

            const hints = new Map();
            hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.EAN_13]);
            codeReader.hints = hints;
            startZxingScanner();
        },
        error: function (err) {
            alert("CSV 파일을 불러오지 못했습니다.");
        }
    });
}

// 2. 스캐너 실행
function startZxingScanner() {
    // 섹션 자체를 스위칭하여 충돌 요소 원천 배제
    document.getElementById('scanner-section').style.display = 'block';
    document.getElementById('result-section').style.display = 'none';

    const constraints = { video: { facingMode: "environment" } };

    codeReader.decodeFromConstraints(constraints, 'video', (result, err) => {
        if (result) {
            // [정상화 핵심] 성공 즉시 카메라 자원 락을 무조건 해제하여 다음 프로세스 멈춤을 방지
            codeReader.reset();
            checkIsbn(result.text);
        }
    }).catch(err => {
        alert("카메라 권한을 허용해주세요.");
    });
}

// 3. ISBN 검증 및 UI 출력
function checkIsbn(isbn) {
    // 스캔이 끝나면 카메라 섹션을 화면에서 즉시 완전히 소멸시킴 (검은 박스 방지)
    document.getElementById('scanner-section').style.display = 'none';
    
    const cleanIsbn = String(isbn).replace(/[^0-9]/g, '');
    const resultSection = document.getElementById('result-section');
    const resultContent = document.getElementById('result-content');

    if (cleanIsbn in harmfulBookMap) {
        const bookInfo = harmfulBookMap[cleanIsbn];
        const decision = bookInfo["S"] || "유해간행물";
        const volumeStr = bookInfo["V"] ? ` (${bookInfo["V"]}권)` : "";
        const bookName = (bookInfo["N"] || '정보 없음') + volumeStr;

        resultContent.innerHTML = `
            <div class="status-badge-wrapper">
                <span class="status-badge red">${decision}</span>
            </div>
            <div class="info-grid">
                <div class="info-row"><span class="info-label">간행물명</span><span class="info-value primary">${bookName}</span></div>
                <div class="info-row"><span class="info-label">발행사</span><span class="info-value">${bookInfo["P"] || '정보 없음'}</span></div>
                <div class="info-row"><span class="info-label">발행일</span><span class="info-value">${bookInfo["D"] || '정보 없음'}</span></div>
                <div class="info-row"><span class="info-label">결정일자</span><span class="info-value">${bookInfo["R"] || '정보 없음'}</span></div>
                <div class="info-row"><span class="info-label">ISBN</span><span class="info-value code">${cleanIsbn}</span></div>
            </div>
        `;
    } else {
        resultContent.innerHTML = `
            <div class="status-badge-wrapper">
                <span class="status-badge green">안전 도서</span>
            </div>
            <div class="info-grid">
                <p class="safe-message">유해간행물 데이터베이스에 등록되지 않은 도서입니다.</p>
                <div class="info-row" style="border-top: 1px solid var(--apple-border); padding-top: 14px;">
                    <span class="info-label">스캔 ISBN</span><span class="info-value code" style="color: var(--badge-green-text); font-weight: 600;">${cleanIsbn}</span>
                </div>
            </div>
        `;
    }

    // 완전히 준비된 데이터 결과창 오픈
    resultSection.style.display = 'block';
}

document.getElementById('rescan-btn').onclick = () => { startZxingScanner(); };

initApp();