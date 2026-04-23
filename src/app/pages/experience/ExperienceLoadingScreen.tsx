import React, { useEffect, useState } from 'react';

interface Props {
  onEnter: (lang: 'fr' | 'ar') => void;
  dataReady: boolean;
}

export function ExperienceLoadingScreen({ onEnter, dataReady }: Props) {
  const [progress, setProgress] = useState(0);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        const increment = dataReady ? Math.random() * 12 + 8 : Math.random() * 6 + 2;
        return Math.min(prev + increment, dataReady ? 100 : 88);
      });
    }, 120);
    return () => clearInterval(interval);
  }, [dataReady]);

  useEffect(() => {
    if (progress >= 100) {
      const timer = setTimeout(() => setShowLangPicker(true), 400);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [progress]);

  const handlePick = (lang: 'fr' | 'ar') => {
    setFadeOut(true);
    setTimeout(() => onEnter(lang), 600);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center select-none"
      style={{
        background: 'radial-gradient(ellipse at 50% 30%, #1a1f3a 0%, #0a0c1a 60%, #000 100%)',
        transition: 'opacity 0.6s ease',
        opacity: fadeOut ? 0 : 1,
      }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        {Array.from({ length: 60 }).map((_, index) => (
          <div
            key={index}
            className="absolute rounded-full bg-white"
            style={{
              width: Math.random() * 2 + 1,
              height: Math.random() * 2 + 1,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.6 + 0.1,
              animation: `pulse ${Math.random() * 3 + 2}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 text-center px-6">
        <div className="flex flex-col items-center gap-2">
          <div style={{ fontFamily: 'Montserrat, sans-serif' }}>
            <span
              className="font-black text-5xl md:text-7xl tracking-tight block text-center"
              style={{
                background: 'linear-gradient(135deg, #5baeff 0%, #2060d0 55%, #4499ff 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 0 30px rgba(80,150,255,0.5))',
              }}
            >
              VERKING
            </span>
          </div>

          <div className="flex items-center gap-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            <span
              className="font-black text-lg md:text-2xl tracking-[0.18em]"
              style={{
                background: 'linear-gradient(135deg, #FFD700 0%, #FFB300 60%, #FF8C00 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 0 16px rgba(255,180,0,0.5))',
              }}
            >
              S.T.P
            </span>
            <span className="w-px h-5 rounded-full bg-white/20" />
            <span
              className="font-semibold text-lg md:text-2xl tracking-[0.14em]"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              Stationery
            </span>
          </div>

          <div className="flex items-center gap-3 opacity-60 mt-1">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-white/40" />
            <span className="text-white/60 text-xs font-bold tracking-[0.3em] uppercase">
              Virtual Store · 3D Experience
            </span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-white/40" />
          </div>
        </div>

        {!showLangPicker && (
          <div className="w-64 md:w-80 space-y-2 mt-4">
            <div className="h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #E5252A, #FFD700)',
                  boxShadow: '0 0 12px rgba(229,37,42,0.6)',
                }}
              />
            </div>
            <p className="text-white/40 text-xs tracking-widest font-medium">
              {progress < 40 ? 'INITIALISATION...' : progress < 80 ? 'CHARGEMENT DE LA SCENE...' : 'PRESQUE PRET...'}
            </p>
          </div>
        )}

        {showLangPicker && (
          <div
            className="flex flex-col items-center gap-6 mt-2"
            style={{ animation: 'fadeInUp 0.5s ease forwards' }}
          >
            <p className="text-white/80 text-sm md:text-base font-medium tracking-wide">
              Choisissez votre langue · اختر لغتك
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => handlePick('fr')}
                className="group relative px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-[0.18em] text-white overflow-hidden transition-all duration-200 hover:scale-[1.05] active:scale-[0.97]"
                style={{
                  background: 'linear-gradient(135deg, #E5252A, #c41e23)',
                  boxShadow: '0 8px 32px rgba(229,37,42,0.4), 0 0 0 1px rgba(255,255,255,0.1) inset',
                }}
              >
                <span className="relative z-10 flex items-center gap-2">
                  <span className="text-lg">🇫🇷</span>
                  Francais
                </span>
              </button>
              <button
                onClick={() => handlePick('ar')}
                className="group relative px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-[0.18em] text-gray-900 overflow-hidden transition-all duration-200 hover:scale-[1.05] active:scale-[0.97]"
                style={{
                  background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                  boxShadow: '0 8px 32px rgba(255,180,0,0.4), 0 0 0 1px rgba(255,255,255,0.2) inset',
                }}
              >
                <span className="relative z-10 flex items-center gap-2">
                  <span className="text-lg">🇩🇿</span>
                  العربية
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 opacity-20">
        <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
        <span className="text-white text-[10px] tracking-[0.4em] uppercase">
          S.T.P · Premium Stationery
        </span>
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
      </div>

      <style>
        {`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 0.1; }
            50% { opacity: 0.7; }
          }
        `}
      </style>
    </div>
  );
}
