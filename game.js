/**
 * INU Breakout Game - Vanilla Version
 * Author: 최유정
 */

const startBtn = document.getElementById('start-btn');
const startScreen = document.getElementById('start-screen');
const gameUI = document.getElementById('game-ui');
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// UI Elements
const livesDisplay = document.getElementById('lives-display');
const timerDisplay = document.getElementById('timer-display');
const redCountDisplay = document.getElementById('red-count-display');
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownText = document.getElementById('countdown-text');
const resultOverlay = document.getElementById('result-overlay');
const resultTitle = document.getElementById('result-title');
const resultInfo = document.getElementById('result-info');

// Buttons
const pauseBtn = document.getElementById('pause-btn');
const restartBtn = document.getElementById('restart-btn');
const endBtn = document.getElementById('end-btn');

// Game Constants
const ROWS = 5;
const COLS = 8;
const MAX_RED_BLOCKS = 12;
const WIN_RED_COUNT = 3;
const COLORS = {
    red: '#FFB3BA',
    orange: '#FFDFBA',
    yellow: '#FFFFBA',
    green: '#BAFFC9',
    blue: '#BAE1FF',
    purple: '#E0BBE4'
};

// Game State
let lives = 3;
let score = 0;
let redBricksDestroyed = 0;
let time = 0;
let isPlaying = false;
let isPaused = false;
let timerInterval = null;
let playerName = "";

// Audio Context (Web Audio API)
let audioCtx = null;
function playBeep(freq = 440, duration = 0.1) {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

// Entities
let ball = { x: 0, y: 0, dx: 0, dy: 0, radius: 7 };
let paddle = { x: 0, width: 90, height: 12 };
let bricks = [];

function initBricks() {
    bricks = [];
    let redCount = 0;
    const others = [COLORS.orange, COLORS.yellow, COLORS.green, COLORS.blue, COLORS.purple];
    
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            let color = "";
            const currentTotal = r * COLS + c;
            const remaining = (ROWS * COLS) - currentTotal;
            const needed = MAX_RED_BLOCKS - redCount;

            if (needed > 0 && (Math.random() < needed / remaining || needed === remaining)) {
                color = COLORS.red;
                redCount++;
            } else {
                color = others[Math.floor(Math.random() * others.length)];
            }
            bricks.push({ r, c, color, status: 1 });
        }
    }
}

function resize() {
    const containerWidth = document.getElementById('app').clientWidth;
    canvas.width = Math.min(containerWidth - 40, 400);
    canvas.height = 500;
}

function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height - 35;
    ball.dx = 0;
    ball.dy = 0;
}

function startCountdown() {
    let count = 3;
    countdownOverlay.style.display = 'flex';
    countdownText.innerText = count;
    
    const interval = setInterval(() => {
        count--;
        if (count > 0) {
            countdownText.innerText = count;
        } else {
            clearInterval(interval);
            countdownOverlay.style.display = 'none';
            launchBall();
        }
    }, 1000);
}

function launchBall() {
    isPlaying = true;
    ball.dx = (Math.random() - 0.5) * 8;
    ball.dy = -5;
    
    timerInterval = setInterval(() => {
        if (!isPaused) {
            time++;
            const m = Math.floor(time / 60);
            const s = time % 60;
            timerDisplay.innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
        }
    }, 1000);
}

function gameOver(win = false) {
    isPlaying = false;
    clearInterval(timerInterval);
    resultOverlay.style.display = 'flex';
    resultTitle.innerText = win ? "🎉 WIN!" : "💀 GAME OVER";
    resultTitle.style.color = win ? "#BAFFC9" : "#FF6B6B";
    resultInfo.innerText = `${playerName}님, 파괴한 빨강블록: ${redBricksDestroyed}개`;
}

// Draw Functions
function drawBall() {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.closePath();
}

function drawPaddle() {
    ctx.beginPath();
    ctx.roundRect(paddle.x, canvas.height - 20, paddle.width, paddle.height, 6);
    ctx.fillStyle = "#00c6ff";
    ctx.fill();
    ctx.closePath();
}

function drawBricks() {
    const bWidth = (canvas.width - 60) / COLS;
    const bHeight = 18;
    const padding = 5;
    const offsetLeft = 30;
    const offsetTop = 60;

    bricks.forEach(b => {
        if (b.status === 1) {
            const bx = b.c * (bWidth + padding) + offsetLeft;
            const by = b.r * (bHeight + padding) + offsetTop;
            
            ctx.beginPath();
            ctx.roundRect(bx, by, bWidth, bHeight, 4);
            ctx.fillStyle = b.color;
            ctx.fill();
            if (b.color === COLORS.red) {
                ctx.strokeStyle = "rgba(255,255,255,0.4)";
                ctx.stroke();
            }
            ctx.closePath();

            // Collision Detection
            if (ball.x > bx && ball.x < bx + bWidth && ball.y > by && ball.y < by + bHeight) {
                ball.dy = -ball.dy;
                b.status = 0;
                playBeep(600, 0.05);
                if (b.color === COLORS.red) {
                    redBricksDestroyed++;
                    redCountDisplay.innerText = `${redBricksDestroyed} / 3`;
                    if (redBricksDestroyed >= WIN_RED_COUNT) {
                        gameOver(true);
                    }
                }
            }
        }
    });
}

function update() {
    if (!isPlaying || isPaused) return;

    ball.x += ball.dx;
    ball.y += ball.dy;

    // Walls
    if (ball.x + ball.radius > canvas.width || ball.x - ball.radius < 0) {
        ball.dx = -ball.dx;
        playBeep(300, 0.03);
    }
    if (ball.y - ball.radius < 0) {
        ball.dy = -ball.dy;
        playBeep(300, 0.03);
    } else if (ball.y + ball.radius > canvas.height - 20) {
        if (ball.x > paddle.x && ball.x < paddle.x + paddle.width) {
            ball.dy = -Math.abs(ball.dy);
            const mid = paddle.x + paddle.width / 2;
            ball.dx = (ball.x - mid) / (paddle.width / 2) * 6;
            playBeep(440, 0.05);
        } else if (ball.y + ball.radius > canvas.height) {
            lives--;
            livesDisplay.innerText = lives;
            if (lives <= 0) {
                gameOver(false);
            } else {
                resetBall();
                isPlaying = false;
                setTimeout(launchBall, 1000);
            }
        }
    }
}

function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBricks();
    drawBall();
    drawPaddle();
    update();
    requestAnimationFrame(loop);
}

// Events
startBtn.addEventListener('click', () => {
    playerName = document.getElementById('username').value.trim() || "User";
    startScreen.style.display = 'none';
    gameUI.style.display = 'block';
    resize();
    initBricks();
    resetBall();
    startCountdown();
    loop();
});

document.addEventListener('keydown', (e) => {
    if (!isPlaying) return;
    const step = 25;
    if (e.key === 'ArrowLeft' || e.key === 'Left') {
        paddle.x = Math.max(0, paddle.x - step);
    } else if (e.key === 'ArrowRight' || e.key === 'Right') {
        paddle.x = Math.min(canvas.width - paddle.width, paddle.x + step);
    }
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const rx = touch.clientX - rect.left;
    const scale = canvas.width / rect.width;
    paddle.x = Math.max(0, Math.min(canvas.width - paddle.width, (rx * scale) - paddle.width / 2));
}, { passive: false });

pauseBtn.addEventListener('click', () => {
    isPaused = !isPaused;
    pauseBtn.innerText = isPaused ? "▶️ Resume" : "⏸️ Pause";
});

restartBtn.addEventListener('click', () => location.reload());
endBtn.addEventListener('click', () => gameOver(false));

window.addEventListener('resize', resize);
resize();
