import React, { useEffect, useRef } from 'react';

/* ─────────────────────────────────────────────
   ANIMATED BACKGROUND — VERKING SCOLAIRE
   Floating gradient orbs + particles canvas
───────────────────────────────────────────── */

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
};

const PARTICLE_COLORS = ['#1A3C6E', '#0EA5E9', '#F57C00', '#FFB300', '#1D4ED8', '#7C3AED'];

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let W = window.innerWidth;
    let H = window.innerHeight;
    let particles: Particle[] = [];

    function resize() {
      W = canvas!.width = window.innerWidth;
      H = canvas!.height = window.innerHeight;
    }

    function spawn(): Particle {
      const maxLife = 180 + Math.random() * 240;
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: 1.2 + Math.random() * 2.2,
        color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
        alpha: 0,
        life: 0,
        maxLife,
      };
    }

    function init() {
      particles = Array.from({ length: 80 }, spawn);
    }

    function draw() {
      ctx!.clearRect(0, 0, W, H);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;

        const t = p.life / p.maxLife;
        p.alpha = (t < 0.15 ? t / 0.15 : t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1) * 0.55;

        if (p.life >= p.maxLife) {
          particles[i] = spawn();
          continue;
        }

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = p.color;
        ctx!.globalAlpha = p.alpha;
        ctx!.fill();
      }

      ctx!.globalAlpha = 1;
      animId = requestAnimationFrame(draw);
    }

    resize();
    init();
    draw();

    function onResize() {
      resize();
      init();
    }

    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <>
      <style>{`
        @keyframes vk-blob1 {
          0%   { transform: translate(0, 0) scale(1); }
          33%  { transform: translate(60px, -80px) scale(1.15); }
          66%  { transform: translate(-40px, 60px) scale(0.9); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes vk-blob2 {
          0%   { transform: translate(0, 0) scale(1); }
          40%  { transform: translate(-70px, 50px) scale(1.2); }
          80%  { transform: translate(50px, -60px) scale(0.85); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes vk-blob3 {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(80px, 70px) scale(1.1); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes vk-blob4 {
          0%   { transform: translate(0, 0) scale(1) rotate(0deg); }
          60%  { transform: translate(-50px, -40px) scale(1.25) rotate(30deg); }
          100% { transform: translate(0, 0) scale(1) rotate(0deg); }
        }
        @keyframes vk-grid-shift {
          0%   { background-position: 0 0; }
          100% { background-position: 40px 40px; }
        }
        @keyframes vk-shimmer {
          0%   { opacity: 0.03; }
          50%  { opacity: 0.07; }
          100% { opacity: 0.03; }
        }
        @keyframes vk-ray {
          0%   { transform: translateX(-120%) skewX(-20deg); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateX(220vw) skewX(-20deg); opacity: 0; }
        }
      `}</style>

      <div
        className="fixed inset-0 overflow-hidden pointer-events-none"
        style={{ zIndex: 0 }}
        aria-hidden="true"
      >
        {/* Base gradient */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(160deg, #f0f5ff 0%, #faf8ff 30%, #fff7ee 60%, #f0f7ff 100%)',
          }}
        />

        {/* Blob 1 — Deep Navy */}
        <div
          className="absolute rounded-full"
          style={{
            width: 700, height: 700,
            top: '-15%', left: '-10%',
            background: 'radial-gradient(circle, rgba(26,60,110,0.18) 0%, rgba(26,60,110,0) 70%)',
            animation: 'vk-blob1 18s ease-in-out infinite',
            filter: 'blur(2px)',
          }}
        />

        {/* Blob 2 — Electric Blue */}
        <div
          className="absolute rounded-full"
          style={{
            width: 600, height: 600,
            top: '20%', right: '-8%',
            background: 'radial-gradient(circle, rgba(14,165,233,0.14) 0%, rgba(14,165,233,0) 70%)',
            animation: 'vk-blob2 22s ease-in-out infinite',
            filter: 'blur(2px)',
          }}
        />

        {/* Blob 3 — Orange */}
        <div
          className="absolute rounded-full"
          style={{
            width: 500, height: 500,
            bottom: '-5%', left: '25%',
            background: 'radial-gradient(circle, rgba(245,124,0,0.12) 0%, rgba(245,124,0,0) 70%)',
            animation: 'vk-blob3 26s ease-in-out infinite',
            filter: 'blur(2px)',
          }}
        />

        {/* Blob 4 — Purple */}
        <div
          className="absolute rounded-full"
          style={{
            width: 450, height: 450,
            bottom: '10%', right: '15%',
            background: 'radial-gradient(circle, rgba(124,58,237,0.10) 0%, rgba(124,58,237,0) 70%)',
            animation: 'vk-blob4 20s ease-in-out infinite',
            filter: 'blur(2px)',
          }}
        />

        {/* Blob 5 — Gold center */}
        <div
          className="absolute rounded-full"
          style={{
            width: 350, height: 350,
            top: '45%', left: '42%',
            background: 'radial-gradient(circle, rgba(255,179,0,0.08) 0%, rgba(255,179,0,0) 70%)',
            animation: 'vk-blob1 30s ease-in-out infinite reverse',
            filter: 'blur(2px)',
          }}
        />

        {/* Animated grid overlay */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(26,60,110,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(26,60,110,0.04) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            animation: 'vk-grid-shift 8s linear infinite',
          }}
        />

        {/* Dot grid */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(26,60,110,0.07) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            backgroundPosition: '14px 14px',
            animation: 'vk-shimmer 6s ease-in-out infinite',
          }}
        />

        {/* Light rays */}
        <div className="absolute inset-0 overflow-hidden">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="absolute top-0 bottom-0"
              style={{
                width: '8vw',
                left: `${10 + i * 35}%`,
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
                animation: `vk-ray ${14 + i * 6}s linear infinite`,
                animationDelay: `${i * 4}s`,
                transform: 'skewX(-20deg)',
              }}
            />
          ))}
        </div>

        {/* Canvas particles */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ opacity: 0.6 }}
        />

        {/* Edge vignette */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(240,245,255,0.5) 100%)',
          }}
        />
      </div>
    </>
  );
}
