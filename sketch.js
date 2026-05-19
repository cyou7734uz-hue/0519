let video, handPose;
let hands = [];

let gameState = "start";

let playerMove = "等待中";
let computerMove = "等待中";
let resultText = "";

let playerScore = 0;
let computerScore = 0;

let countdown = 3;
let countdownStart;

// 用於計算影像縮放與偏移的變數，確保手部點位繪製能對齊畫面
let vW, vH, vX, vY;

function preload() {
  handPose = ml5.handPose({ flipped: true });
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  video = createCapture(VIDEO, { flipped: true });
  video.size(640, 480);
  video.hide();

  handPose.detectStart(video, gotHands);

  textAlign(CENTER, CENTER);
  rectMode(CENTER);
}

function gotHands(results) {
  hands = results;
}

function draw() {
  background(20);

  if (video.width > 0) { // 確保攝影機已啟動
  drawVideoFit();
    drawHand();
  }

  drawTopBar();

  if (gameState === "start") {
    startPage();
  } else if (gameState === "countdown") {
    countdownPage();
  } else if (gameState === "result") {
    resultPage();
  }
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

  image(video, vX, vY, vW, vH);
}

function drawTopBar() {
  fill(0, 150);
  rect(width / 2, 30, width, 60);

  fill(255);
  textSize(getSize(22, 18, 28));
  text("你：" + playerScore + "   電腦：" + computerScore, width / 2, 30);
}

function startPage() {
  fill(0, 180);
  rect(width / 2, height / 2, width, height);

  fill(255);
  textSize(getSize(52, 36, 64));
  text("剪刀石頭布", width / 2, height * 0.36);

  textSize(getSize(24, 18, 30));
  text("點按畫面開始", width / 2, height * 0.46);

  drawButton(width / 2, height * 0.65, "開始");
}

function countdownPage() {
  let elapsed = floor((millis() - countdownStart) / 1000);
  countdown = 3 - elapsed;

  fill(0, 180);
  rect(width / 2, height / 2, width, height);

  fill(255);
  textSize(getSize(100, 70, 130));

  if (countdown > 0) {
    text(countdown, width / 2, height / 2);
  } else {
    text("出拳！", width / 2, height / 2);

    if (elapsed >= 4) {
      playGame();
      gameState = "result";
    }
  }
}

function resultPage() {
  fill(0, 180);
  rect(width / 2, height - 110, width, 220);

  fill(255);
  textSize(getSize(28, 20, 34));
  text("你：" + playerMove, width / 2, height - 155);
  text("電腦：" + computerMove, width / 2, height - 115);

  textSize(getSize(42, 30, 54));
  text(resultText, width / 2, height - 65);

  showAnimation();
  drawButton(width / 2, height * 0.82, "再玩一次");
}

function playGame() {
  // 尋找第一個信心值足夠的手（參考範例代碼）
  let activeHand = hands.find(h => h.confidence > 0.1);

  if (activeHand) {
    playerMove = detectMove(activeHand);
  } else {
    playerMove = "沒偵測到";
  }

  computerMove = random(["剪刀", "石頭", "布"]);
  resultText = judge(playerMove, computerMove);
}

function detectMove(hand) {
  let kp = hand.keypoints;

  let indexUp = kp[8].y < kp[5].y;
  let middleUp = kp[12].y < kp[9].y;
  let ringUp = kp[16].y < kp[13].y;
  let pinkyUp = kp[20].y < kp[17].y;

  let count = 0;
  if (indexUp) count++;
  if (middleUp) count++;
  if (ringUp) count++;
  if (pinkyUp) count++;

  if (count >= 4) return "布";

  if (indexUp && middleUp && !ringUp && !pinkyUp) {
    return "剪刀";
  }

  if (count <= 1) return "石頭";

  return "不明";
}

function judge(player, computer) {
  if (player === "不明" || player === "沒偵測到") {
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
  // 遍歷所有偵測到的手
  for (let hand of hands) {
    // 只繪製信心值大於 0.1 的手，增加穩定性
    if (hand.confidence > 0.1) {
      // 根據左右手顯示不同顏色（參考範例代碼）
      if (hand.handedness === "Left") {
        fill(255, 0, 255);
      } else {
        fill(255, 255, 0);
      }
    noStroke();

      // 計算座標縮放比例
      let scaleX = vW / video.width;
      let scaleY = vH / video.height;

    for (let point of hand.keypoints) {
        // 將點位從影像空間座標轉換到畫布顯示座標
        circle(vX + point.x * scaleX, vY + point.y * scaleY, getSize(10, 8, 14));
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

function mousePressed() {
  if (gameState === "start" || gameState === "result") {
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
}