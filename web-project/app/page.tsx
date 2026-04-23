"use client";

import { useState } from 'react';
import BreakoutGame from '@/components/BreakoutGame';
import Image from 'next/image';

export default function Home() {
  const [userName, setUserName] = useState('');
  const [isGameStarted, setIsGameStarted] = useState(false);

  const handleStart = () => {
    if (userName.trim()) {
      setIsGameStarted(true);
    } else {
      alert("이름을 입력해 주세요!");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      {!isGameStarted ? (
        /* Start Screen */
        <div className="w-full max-w-md glass-panel p-8 md:p-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="relative w-32 h-32 mx-auto mb-8 rounded-full overflow-hidden border-4 border-primary shadow-[0_0_30px_rgba(0,78,161,0.5)] animate-bounce-slow">
            <Image 
              src="/Mascot.jpg" 
              alt="INU Mascot" 
              fill
              className="object-cover"
            />
          </div>
          
          <h1 className="text-4xl font-extrabold mb-8 tracking-tighter bg-gradient-to-r from-white to-secondary bg-clip-text text-transparent">
            INU 벽돌깨기
          </h1>

          <div className="flex flex-col gap-4 mb-8">
            <div className="text-left">
              <label htmlFor="name" className="text-xs text-white/50 ml-2 mb-1 block">USER NAME</label>
              <input 
                id="name"
                type="text" 
                placeholder="이름을 입력하세요"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-secondary focus:bg-white/10 transition-all font-semibold"
              />
            </div>
            
            <button 
              onClick={handleStart}
              className="w-full bg-gradient-to-r from-primary to-secondary py-4 rounded-xl font-bold text-lg hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20"
            >
                게임 시작
            </button>
          </div>

          <footer className="mt-8 pt-8 border-t border-white/5">
            <p className="text-sm text-white/40">디자인학부 / 202301910 / 최유정</p>
          </footer>
        </div>
      ) : (
        /* Game Screen */
        <div className="w-full flex flex-col items-center animate-in fade-in zoom-in-95 duration-700">
           <BreakoutGame 
              playerName={userName} 
              onQuit={() => {
                setIsGameStarted(false);
                setUserName(''); // Clear name on quit if desired
              }} 
           />
        </div>
      )}

      {/* Style for custom animation */}
      <style jsx global>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 4s ease-in-out infinite;
        }
        .flex-center {
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>
    </main>
  );
}
