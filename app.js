let harmfulBookMap = {};
let codeReader = new ZXing.BrowserMultiFormatReader();
let scannerStarting = false;
let scanResultHandled = false;

// 1. CSV 데이터 로드 및 초기화
function initApp() {
    // PapaParse를 이용해 CSV 파일을 스트리밍 방식으로 초고속 로드
    Papa.parse("data.csv", {
        download: true, // 파일 불러오기
        header: true,   // 첫 줄을 컬럼명으로 인식
        skipEmptyLines: true,
        complete: function (results) {
            // 로드가 완료되면 데이터 처리
            const rawData = results.data;
            rawData.forEach(item => {
                if (item["I"]) {
                    const cleanIsbnKey = String(item["I"]).replace(/[^0-9]/g, '');
                    harmfulBookMap[cleanIsbnKey] = item;
                }
            });

            console.log(`총 ${Object.keys(harmfulBookMap).length}건 로드 완료`);

            // 로딩 화면 숨기고 스캐너 화면 표시
            document.getElementById('loading-screen').style.display = 'none';
            document.getElementById('app-content').style.display = 'block';

            // 터치 초점 이벤트 등록
            setupFocusListeners();

            // 스캐너 설정 및 실행
            const hints = new Map();
            hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.EAN_13]);
            codeReader.hints = hints;
            startZxingScanner();
        },
        error: function (err) {
            alert("CSV 파일을 불러오지 못했습니다.");
            console.error(err);
        }
    });
}

// 2. 비디오 화면 터치/클릭 시 초점 재설정 이벤트 등록
function setupFocusListeners() {
    const videoEl = document.getElementById('video');
    if (videoEl) {
        if (window.PointerEvent) {
            videoEl.addEventListener('pointerdown', triggerRefocus);
        } else if ('ontouchstart' in window) {
            videoEl.addEventListener('touchstart', triggerRefocus, { passive: true });
        } else {
            videoEl.addEventListener('click', triggerRefocus);
        }
    }
}

// 3. 카메라 초점 재조정 (Refocus) 실행
function triggerRefocus() {
    const videoElement = document.getElementById('video');
    if (!videoElement || !videoElement.srcObject) return;

    const tracks = videoElement.srcObject.getVideoTracks();
    if (!tracks || tracks.length === 0) return;

    const track = tracks[0];

    try {
        const capabilities = typeof track.getCapabilities === 'function' ? track.getCapabilities() : {};

        const focusModes = Array.isArray(capabilities.focusMode) ? capabilities.focusMode : [];
        const applyContinuousFocus = () => {
            if (focusModes.includes('continuous')) {
                track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] })
                    .catch(err => console.warn('Refocus error:', err));
            }
        };

        if (focusModes.includes('single-shot')) {
            track.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] })
                .then(() => {
                    if (focusModes.includes('continuous')) {
                        setTimeout(applyContinuousFocus, 500);
                    }
                })
                .catch(err => {
                    console.warn('Refocus error:', err);
                    applyContinuousFocus();
                });
        } else if (focusModes.includes('manual') && focusModes.includes('continuous')) {
            track.applyConstraints({ advanced: [{ focusMode: 'manual' }] })
                .then(() => track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }))
                .catch(err => {
                    console.warn('Refocus error:', err);
                    applyContinuousFocus();
                });
        } else if (focusModes.includes('continuous')) {
            applyContinuousFocus();
        } else {
            console.info('이 카메라/브라우저는 초점 모드 제어를 지원하지 않습니다.');
        }
    } catch (err) {
        console.warn("Refocus error:", err);
    }
}

// 4. 스캐너 실행
function startZxingScanner() {
    if (scannerStarting) return;

    scannerStarting = true;
    scanResultHandled = false;
    document.getElementById('camera-frame').style.display = 'block';
    document.getElementById('result-card').style.display = 'none';
    document.getElementById('rescan-btn').style.display = 'none';

    // 화면 모양 및 크기 변형을 완벽히 차단하는 기본 constraints
    const constraints = {
        video: {
            facingMode: "environment",
            advanced: [{ focusMode: "continuous" }]
        }
    };

    codeReader.decodeFromConstraints(constraints, 'video', (result, err) => {
        if (result && !scanResultHandled) {
            scanResultHandled = true;
            scannerStarting = false;
            codeReader.reset();
            checkIsbn(result.text);
        }
    }).then(() => {
        if (!scanResultHandled) triggerRefocus();
    }).catch(err => {
        scannerStarting = false;
        alert("카메라 권한을 허용해주세요. 문제가 지속되면 새로고침 해주세요.");
    });
}

// 5. ISBN 검증 및 UI 출력
function checkIsbn(isbn) {
    document.getElementById('camera-frame').style.display = 'none';

    const cleanIsbn = String(isbn).replace(/[^0-9]/g, '');
    const resultCard = document.getElementById('result-card');
    const resultText = document.getElementById('result-text');
    const rescanBtn = document.getElementById('rescan-btn');

    resultCard.style.display = 'block';
    rescanBtn.style.display = 'inline-block';

    if (cleanIsbn in harmfulBookMap) {
        const bookInfo = harmfulBookMap[cleanIsbn];
        const decision = bookInfo["S"] || "유해간행물";
        const volumeStr = bookInfo["V"] ? ` (${bookInfo["V"]}권)` : "";
        const bookName = (bookInfo["N"] || '정보 없음') + volumeStr;

        resultCard.className = 'harmful';
        resultText.innerHTML = `
            🚨 <strong>${decision}로 등록된 도서입니다.</strong><br><br>
            <div style="text-align: left; padding: 10px; background: rgba(255,255,255,0.5); border-radius: 6px;">
                🔹 <strong>간행물명 :</strong> ${bookName}<br>
                🔹 <strong>발행사 :</strong> ${bookInfo["P"] || '정보 없음'}<br>
                🔹 <strong>발행일 :</strong> ${bookInfo["D"] || '정보 없음'}<br>
                🔹 <strong>결정일자 :</strong> ${bookInfo["R"] || '정보 없음'}<br>
                🔹 <strong>ISBN :</strong> ${cleanIsbn}
            </div>
        `;
    } else {
        resultCard.className = 'safe';
        resultText.innerHTML = `
            ✅ <strong>유해간행물 리스트에 없습니다. (안전)</strong><br><br>
            <span style="font-size: 14px; color: #666;">스캔된 ISBN: ${cleanIsbn}</span>
        `;
    }
}

document.getElementById('rescan-btn').onclick = () => { startZxingScanner(); };

initApp();