let video, handPose;
let hands = [];

let gameState = "cover"; // 從封面開始

let playerMove = "等待中";
let computerMove = "等待中";
let resultText = "";

let playerScore = 0;
let computerScore = 0;

let countdown = 3;
let countdownStart;

// 新增：出拳階段的計時器變數
let playTimeStart;
const playDuration = 3; // 玩家必須在 3 秒內完成動作
let moveMade = false; // 追蹤玩家是否已做出動作
// 用於計算影像縮放與偏移的變數，確保手部點位繪製能對齊畫面
let vW, vH, vX, vY;

// 新增：追蹤鏡頭是否就緒
let videoReady = false;
// 新增：追蹤鏡頭是否啟動失敗
let videoError = false;
// 新增：防重複觸發變數，確保玩家在回合間有放開手
let canTriggerNext = true;

function preload() {
  handPose = ml5.handPose({ flipped: true });
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  // 修正：移除不標準的 { flipped: true } 參數
  // p5.js createCapture 第二個參數應直接放 callback
  video = createCapture(VIDEO, () => {
    console.log("鏡頭已啟動");
    videoReady = true;
    handPose.detectStart(video, gotHands);
  });
  
  // 動態調整視頻尺寸，適配手機和電腦
  let videoWidth = min(640, windowWidth);
  let videoHeight = min(480, windowHeight);
  video.size(videoWidth, videoHeight);
  video.hide();

  // 設定逾時檢查：如果 10 秒後鏡頭還沒準備好，則判定為錯誤
  setTimeout(() => {
    if (!videoReady) {
      videoError = true;
      console.error("攝像頭啟動超時或失敗");
    }
  }, 10000);

  textAlign(CENTER, CENTER);
  rectMode(CENTER);
  
  // 監聽方向變化（手機專用）
  window.addEventListener('orientationchange', handleOrientationChange);
}

function handleOrientationChange() {
  // 延遲以等待系統完成方向變化
  setTimeout(() => {
    resizeCanvas(windowWidth, windowHeight);
  }, 100);
}

function gotHands(results) {
  hands = results;
}

function draw() {
  background(20);

  // 1. 如果鏡頭準備好了，就在背景繪製影像（封面和說明頁會蓋在它上面）
  if (videoReady && video.width > 0) {
    drawVideoFit();
    drawHand();
    
    // 偵測調試信息（選用，僅在開發時顯示）
    /*
    fill(255);
    textSize(14);
    textAlign(LEFT, TOP);
    text("鏡頭已就緒 - 偵測中", 10, 10);
    textAlign(CENTER, CENTER);
    */
  }

  // 2. 根據遊戲狀態繪製 UI
  if (gameState === "cover") {
    coverPage();
  } else if (gameState === "instructions") {
    instructionPage();
    if (videoReady) checkHandTrigger(); // 鏡頭好了才開放手勢自動開始
  } else {
    // 進入「倒數」或「結果」狀態，必須要有鏡頭
    if (!videoReady) {
      loadingPage(); // 如果還沒啟動好，就在此時顯示加載頁面
    } else {
      drawTopBar();
      if (gameState === "countdown") {
        countdownPage();
      } else if (gameState === "result") {
        resultPage();
      }
      checkHandTrigger();
    }
  }
}

// 新增：讀取頁面函式
function loadingPage() {
  if (videoError) {
    // 顯示錯誤訊息
    fill(255, 50, 50); // 紅色文字提醒
    textSize(getSize(32, 24, 40));
    text("鏡頭啟動失敗", width / 2, height / 2);
    
    fill(200);
    textSize(getSize(16, 12, 20));
    text("請檢查：\n1. 攝影機是否已連接\n2. 瀏覽器權限是否已開啟\n3. 網址是否使用 localhost 或 HTTPS", width / 2, height / 2 + 80);
    
    drawButton(width / 2, height * 0.82, "重新整理");
    return;
  }

  // 繪製旋轉動畫 emoji
  push();
  translate(width / 2, height / 2 - 100); // 將座標移至文字上方
  rotate(frameCount * 0.1); // 隨格數旋轉，0.1 控制旋轉速度
  textAlign(CENTER, CENTER);
  textSize(getSize(60, 40, 80)); // 使用自訂的 getSize 調整大小
  text("✨", 0, 0); // 你也可以換成 🌸, 🎮 或 🔄
  pop();

  fill(255);
  noStroke();
  textSize(getSize(32, 24, 40));
  text("等待鏡頭啟動...", width / 2, height / 2);
  textSize(getSize(16, 12, 20));
  text("請確保已允許瀏覽器使用攝影機權限", width / 2, height / 2 + 50);
}

// 讓鏡頭畫面在手機/電腦都等比例填滿，不變形
function drawVideoFit() {
  let videoRatio = video.width / video.height;
  let canvasRatio = width / height;

  let drawW, drawH;
  if (canvasRatio > videoRatio) {
    drawW = width;
    drawH = width / videoRatio;
  } else {
    drawH = height;
    drawW = height * videoRatio;
  }

  vW = drawW;
  vH = drawH;
  vX = (width - vW) / 2;
  vY = (height - vH) / 2;

  push();
  translate(vX + vW, vY); // 將座標原點移至影片繪製區域的右上角
  scale(-1, 1);           // 水平翻轉
  image(video, 0, 0, vW, vH);
  pop();
}

function drawTopBar() {
  fill(0, 150);
  rect(width / 2, 30, width, 60);

  fill(255);
  textSize(getSize(22, 18, 28));
  text("你：" + playerScore + "   電腦：" + computerScore, width / 2, 30);
}

function coverPage() {
  // 背景遮罩
  fill(0, 220);
  rect(width / 2, height / 2, width, height);

  // 遊戲標題
  push();
  fill(255, 255, 0); // 黃色標題
  textSize(getSize(80, 50, 100));
  text("剪刀石頭布", width / 2, height * 0.4);
  
  fill(255);
  textSize(getSize(24, 18, 30));
  text("AI 手勢辨識對戰系統", width / 2, height * 0.5);
  pop();

  drawButton(width / 2, height * 0.7, "進入遊戲");
}

function instructionPage() {
  // 背景遮罩
  fill(0, 210);
  rect(width / 2, height / 2, width, height);

  // 小標題
  fill(255, 255, 0);
  textSize(getSize(40, 30, 50));
  text("遊戲說明", width / 2, height * 0.2);
  
  // 裝飾線
  stroke(255, 150);
  strokeWeight(2);
  line(width * 0.4, height * 0.25, width * 0.6, height * 0.25);
  noStroke();

  // 玩法說明區塊
  fill(220);
  let startY = height * 0.35;
  let lineGap = getSize(35, 28, 40);
  
  textSize(getSize(24, 18, 28));
  text("🎮 規則指南", width / 2, startY);
  
  fill(180);
  textSize(getSize(18, 14, 22));
  text("1. 確保手部在鏡頭範圍內即可偵測", width / 2, startY + lineGap);
  text("2. 比出 ✊、✌️、✋ 或 👍 即可自動開始", width / 2, startY + lineGap * 2);
  text("3. 「出拳！」出現後，請在 3 秒內擺出手勢", width / 2, startY + lineGap * 3);
  text("4. 偵測點對準指尖時準確度最高", width / 2, startY + lineGap * 4);

  drawButton(width / 2, height * 0.8, "開始遊戲");
}

function resultPage() {
  fill(0, 180);
  // 加大背景遮罩區域，避免文字與背景混在一起
  rect(width / 2, height * 0.5, width, height);

  fill(255);
  textSize(getSize(36, 26, 42));
  text("你：" + playerMove, width / 2, height * 0.42);
  text("電腦：" + computerMove, width / 2, height * 0.52);

  textSize(getSize(50, 36, 60));
  fill(255, 255, 0); // 結果文字用黃色更加顯眼
  text(resultText, width / 2, height * 0.65);

  showAnimation();
  drawButton(width / 2, height * 0.85, "再玩一次"); 
}

// 保留這個版本的 countdownPage，並加入剩餘時間顯示
function countdownPage() {
  let elapsed = floor((millis() - countdownStart) / 1000);
  countdown = 3 - elapsed;

  fill(0, 180);
  rect(width / 2, height / 2, width, height);

  fill(255);
  textSize(getSize(100, 70, 130));

  if (countdown > 0) {
    text(countdown, width / 2, height / 2);
    playTimeStart = undefined; // 重置計時器
    moveMade = false; // 重置動作狀態
    playerMove = "等待中"; // 重置玩家動作
  } else {
    text("出拳！", width / 2, height / 2);
    
    if (playTimeStart === undefined) {
      playTimeStart = millis(); // 當「出拳！」出現時啟動計時器
    }

    // 顯示 3 秒倒數計時（視覺提示）
    let timerElapsed = (millis() - playTimeStart) / 1000;
    let remaining = max(0, (playDuration - timerElapsed)).toFixed(1);
    textSize(getSize(32, 24, 40));
    fill(255, 255, 0);
    text("剩餘時間: " + remaining + "s", width / 2, height / 2 + 80);

    // 如果時間到且玩家尚未出拳
    if (!moveMade && timerElapsed >= playDuration) {
      moveMade = true; // 標記為已做出動作（因超時）
      if (playerMove === "等待中") { // 如果玩家動作仍是預設值，表示超時未偵測到
        playerMove = "沒偵測到";
      }
      executeGameRound(); // 執行遊戲回合邏輯
      gameState = "result"; // 轉換到結果頁面
    }
  }
}

// 將原先的 playGame 函式更名為 executeGameRound
function executeGameRound() {
  // playerMove 已經由 checkHandTrigger 或 countdownPage 設定
  computerMove = random(["剪刀", "石頭", "布"]);
  resultText = judge(playerMove, computerMove);
}

function detectMove(hand) {
  let kp = hand.keypoints;

  // 使用歐幾里得距離判斷手指是否伸直
  const d = (p1, p2) => dist(p1.x, p1.y, p2.x, p2.y);
  const wrist = kp[0];

  let indexUp = d(kp[8], wrist) > d(kp[6], wrist) * 1.05;
  let middleUp = d(kp[12], wrist) > d(kp[10], wrist) * 1.05;
  let ringUp = d(kp[16], wrist) > d(kp[14], wrist) * 1.05;
  let pinkyUp = d(kp[20], wrist) > d(kp[18], wrist) * 1.05;
  
  // 大拇指判定：看尖端與食指根部的距離
  let thumbUp = d(kp[4], kp[5]) > d(kp[3], kp[5]) * 1.05;

  let count = 0;
  if (indexUp) count++;
  if (middleUp) count++;
  if (ringUp) count++;
  if (pinkyUp) count++;

  // 1. 優先判斷「讚」
  if (thumbUp && count === 0) {
    return "讚";
  }

  // 2. 布：大部分手指伸開 (放寬到 >= 3 以應對偵測不穩)
  if (count >= 3) return "布";

  // 3. 剪刀：食指和中指伸直，且不是布的情況
  if (indexUp && middleUp && count <= 2) {
    return "剪刀";
  }

  // 4. 石頭：幾乎沒有手指伸直 (考慮到大拇指可能被誤判，設為 <= 1)
  if (count <= 1) return "石頭";

  return "不明";
}

function judge(player, computer) {
  if (player === "不明" || player === "沒偵測到" || player === "讚") {
    return "沒看清楚";
  }

  if (player === computer) {
    return "平手";
  }

  if (
    (player === "剪刀" && computer === "布") ||
    (player === "石頭" && computer === "剪刀") ||
    (player === "布" && computer === "石頭")
  ) {
    playerScore++;
    return "你贏了";
  }

  computerScore++;
  return "你輸了";
}

function drawHand() {
  // 直接使用 drawVideoFit 已經算好的全域縮放變數
  let scaleX = vW / video.width;
  let scaleY = vH / video.height;

  // 定義手部骨架連接關係
  const connections = [
    [0, 1], [0, 5], [0, 9], [0, 13], [0, 17],
    [1, 2], [2, 3], [3, 4],
    [5, 6], [6, 7], [7, 8],
    [9, 10], [10, 11], [11, 12],
    [13, 14], [14, 15], [15, 16],
    [17, 18], [18, 19], [19, 20]
  ];

  // 遍歷所有偵測到的手
  if (hands.length > 0) {
    for (let hand of hands) {
      if (hand.confidence > 0.1) {
        let keypoints = hand.keypoints;

        // 繪製骨架連接線（明亮的藍色）
        stroke(0, 200, 255);
        strokeWeight(4); // 加粗線條
        for (let connection of connections) {
          let p1 = keypoints[connection[0]];
          let p2 = keypoints[connection[1]];
          line(
            vX + p1.x * scaleX,
            vY + p1.y * scaleY,
            vX + p2.x * scaleX,
            vY + p2.y * scaleY
          );
        }

        // 繪製關鍵點（亮黃色圓點）
        noStroke();
        fill(255, 255, 0); // 亮黃色
        for (let keypoint of keypoints) {
          circle(
            vX + keypoint.x * scaleX,
            vY + keypoint.y * scaleY,
            10
          );
        }

        // 手腕特殊標記（更大的圓點，紅色）
        fill(255, 0, 0);
        circle(
          vX + keypoints[0].x * scaleX,
          vY + keypoints[0].y * scaleY,
          14
        );
      }
    }
  }
}

function showAnimation() {
  textSize(getSize(70, 50, 90));

  if (resultText === "你贏了") {
    text("✨✨✨", width / 2, height * 0.32);
  } else if (resultText === "你輸了") {
    text("😭", width / 2, height * 0.32);
  } else if (resultText === "平手") {
    text("😐", width / 2, height * 0.32);
  }
}

function drawButton(x, y, label) {
  let btnW = constrain(width * 0.35, 180, 260);
  let btnH = constrain(height * 0.09, 56, 76);

  // 新增：呼吸燈（發光）效果
  push();
  let pulse = (sin(frameCount * 0.06) + 1) / 2; // 產生 0 到 1 之間的平滑循環
  noFill();
  stroke(255, 255, 0, pulse * 200); // 隨呼吸變化的黃色發光感
  strokeWeight(2 + pulse * 6);      // 邊框粗細隨之變化
  rect(x, y, btnW + pulse * 10, btnH + pulse * 10, 20); // 稍微放大的外框
  pop();

  // 繪製陰影感
  fill(0, 50);
  rect(x + 4, y + 4, btnW, btnH, 20);

  fill(255);
  rect(x, y, btnW, btnH, 20);

  fill(0);
  textSize(getSize(28, 22, 34));
  text(label, x, y);
}

function getSize(base, minSize, maxSize) {
  let s = min(width, height) / 480 * base;
  return constrain(s, minSize, maxSize);
}

// 新增：檢查滑鼠是否在按鈕範圍內的輔助函式
function isMouseOverButton(x, y) {
  let btnW = constrain(width * 0.35, 180, 260);
  let btnH = constrain(height * 0.09, 56, 76);
  return (
    mouseX > x - btnW / 2 &&
    mouseX < x + btnW / 2 &&
    mouseY > y - btnH / 2 &&
    mouseY < y + btnH / 2
  );
}

function checkHandTrigger() {
  // 提高信心值要求，確保手勢辨識準確，避免背景干擾自動開始
  let activeHand = hands.find(h => h.confidence > 0.4);
  
  // 如果畫面上沒偵測到手，重置觸發許可 (這讓玩家可以透過「移開手再放回」來再次自動開始遊戲)
  if (!activeHand) {
    canTriggerNext = true;
    return;
  }

  let detectedGesture = detectMove(activeHand);

  // 情境一：在「出拳！」階段，偵測到有效手勢立刻進行結算
  if (gameState === "countdown" && countdown <= 0 && !moveMade && 
      (detectedGesture === "剪刀" || detectedGesture === "石頭" || detectedGesture === "布")) {
    playerMove = detectedGesture;
    moveMade = true;
    executeGameRound();
    gameState = "result";
    canTriggerNext = false; // 鎖定觸發，防止立刻重新開始下一局
  }
  
  // 情境二：在「等待開始」或「結算結果」畫面，偵測到任何手勢就自動開始
  if (canTriggerNext && (gameState === "instructions" || gameState === "result") && 
           (detectedGesture !== "不明" && detectedGesture !== "等待中")) {
    gameState = "countdown";
    countdownStart = millis();
    canTriggerNext = false; // 標記已觸發，避免在倒數時重複重置時間
  }
}

function mousePressed() {
  // 如果鏡頭出錯，點擊按鈕後重新整理網頁
  if (videoError && isMouseOverButton(width / 2, height * 0.82)) {
    window.location.reload();
  }

  // 封面頁面 -> 進入說明頁面
  if (gameState === "cover" && isMouseOverButton(width / 2, height * 0.7)) {
    gameState = "instructions";
  } 
  // 說明頁面 -> 開始倒數
  else if (gameState === "instructions" && isMouseOverButton(width / 2, height * 0.8)) {
    gameState = "countdown";
    countdownStart = millis();
  } 
  else if (gameState === "result" && isMouseOverButton(width / 2, height * 0.88)) {
    gameState = "countdown";
    countdownStart = millis();
  }
}

function touchStarted() {
  mousePressed();
  return false;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  
  // 當窗口大小改變時，重新調整視頻尺寸
  if (video && videoReady) {
    let videoWidth = min(640, windowWidth);
    let videoHeight = min(480, windowHeight);
    video.size(videoWidth, videoHeight);
  }
}