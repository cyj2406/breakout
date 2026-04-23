"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';

const COLORS = {
    red: "#FFB3BA",
    orange: "#FFDFBA",
    yellow: "#FFFFBA",
    green: "#BAFFC9",
    blue: "#BAE1FF",
    purple: "#E0BBE4"
};

const BRICK_ROWS = 5;
const BRICK_COLS = 8;
const BRICK_WIDTH = 70;
const BRICK_HEIGHT = 20;
const BRICK_PADDING = 8;
const BALL_SPEED = 4;
const PADDLE_SPEED = 6;
const WIN_THRESHOLD = 3; // 3개를 깨면 승리

const CANVAS_WIDTH = 700;
const CANVAS_HEIGHT = 500;

const BRICKS_TOTAL_WIDTH = (BRICK_COLS * BRICK_WIDTH) + ((BRICK_COLS - 1) * BRICK_PADDING);
const BRICKS_OFFSET_X = (CANVAS_WIDTH - BRICKS_TOTAL_WIDTH) / 2;
const BRICKS_OFFSET_Y = 60;

// 배포하신 웹 앱 URL
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxIVF-yhPFBhL4TLAvqUIiNVUkOz6-nSYcIRGn89thqneXrw_c9Bm7AVQUB7W1wPE1v/exec"; 

interface RankingEntry { name: string; time: number; formattedTime: string; }

export default function BreakoutGame({ playerName, onQuit }: { playerName: string; onQuit: () => void }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fwCanvasRef = useRef<HTMLCanvasElement>(null); 
    const audioContextRef = useRef<AudioContext | null>(null);
    const bgmRef = useRef<HTMLAudioElement | null>(null);

    const [lives, setLives] = useState(3);
    const [timeMs, setTimeMs] = useState(0); 
    const [redBricksDestroyed, setRedBricksDestroyed] = useState(0);
    const [gameState, setGameState] = useState<'COUNTDOWN' | 'PLAYING' | 'PAUSED' | 'GAMEOVER' | 'WIN' | 'RESPAWN_WAIT'>('COUNTDOWN');
    const [countdown, setCountdown] = useState(3);
    const [rankings, setRankings] = useState<RankingEntry[]>([]);

    const stateRef = useRef(gameState);
    const timeMsRef = useRef(0);
    const redBricksRef = useRef(0); // 즉시 판정을 위한 REF
    const isSavedRef = useRef(false); 
    const ballRef = useRef({ x: CANVAS_WIDTH / 2, y: 445, dx: 0, dy: 0, radius: 8 });
    const paddleRef = useRef({ x: (CANVAS_WIDTH - 100) / 2, width: 100, height: 12 });
    const keysRef = useRef({ left: false, right: false });
    const bricksRef = useRef<any[]>([]);
    const thumbsUpRef = useRef<any[]>([]);
    const fwParticlesRef = useRef<any[]>([]);
    const requestRef = useRef<number>(0);
    const fwRequestRef = useRef<number>(0);
    const lastTickRef = useRef<number>(0);

    const syncState = (newState: typeof gameState) => {
        stateRef.current = newState;
        setGameState(newState);
    };

    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    // --- Sound Logic ---
    const playBeep = (freq: number = 440, type: OscillatorType = 'sine', duration: number = 0.1) => {
        try {
            if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            const ctx = audioContextRef.current;
            if (ctx.state === 'suspended') ctx.resume();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(); osc.stop(ctx.currentTime + duration);
        } catch (e) {}
    };

    const startBGM = () => {
        if (!bgmRef.current) {
            const audio = new Audio('/Hyper_Speed_Run.mp3');
            audio.volume = 0.2; audio.loop = true;
            bgmRef.current = audio;
        }
        bgmRef.current?.play().catch(() => {});
    };

    const stopBGM = () => {
        bgmRef.current?.pause();
        if (bgmRef.current) bgmRef.current.currentTime = 0;
    };

    // --- Firework ---
    const createFirework = (x: number, y: number) => {
        const colors = ['#ff0044', '#00ffcc', '#ffff00', '#ff00ff', '#ffffff', '#00aaff'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        for (let i = 0; i < 40; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 5;
            fwParticlesRef.current.push({ x, y, dx: Math.cos(angle)*speed, dy: Math.sin(angle)*speed, color, life: 1.0, decay: 0.01+Math.random()*0.02, size: 2+Math.random()*2 });
        }
    };

    const updateFireworks = () => {
        const ctx = fwCanvasRef.current?.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        if (stateRef.current === 'WIN' && Math.random() < 0.05) {
            createFirework(Math.random() * CANVAS_WIDTH, Math.random() * (CANVAS_HEIGHT * 0.6));
        }
        fwParticlesRef.current = fwParticlesRef.current.map(p => ({ ...p, x: p.x+p.dx, y: p.y+p.dy, dy: p.dy+0.05, life: p.life-p.decay })).filter(p => p.life > 0);
        fwParticlesRef.current.forEach(p => {
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.globalAlpha = p.life; ctx.fill();
        });
        fwRequestRef.current = requestAnimationFrame(updateFireworks);
    };

    // --- Ranking & Data ---
    const loadRankings = useCallback(async () => {
        const parseTimeValue = (val: any) => {
            if (!val) return 9999999;
            const s = String(val);
            if (s.includes(':')) {
                const p = s.split(':');
                const mins = parseInt(p[p.length - 2]) || 0;
                const secs = parseInt(p[p.length - 1]) || 0;
                return (mins * 60 + secs) * 1000;
            }
            return parseInt(s) || 9999999;
        };
        try {
            const res = await fetch(GOOGLE_SCRIPT_URL);
            if (res.ok) {
                const cloud = await res.json();
                if (Array.isArray(cloud)) {
                    const normalized = cloud.map(r => {
                        const ms = parseTimeValue(r.formattedTime || r.time);
                        return { name: r.name || "Unknown", time: ms, formattedTime: formatTime(ms) };
                    }).sort((a, b) => a.time - b.time).slice(0, 3);
                    setRankings(normalized);
                }
            }
        } catch (e) {}
    }, []);

    const saveRecord = useCallback(async () => {
        if (isSavedRef.current) return;
        isSavedRef.current = true;
        
        const finalMs = timeMsRef.current;
        const name = playerName?.trim() || "Anonymous";
        const formatted = formatTime(finalMs);
        
        try {
            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, formattedTime: formatted })
            });
            setTimeout(loadRankings, 2000);
        } catch (e) { isSavedRef.current = false; }
    }, [playerName, loadRankings]);

    // --- Game Logic ---
    const updateGame = (time: number) => {
        const ball = ballRef.current;
        const paddle = paddleRef.current;
        
        if (stateRef.current === 'PLAYING') {
            const dt = lastTickRef.current ? time - lastTickRef.current : 0;
            timeMsRef.current += dt;
            if (Math.floor(timeMsRef.current / 100) !== Math.floor((timeMsRef.current - dt) / 100)) {
                setTimeMs(timeMsRef.current);
            }
            lastTickRef.current = time;
        } else { lastTickRef.current = 0; }

        if (stateRef.current === 'PLAYING' || stateRef.current === 'COUNTDOWN' || stateRef.current === 'RESPAWN_WAIT') {
            if (keysRef.current.left) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED);
            if (keysRef.current.right) paddle.x = Math.min(CANVAS_WIDTH - paddle.width, paddle.x + PADDLE_SPEED);
        }

        if (stateRef.current === 'COUNTDOWN' || stateRef.current === 'RESPAWN_WAIT') {
            ball.x = paddle.x + paddle.width / 2; ball.y = CANVAS_HEIGHT - 55;
            return;
        }

        if (stateRef.current !== 'PLAYING') return;

        ball.x += ball.dx; ball.y += ball.dy;
        if (ball.x + ball.radius > CANVAS_WIDTH || ball.x - ball.radius < 0) { ball.dx = -ball.dx; playBeep(300, 'square', 0.05); }
        if (ball.y - ball.radius < 0) { ball.dy = -ball.dy; playBeep(300, 'square', 0.05); } 
        else if (ball.y + ball.radius > CANVAS_HEIGHT - 45) {
            if (ball.x > paddle.x && ball.x < paddle.x + paddle.width) {
                ball.dy = -Math.abs(ball.dy);
                const hit = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
                ball.dx = hit * BALL_SPEED;
                const mag = Math.sqrt(ball.dx**2 + ball.dy**2);
                ball.dx = (ball.dx/mag)*BALL_SPEED; ball.dy = (ball.dy/mag)*BALL_SPEED;
                playBeep(440, 'triangle', 0.1);
            } else if (ball.y + ball.radius > CANVAS_HEIGHT) {
                setLives(l => {
                    if (l <= 1) { syncState('GAMEOVER'); stopBGM(); return 0; }
                    syncState('RESPAWN_WAIT'); return l - 1;
                });
            }
        }

        bricksRef.current.forEach(b => {
            if (b.status === 1) {
                const bx = BRICKS_OFFSET_X + b.col * (BRICK_WIDTH + BRICK_PADDING);
                const by = BRICKS_OFFSET_Y + b.row * (BRICK_HEIGHT + BRICK_PADDING);
                if (ball.x > bx && ball.x < bx + BRICK_WIDTH && ball.y > by && ball.y < by + BRICK_HEIGHT) {
                    ball.dy = -ball.dy; b.status = 0;
                    thumbsUpRef.current.push({ x: bx + BRICK_WIDTH / 2, y: by, opacity: 1 });
                    playBeep(600 + b.row * 50, 'sine', 0.15); 
                    if (b.color === COLORS.red) {
                        redBricksRef.current += 1;
                        setRedBricksDestroyed(redBricksRef.current);
                        
                        if (redBricksRef.current >= WIN_THRESHOLD) {
                            syncState('WIN');
                            stopBGM();
                            createFirework(CANVAS_WIDTH/2, CANVAS_HEIGHT/2);
                            saveRecord();
                        }
                    }
                }
            }
        });

        thumbsUpRef.current = thumbsUpRef.current.map(t => ({ ...t, y: t.y - 1, opacity: t.opacity - 0.02 })).filter(t => t.opacity > 0);
    };

    const drawGame = (time: number) => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        bricksRef.current.forEach(b => { if (b.status === 1) {
            const bx = BRICKS_OFFSET_X + b.col * (BRICK_WIDTH+BRICK_PADDING), by = BRICKS_OFFSET_Y + b.row * (BRICK_HEIGHT+BRICK_PADDING);
            ctx.beginPath(); ctx.roundRect(bx, by, BRICK_WIDTH, BRICK_HEIGHT, 5); ctx.fillStyle = b.color; ctx.fill();
        }});
        ctx.beginPath();
        const grad = ctx.createLinearGradient(paddleRef.current.x, CANVAS_HEIGHT-55, paddleRef.current.x, CANVAS_HEIGHT-43);
        grad.addColorStop(0, '#8EBFFF'); grad.addColorStop(1, '#5E9EFF');
        ctx.roundRect(paddleRef.current.x, CANVAS_HEIGHT-55, paddleRef.current.width, paddleRef.current.height, 6);
        ctx.fillStyle = grad; ctx.fill();
        if (stateRef.current !== 'WIN' && stateRef.current !== 'GAMEOVER') {
            ctx.beginPath(); ctx.arc(ballRef.current.x, ballRef.current.y, ballRef.current.radius, 0, Math.PI*2);
            ctx.fillStyle = "white"; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
        }
        updateGame(time);
        requestRef.current = requestAnimationFrame(drawGame);
    };

    const handleTouch = (e: React.TouchEvent) => {
        if (!canvasRef.current || stateRef.current !== 'PLAYING') return;
        const rect = canvasRef.current.getBoundingClientRect();
        const touchX = e.touches[0].clientX - rect.left;
        const scaleX = CANVAS_WIDTH / rect.width;
        const targetX = (touchX * scaleX) - (paddleRef.current.width / 2);
        paddleRef.current.x = Math.max(0, Math.min(CANVAS_WIDTH - paddleRef.current.width, targetX));
    };

    useEffect(() => {
        const nb = []; let rc = 0;
        for (let r=0; r<BRICK_ROWS; r++) for (let c=0; c<BRICK_COLS; c++) {
            let color = [COLORS.orange, COLORS.yellow, COLORS.green, COLORS.blue, COLORS.purple][Math.floor(Math.random()*5)];
            if (rc < 12 && Math.random() < 0.3) { color = COLORS.red; rc++; }
            nb.push({ col: c, row: r, color, status: 1 });
        }
        bricksRef.current = nb;
        requestRef.current = requestAnimationFrame(drawGame);
        fwRequestRef.current = requestAnimationFrame(updateFireworks);
        loadRankings();
        return () => { cancelAnimationFrame(requestRef.current); cancelAnimationFrame(fwRequestRef.current); stopBGM(); };
    }, []);

    useEffect(() => {
        if (gameState === 'COUNTDOWN') {
            if (countdown === 3) startBGM();
            const t = countdown > 0 ? setTimeout(() => { setCountdown(c => c - 1); playBeep(220); }, 1000) : null;
            if (countdown === 0) { syncState('PLAYING'); ballRef.current.dx = 2; ballRef.current.dy = -BALL_SPEED; }
            return () => { if (t) clearTimeout(t); };
        } else if (gameState === 'RESPAWN_WAIT') {
            const t = setTimeout(() => { syncState('PLAYING'); ballRef.current.dx = 2; ballRef.current.dy = -BALL_SPEED; }, 800);
            return () => clearTimeout(t);
        }
    }, [gameState, countdown]);

    useEffect(() => {
        const hk = (e: KeyboardEvent, v: boolean) => {
            if (e.key === 'ArrowLeft') keysRef.current.left = v;
            if (e.key === 'ArrowRight') keysRef.current.right = v;
        };
        window.addEventListener('keydown', (e) => hk(e, true));
        window.addEventListener('keyup', (e) => hk(e, false));
        return () => { window.removeEventListener('keydown', (e) => hk(e, true)); window.removeEventListener('keyup', (e) => hk(e, false)); };
    }, []);

    return (
        <div className="flex flex-col items-center w-full min-h-screen py-4 md:py-8 touch-none select-none overflow-hidden bg-black text-white">
            {/* Top Bar */}
            <div className="w-[95%] max-w-[700px] flex justify-between items-center bg-white/5 backdrop-blur-3xl border border-white/10 px-4 py-3 rounded-[1.5rem] mb-4 shadow-2xl">
                <div className="flex flex-col"><span className="text-[8px] md:text-[10px] text-white/30 uppercase font-black tracking-widest">Lives</span>
                    <div className="flex gap-1">{[...Array(3)].map((_, i) => (<span key={i} className={`text-xs md:text-sm ${i < lives ? 'opacity-100' : 'opacity-10'}`}>❤️</span>))}</div>
                </div>
                <div className="flex flex-col items-center"><span className="text-[8px] md:text-[10px] text-white/30 uppercase font-black">Time</span><span className="font-mono text-xl md:text-2xl font-black text-red-500">{formatTime(timeMs)}</span></div>
                <div className="flex flex-col items-end"><span className="text-[8px] md:text-[10px] text-white/30 uppercase font-black">Cores</span><span className="text-xl md:text-2xl font-black text-green-400 italic">{redBricksDestroyed}/3</span></div>
            </div>

            {/* Game Area */}
            <div className="relative w-[95%] max-w-[700px] aspect-[7/5] bg-[#0c0c14] rounded-[2rem] overflow-hidden border border-white/5 shadow-2xl touch-none"
                 onTouchMove={handleTouch} onTouchStart={handleTouch}>
                <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="absolute inset-0 w-full h-full" />
                <canvas ref={fwCanvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="absolute inset-0 w-full h-full pointer-events-none z-50" />
                
                {gameState === 'COUNTDOWN' && (<div className="absolute inset-0 flex items-center justify-center z-10"><span className="text-7xl md:text-9xl font-black italic text-white animate-pulse">{countdown > 0 ? countdown : 'GO'}</span></div>)}
                
                {(gameState === 'GAMEOVER' || gameState === 'WIN') && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/95 backdrop-blur-3xl z-40 p-4 animate-in fade-in duration-500">
                        <div className="w-full flex flex-col items-center gap-4 text-center">
                            <h2 className={`text-4xl md:text-5xl font-black italic ${gameState === 'WIN' ? 'text-green-400' : 'text-red-500'}`}>{gameState === 'WIN' ? 'SUCCESS' : 'FAILED'}</h2>
                            {gameState === 'WIN' && (
                                <>
                                    <div className="flex flex-col"><span className="text-[9px] text-white/50 uppercase font-bold tracking-widest">Your Record</span><span className="text-5xl md:text-6xl font-black text-white font-mono">{formatTime(timeMs)}</span></div>
                                    <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-4">
                                        <h3 className="text-[8px] text-white/20 uppercase mb-2 tracking-widest">Hall of Fame</h3>
                                        <div className="space-y-2">
                                            {rankings.map((r, i) => (
                                                <div key={i} className="flex justify-between items-center px-4 py-2 bg-white/5 rounded-lg text-sm">
                                                    <span className="font-bold text-white/80">{i+1}. {r.name}</span>
                                                    <span className="font-mono text-primary">{r.formattedTime}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                            <button onClick={() => window.location.reload()} className="bg-white text-black px-12 py-4 rounded-xl font-black text-lg hover:scale-105 active:scale-95 transition-all w-full max-w-[240px]">RESTART</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="flex gap-2 mt-6 w-[95%] max-w-[700px]">
                <button onClick={() => syncState(gameState === 'PLAYING' ? 'PAUSED' : gameState === 'PAUSED' ? 'PLAYING' : gameState)} className="flex-[2] py-4 rounded-xl border bg-white/5 border-white/10 text-[10px] font-black text-white/40 uppercase">
                    {gameState === 'PAUSED' ? '▶ RESUME' : '|| PAUSE'}
                </button>
                <button onClick={() => window.location.reload()} className="flex-1 py-4 rounded-xl border bg-white/5 border-white/10 text-[10px] font-black text-white/40 uppercase">↺ RESET</button>
                <button onClick={onQuit} className="flex-1 py-4 rounded-xl border bg-red-500/10 border-red-500/20 text-[10px] font-black text-red-500/40 uppercase">✕ EXIT</button>
            </div>
            <p className="mt-8 text-[8px] text-white/10 font-black uppercase tracking-widest text-center">Design Dept / ID 202301910 / Choi Yu-Jeong</p>
        </div>
    );
}
