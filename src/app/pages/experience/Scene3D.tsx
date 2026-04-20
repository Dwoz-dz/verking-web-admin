import React, { useRef, useMemo, useState, Suspense } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import {
  OrbitControls,
  Html,
  Text,
  Sparkles,
  Float,
  Environment,
  Stars,
} from '@react-three/drei';
import * as THREE from 'three';
import type { HotspotData } from './ProductPanel';

// ─── Brand palette ─────────────────────────────────────────────────────────
const BRAND = {
  red: new THREE.Color('#E5252A'),
  gold: new THREE.Color('#FFD700'),
  navy: new THREE.Color('#1A3C6E'),
  dark: new THREE.Color('#08090f'),
  white: new THREE.Color('#ffffff'),
};

// ─── Floor ─────────────────────────────────────────────────────────────────
function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[30, 26]} />
      <meshStandardMaterial
        color="#080a12"
        roughness={0.15}
        metalness={0.8}
        envMapIntensity={1.2}
      />
    </mesh>
  );
}

// ─── Grid overlay on floor ─────────────────────────────────────────────────
function FloorGrid() {
  return (
    <gridHelper
      args={[30, 30, '#1a2040', '#0e1428']}
      position={[0, 0.001, 0]}
    />
  );
}

// ─── Back wall with brand text ─────────────────────────────────────────────
function BackWall() {
  return (
    <group position={[0, 3.5, -12]}>
      {/* Wall face */}
      <mesh receiveShadow>
        <planeGeometry args={[28, 8]} />
        <meshStandardMaterial color="#050710" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Accent strip top */}
      <mesh position={[0, 3.8, 0.01]}>
        <planeGeometry args={[28, 0.06]} />
        <meshStandardMaterial color={BRAND.red} emissive={BRAND.red} emissiveIntensity={3} />
      </mesh>

      {/* Accent strip bottom */}
      <mesh position={[0, -3.8, 0.01]}>
        <planeGeometry args={[28, 0.06]} />
        <meshStandardMaterial color={BRAND.gold} emissive={BRAND.gold} emissiveIntensity={3} />
      </mesh>

      {/* Brand name — using drei's built-in default font */}
      <Text
        position={[-2, 0.8, 0.05]}
        fontSize={1.4}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
        maxWidth={20}
      >
        VERKING
      </Text>
      <Text
        position={[3.2, 0.8, 0.05]}
        fontSize={1.4}
        color="#FFD700"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
        maxWidth={20}
      >
        SCOLAIRE
      </Text>
      <Text
        position={[0, -0.6, 0.05]}
        fontSize={0.28}
        color="#ffffff"
        fillOpacity={0.35}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.32}
        maxWidth={20}
      >
        S.T.P · PREMIUM STATIONERY · VIRTUAL SHOWROOM
      </Text>
    </group>
  );
}

// ─── Side walls ────────────────────────────────────────────────────────────
function SideWalls() {
  return (
    <>
      {/* Left wall */}
      <mesh position={[-14, 3.5, -6]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[26, 8]} />
        <meshStandardMaterial color="#050710" roughness={0.9} metalness={0.05} />
      </mesh>
      {/* Right wall */}
      <mesh position={[14, 3.5, -6]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[26, 8]} />
        <meshStandardMaterial color="#050710" roughness={0.9} metalness={0.05} />
      </mesh>
    </>
  );
}

// ─── Ceiling ───────────────────────────────────────────────────────────────
function Ceiling() {
  return (
    <>
      <mesh position={[0, 7, -6]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[30, 26]} />
        <meshStandardMaterial color="#030408" roughness={1} />
      </mesh>
      {/* Strip lights */}
      {[-8, 0, 8].map((x) => (
        <mesh key={x} position={[x, 6.96, -6]}>
          <boxGeometry args={[0.2, 0.04, 20]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive={new THREE.Color('#cce8ff')}
            emissiveIntensity={4}
          />
        </mesh>
      ))}
    </>
  );
}

// ─── Animated ring hotspot marker ─────────────────────────────────────────
function HotspotRing({ color, onClick, label, lang }: {
  color: string;
  onClick: () => void;
  label: string;
  lang: 'fr' | 'ar';
}) {
  const ringRef = useRef<THREE.Mesh>(null!);
  const ring2Ref = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.8;
      ringRef.current.scale.setScalar(1 + Math.sin(t * 2) * 0.06);
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.z = -t * 0.5;
      ring2Ref.current.scale.setScalar(1 + Math.cos(t * 2) * 0.05);
    }
  });

  const threeColor = new THREE.Color(color);

  return (
    <group>
      {/* Outer ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.38, 0.48, 48]} />
        <meshStandardMaterial
          color={threeColor}
          emissive={threeColor}
          emissiveIntensity={3}
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Inner ring */}
      <mesh ref={ring2Ref} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.24, 0.3, 48]} />
        <meshStandardMaterial
          color={threeColor}
          emissive={threeColor}
          emissiveIntensity={2}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* HTML label */}
      <Html
        position={[0, 0.6, 0]}
        center
        zIndexRange={[1, 10]}
        distanceFactor={8}
      >
        <button
          onClick={onClick}
          className="group relative flex items-center gap-2 px-4 py-2 rounded-full font-black text-xs uppercase tracking-widest whitespace-nowrap cursor-pointer"
          style={{
            background: `linear-gradient(135deg, ${color}cc, ${color}88)`,
            border: `1px solid ${color}`,
            color: color === '#FFD700' || color === '#FFC107' ? '#111' : '#fff',
            boxShadow: `0 4px 20px ${color}50`,
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            transition: 'all 0.2s ease',
            pointerEvents: 'auto',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.12)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
        >
          <span style={{ fontSize: 14 }}>+</span>
          {label}
        </button>
      </Html>
    </group>
  );
}

// ─── Floating product shape ────────────────────────────────────────────────
function FloatingShape({ shapeIndex, color }: { shapeIndex: number; color: string }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const threeColor = new THREE.Color(color);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.5 + shapeIndex;
      meshRef.current.rotation.x = Math.sin(t * 0.3 + shapeIndex) * 0.2;
      meshRef.current.position.y = Math.sin(t * 0.8 + shapeIndex * 1.5) * 0.12;
    }
  });

  const shapes = [
    <icosahedronGeometry args={[0.5, 1]} />,
    <boxGeometry args={[0.65, 0.65, 0.65]} />,
    <octahedronGeometry args={[0.55, 0]} />,
    <dodecahedronGeometry args={[0.48, 0]} />,
    <tetrahedronGeometry args={[0.6, 0]} />,
    <torusGeometry args={[0.38, 0.14, 16, 48]} />,
  ];

  return (
    <mesh ref={meshRef} castShadow>
      {shapes[shapeIndex % shapes.length]}
      <meshStandardMaterial
        color={threeColor}
        emissive={threeColor}
        emissiveIntensity={0.6}
        roughness={0.2}
        metalness={0.7}
        envMapIntensity={1.5}
      />
    </mesh>
  );
}

// ─── Pedestal + shape + hotspot ───────────────────────────────────────────
function CategoryDisplay({
  position,
  hotspot,
  shapeIndex,
  lang,
  onHotspotClick,
}: {
  position: [number, number, number];
  hotspot: HotspotData;
  shapeIndex: number;
  lang: 'fr' | 'ar';
  onHotspotClick: (h: HotspotData) => void;
}) {
  const label = lang === 'ar' ? hotspot.label_ar : hotspot.label_fr;
  const color = hotspot.color;
  const threeColor = new THREE.Color(color);

  return (
    <group position={position}>
      {/* Glow disc on floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[1.2, 64]} />
        <meshStandardMaterial
          color={threeColor}
          emissive={threeColor}
          emissiveIntensity={0.4}
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Pedestal base disc */}
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.6, 64]} />
        <meshStandardMaterial
          color={threeColor}
          emissive={threeColor}
          emissiveIntensity={1.5}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Pedestal cylinder */}
      <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.42, 0.54, 0.7, 32]} />
        <meshStandardMaterial
          color="#0d1020"
          roughness={0.3}
          metalness={0.9}
          envMapIntensity={1}
        />
      </mesh>

      {/* Pedestal top cap with color accent */}
      <mesh position={[0, 0.72, 0]}>
        <cylinderGeometry args={[0.44, 0.44, 0.04, 32]} />
        <meshStandardMaterial
          color={threeColor}
          emissive={threeColor}
          emissiveIntensity={2}
        />
      </mesh>

      {/* Floating shape */}
      <group position={[0, 1.5, 0]}>
        <FloatingShape shapeIndex={shapeIndex} color={color} />
      </group>

      {/* Hotspot ring + label (slightly above shape) */}
      <group position={[0, 2.4, 0]}>
        <HotspotRing
          color={color}
          label={`${hotspot.emoji} ${label}`}
          lang={lang}
          onClick={() => onHotspotClick(hotspot)}
        />
      </group>

      {/* Point light for glow effect */}
      <pointLight
        position={[0, 1.5, 0]}
        color={threeColor}
        intensity={1.5}
        distance={4}
        decay={2}
      />
    </group>
  );
}

// ─── Main 3D scene content ─────────────────────────────────────────────────
function ShowroomScene({
  hotspots,
  lang,
  onHotspotClick,
}: {
  hotspots: HotspotData[];
  lang: 'fr' | 'ar';
  onHotspotClick: (h: HotspotData) => void;
}) {
  // Place up to 6 pedestals in a gentle arc
  const pedesatalPositions: [number, number, number][] = useMemo(() => {
    const count = Math.min(hotspots.length, 6);
    if (count === 0) return [];
    const positions: [number, number, number][] = [];
    // Two rows: front row (z=-3) and back row (z=-7)
    const configs = [
      [-5, 0, -4], [0, 0, -6], [5, 0, -4],
      [-5, 0, -9], [0, 0, -10], [5, 0, -9],
    ] as [number, number, number][];
    for (let i = 0; i < count; i++) {
      positions.push(configs[i]);
    }
    return positions;
  }, [hotspots.length]);

  return (
    <>
      {/* Lights */}
      <ambientLight intensity={0.25} color="#1a2040" />
      <directionalLight
        position={[0, 10, 5]}
        intensity={0.6}
        color="#c8d8ff"
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      {/* Brand accent lights */}
      <pointLight position={[-12, 4, -4]} color={BRAND.red} intensity={2} distance={14} decay={2} />
      <pointLight position={[12, 4, -4]} color={BRAND.gold} intensity={2} distance={14} decay={2} />
      <pointLight position={[0, 5, 0]} color="#6080ff" intensity={1} distance={12} decay={2} />

      {/* Environment */}
      <fog attach="fog" args={['#06080f', 14, 28]} />
      <Stars radius={40} depth={20} count={800} factor={3} saturation={0.3} fade speed={0.3} />
      <Sparkles
        count={80}
        scale={[22, 7, 18]}
        position={[0, 3, -5]}
        size={1.5}
        speed={0.3}
        opacity={0.4}
        color="#8cb4ff"
      />

      {/* Room geometry */}
      <Floor />
      <FloorGrid />
      <BackWall />
      <SideWalls />
      <Ceiling />

      {/* Category displays */}
      {hotspots.slice(0, 6).map((hotspot, i) => (
        <CategoryDisplay
          key={hotspot.id}
          position={pedesatalPositions[i] || [0, 0, -5]}
          hotspot={hotspot}
          shapeIndex={i}
          lang={lang}
          onHotspotClick={onHotspotClick}
        />
      ))}

      {/* Camera controls */}
      <OrbitControls
        target={[0, 1.5, -5]}
        enablePan={false}
        minDistance={3}
        maxDistance={14}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.1}
        autoRotate
        autoRotateSpeed={0.4}
        dampingFactor={0.06}
        enableDamping
      />
    </>
  );
}

// ─── Canvas wrapper (exported) ─────────────────────────────────────────────
interface SceneProps {
  hotspots: HotspotData[];
  lang: 'fr' | 'ar';
  onHotspotClick: (h: HotspotData) => void;
}

export default function Scene3D({ hotspots, lang, onHotspotClick }: SceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 2.8, 8], fov: 58, near: 0.1, far: 80 }}
      shadows
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
      }}
      style={{ background: '#06080f' }}
    >
      <Suspense fallback={null}>
        <ShowroomScene
          hotspots={hotspots}
          lang={lang}
          onHotspotClick={onHotspotClick}
        />
      </Suspense>
    </Canvas>
  );
}
