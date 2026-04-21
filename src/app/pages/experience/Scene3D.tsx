import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { DEFAULT_CONFIG, type Config3D, type Waypoint } from './use3DConfig';
import type { HotspotData } from './ProductPanel';

// ─── Props ────────────────────────────────────────────────────────────────────
interface SceneProps {
  hotspots: HotspotData[];
  lang: 'fr' | 'ar';
  onHotspotClick: (h: HotspotData) => void;
  config?: Config3D;
}

// ─── Camera controller (first-person smooth lerp) ────────────────────────────
function CameraController({
  targetPos,
  targetLook,
}: {
  targetPos: THREE.Vector3;
  targetLook: THREE.Vector3;
}) {
  const { camera } = useThree();
  const dummy = useRef(new THREE.Object3D());
  useEffect(() => {
    // Snap to starting position once on mount — no lerp on first frame
    camera.position.set(targetPos.x, targetPos.y, targetPos.z);
    camera.lookAt(targetLook);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame(() => {
    camera.position.lerp(targetPos, 0.055);
    dummy.current.position.copy(camera.position);
    dummy.current.lookAt(targetLook);
    camera.quaternion.slerp(dummy.current.quaternion, 0.055);
  });

  return null;
}

// ─── Floor ───────────────────────────────────────────────────────────────────
function StoreFloor({ color }: { color: string }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[28, 26]} />
      <meshStandardMaterial color={color} roughness={0.25} metalness={0.6} />
    </mesh>
  );
}

function FloorGrid() {
  return <gridHelper args={[28, 28, '#1e2240', '#1e2240']} position={[0, 0.01, 0]} />;
}

// ─── Walls + ceiling ─────────────────────────────────────────────────────────
function StoreWalls({ wallColor }: { wallColor: string }) {
  const mat = <meshStandardMaterial color={wallColor} roughness={0.85} metalness={0.05} />;
  return (
    <>
      <mesh position={[0, 5, -13]} receiveShadow><boxGeometry args={[28, 10, 0.3]} />{mat}</mesh>
      <mesh position={[0, 5, 13]} receiveShadow><boxGeometry args={[28, 10, 0.3]} />{mat}</mesh>
      <mesh position={[-14, 5, 0]} receiveShadow><boxGeometry args={[0.3, 10, 26]} />{mat}</mesh>
      <mesh position={[14, 5, 0]} receiveShadow><boxGeometry args={[0.3, 10, 26]} />{mat}</mesh>
      <mesh position={[0, 10, 0]} receiveShadow><boxGeometry args={[28, 0.3, 26]} />{mat}</mesh>
    </>
  );
}

// ─── Ceiling lights ───────────────────────────────────────────────────────────
function CeilingLights() {
  const positions: [number, number, number][] = [
    [-8, 9.7, -5], [0, 9.7, -5], [8, 9.7, -5],
    [-8, 9.7, 2],  [0, 9.7, 2],  [8, 9.7, 2],
    [-8, 9.7, 8],  [0, 9.7, 8],  [8, 9.7, 8],
  ];
  return (
    <>
      {positions.map((pos, i) => (
        <group key={i} position={pos}>
          <mesh>
            <boxGeometry args={[3.5, 0.08, 0.3]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1.2} />
          </mesh>
          <pointLight position={[0, -0.5, 0]} intensity={1.1} distance={7} color="#f0f4ff" />
        </group>
      ))}
    </>
  );
}

// ─── Shelf unit ───────────────────────────────────────────────────────────────
function ShelfUnit({
  position,
  rotation = 0,
  color = '#E5252A',
}: {
  position: [number, number, number];
  rotation?: number;
  color?: string;
}) {
  const dark = '#2a1f14';
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 2.5, -0.38]}>
        <boxGeometry args={[2.4, 5, 0.06]} />
        <meshStandardMaterial color={dark} roughness={0.9} />
      </mesh>
      {([-1.17, 1.17] as number[]).map((x, i) => (
        <mesh key={i} position={[x, 2.5, 0]}>
          <boxGeometry args={[0.06, 5, 0.8]} />
          <meshStandardMaterial color={dark} roughness={0.9} />
        </mesh>
      ))}
      {([1.0, 2.0, 3.0, 4.0] as number[]).map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <boxGeometry args={[2.34, 0.06, 0.8]} />
          <meshStandardMaterial color={dark} roughness={0.8} metalness={0.1} />
        </mesh>
      ))}
      <mesh position={[0, 5, 0]}>
        <boxGeometry args={[2.4, 0.08, 0.86]} />
        <meshStandardMaterial color={dark} roughness={0.8} />
      </mesh>
      <mesh position={[0, 5.1, -0.35]}>
        <boxGeometry args={[2.4, 0.06, 0.1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

// ─── Backpack hanging display ─────────────────────────────────────────────────
function BackpackDisplay({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 4.8, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 2.4, 8]} />
        <meshStandardMaterial color="#888" metalness={0.9} roughness={0.1} />
      </mesh>
      {([-0.7, 0, 0.7] as number[]).map((x, i) => (
        <group key={i} position={[x, 3.6, 0]}>
          <mesh>
            <boxGeometry args={[0.38, 0.55, 0.18]} />
            <meshStandardMaterial color={[color, '#1D4ED8', '#10B981'][i % 3]} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.22, 6]} />
            <meshStandardMaterial color="#555" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0, -0.1, 0.1]}>
            <boxGeometry args={[0.28, 0.28, 0.05]} />
            <meshStandardMaterial color={[color, '#1D4ED8', '#10B981'][i % 3]} roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── Pencil case table ────────────────────────────────────────────────────────
function TrousseDisplay({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.0, 0]}>
        <boxGeometry args={[2.2, 0.06, 0.8]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.4} metalness={0.3} />
      </mesh>
      {([-0.95, 0.95] as number[]).flatMap((x, i) =>
        ([-0.3, 0.3] as number[]).map((z, j) => (
          <mesh key={`${i}-${j}`} position={[x, 0.5, z]}>
            <cylinderGeometry args={[0.03, 0.03, 1.0, 6]} />
            <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
          </mesh>
        ))
      )}
      {([-0.7, 0, 0.7] as number[]).map((x, i) => (
        <mesh key={i} position={[x, 1.1, 0]}>
          <boxGeometry args={[0.3, 0.12, 0.55]} />
          <meshStandardMaterial color={[color, '#8B5CF6', '#F97316'][i % 3]} roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 1.55, -0.25]}>
        <boxGeometry args={[2.0, 0.9, 0.05]} />
        <meshStandardMaterial color="#111" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.08, 0.42]}>
        <boxGeometry args={[2.2, 0.04, 0.06]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

// ─── Brand back wall ──────────────────────────────────────────────────────────
function BrandBackWall({ title, subtitle, primaryColor, secondaryColor }: {
  title: string; subtitle: string; primaryColor: string; secondaryColor: string;
}) {
  return (
    <group position={[0, 0, -12.5]}>
      <mesh position={[0, 5.5, 0.16]}>
        <boxGeometry args={[10, 4.5, 0.1]} />
        <meshStandardMaterial color="#0d0f1c" roughness={0.5} />
      </mesh>
      <mesh position={[0, 3.1, 0.2]}>
        <boxGeometry args={[10, 0.08, 0.1]} />
        <meshStandardMaterial color={primaryColor} emissive={primaryColor} emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0, 7.9, 0.2]}>
        <boxGeometry args={[10, 0.08, 0.1]} />
        <meshStandardMaterial color={secondaryColor} emissive={secondaryColor} emissiveIntensity={1.5} />
      </mesh>
      <Html position={[0, 5.5, 0.35]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
        <div style={{ fontFamily: 'Montserrat, sans-serif', textAlign: 'center', userSelect: 'none' }}>
          <div style={{
            fontSize: 52, fontWeight: 900, letterSpacing: -1,
            background: 'linear-gradient(135deg,#5baeff 0%,#2060d0 55%,#4499ff 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            filter: 'drop-shadow(0 0 20px rgba(80,150,255,0.6))', lineHeight: 1.05,
          }}>{title}</div>
          <div style={{
            fontSize: 18, fontWeight: 600, letterSpacing: 4,
            color: 'rgba(255,215,0,0.85)', marginTop: 6, textTransform: 'uppercase',
            filter: 'drop-shadow(0 0 12px rgba(255,180,0,0.5))',
          }}>{subtitle}</div>
        </div>
      </Html>
      {([-4.8, 4.8] as number[]).map((x, i) => (
        <mesh key={i} position={[x, 5, 0.18]}>
          <boxGeometry args={[0.12, 6, 0.12]} />
          <meshStandardMaterial
            color={i === 0 ? primaryColor : secondaryColor}
            emissive={i === 0 ? primaryColor : secondaryColor}
            emissiveIntensity={0.8}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─── Center island ────────────────────────────────────────────────────────────
function CenterIsland({ color }: { color: string }) {
  return (
    <group position={[0, 0, -1]}>
      <mesh position={[0, 0.7, 0]}>
        <boxGeometry args={[3.5, 1.4, 1.4]} />
        <meshStandardMaterial color="#16182a" roughness={0.5} metalness={0.2} />
      </mesh>
      <mesh position={[0, 1.44, 0]}>
        <boxGeometry args={[3.5, 0.08, 1.4]} />
        <meshStandardMaterial color="#88aaff" transparent opacity={0.18} roughness={0.05} metalness={0.9} />
      </mesh>
      {([-1, 0, 1] as number[]).map((x, i) => (
        <mesh key={i} position={[x * 1.0, 1.2, 0]}>
          <boxGeometry args={[0.22, 0.22, 0.35]} />
          <meshStandardMaterial color={[color, '#FFD700', '#8B5CF6'][i % 3]} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 1.45, 0.72]}>
        <boxGeometry args={[3.5, 0.04, 0.04]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
      </mesh>
      <pointLight position={[0, 1.6, 0]} intensity={0.6} distance={3} color="#d0ddff" />
    </group>
  );
}

// ─── Entrance arch ────────────────────────────────────────────────────────────
function EntranceArch({ color }: { color: string }) {
  return (
    <group position={[0, 0, 12]}>
      {([-3.5, 3.5] as number[]).map((x, i) => (
        <mesh key={i} position={[x, 3.5, 0]}>
          <boxGeometry args={[0.35, 7, 0.35]} />
          <meshStandardMaterial color="#1a1c2e" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 7.2, 0]}>
        <boxGeometry args={[7.35, 0.3, 0.35]} />
        <meshStandardMaterial color="#1a1c2e" roughness={0.6} />
      </mesh>
      <mesh position={[0, 7.38, 0]}>
        <boxGeometry args={[7.35, 0.07, 0.07]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
      </mesh>
    </group>
  );
}

// ─── Section sign ─────────────────────────────────────────────────────────────
function SectionSign({ position, label, color, rotation = 0 }: {
  position: [number, number, number]; label: string; color: string; rotation?: number;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh>
        <boxGeometry args={[1.8, 0.45, 0.08]} />
        <meshStandardMaterial color="#0d0f1c" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.26, 0]}>
        <boxGeometry args={[1.8, 0.06, 0.09]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} />
      </mesh>
      <Html position={[0, 0, 0.06]} center distanceFactor={5} style={{ pointerEvents: 'none' }}>
        <div style={{
          color: '#fff', fontSize: 11, fontWeight: 800,
          fontFamily: 'Montserrat, sans-serif', letterSpacing: 2,
          textTransform: 'uppercase', textShadow: `0 0 12px ${color}`, whiteSpace: 'nowrap',
        }}>{label}</div>
      </Html>
    </group>
  );
}

// ─── Aisle divider ────────────────────────────────────────────────────────────
function AisleDivider({ x, color }: { x: number; color: string }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.12, 1.0, 16]} />
        <meshStandardMaterial color="#16182a" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.04, 0]}>
        <boxGeometry args={[0.08, 0.04, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
      </mesh>
    </group>
  );
}

// ─── Floor navigation dot ─────────────────────────────────────────────────────
function FloorDot({ waypoint, lang, isActive, onClick, primaryColor }: {
  waypoint: Waypoint; lang: 'fr' | 'ar'; isActive: boolean; onClick: () => void; primaryColor: string;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ringRef.current) {
      const s = 1 + Math.sin(t * 2.5) * 0.12;
      ringRef.current.scale.set(s, 1, s);
      (ringRef.current.material as THREE.MeshStandardMaterial).opacity = 0.35 + Math.sin(t * 2.5) * 0.25;
    }
    if (ring2Ref.current) {
      const s2 = 1 + Math.sin(t * 2.5 + 1) * 0.18;
      ring2Ref.current.scale.set(s2, 1, s2);
      (ring2Ref.current.material as THREE.MeshStandardMaterial).opacity = 0.2 + Math.sin(t * 2.5 + 1) * 0.2;
    }
  });

  const color = isActive ? '#ffffff' : primaryColor;

  return (
    <group position={[waypoint.position[0], 0.02, waypoint.position[2]]}>
      <mesh ref={ring2Ref} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, 0.7, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8}
          transparent opacity={0.25} depthWrite={false} />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.28, 0.45, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2}
          transparent opacity={0.5} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.2, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2}
          transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <Html position={[0, 0.18, 0]} center distanceFactor={9} style={{ pointerEvents: 'auto' }}>
        <div onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', userSelect: 'none' }}>
          <div style={{ position: 'absolute', width: 90, height: 90, borderRadius: '50%', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
          <div style={{
            background: isActive ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.6)',
            border: `1px solid ${color}55`, borderRadius: 20, padding: '3px 10px',
            fontSize: 10, fontWeight: 800, fontFamily: 'Montserrat, sans-serif',
            color: isActive ? '#fff' : 'rgba(255,255,255,0.7)', letterSpacing: '1.5px',
            textTransform: 'uppercase', whiteSpace: 'nowrap', backdropFilter: 'blur(6px)',
            boxShadow: isActive ? `0 0 12px ${primaryColor}60` : 'none', marginTop: 8,
          }}>
            {lang === 'ar' ? waypoint.label_ar : waypoint.label_fr}
          </div>
        </div>
      </Html>
    </group>
  );
}

// ─── Hotspot pin ──────────────────────────────────────────────────────────────
function HotspotPin({ hotspot, position, lang, onClick }: {
  hotspot: HotspotData; position: [number, number, number]; lang: 'fr' | 'ar'; onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const baseY = position[1];

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.position.y = baseY + Math.sin(clock.getElapsedTime() * 1.8) * 0.1;
    }
  });

  const label = lang === 'ar' ? hotspot.label_ar : hotspot.label_fr;

  return (
    <group position={[position[0], 0, position[2]]}>
      <mesh position={[0, position[1] - 0.5, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 1.0, 8]} />
        <meshStandardMaterial color={hotspot.color} emissive={hotspot.color} emissiveIntensity={0.6} transparent opacity={0.7} />
      </mesh>
      <mesh ref={meshRef} position={[0, baseY, 0]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color={hotspot.color} emissive={hotspot.color} emissiveIntensity={0.9} roughness={0.2} metalness={0.3} />
      </mesh>
      <Html position={[0, baseY + 0.55, 0]} center distanceFactor={7}>
        <div onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none' }}>
          <div style={{ fontSize: 22, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.6))' }}>{hotspot.emoji}</div>
          <div style={{
            background: `${hotspot.color}dd`, borderRadius: 16, padding: '3px 10px',
            fontSize: 10, fontWeight: 800, fontFamily: 'Montserrat, sans-serif',
            color: hotspot.color === '#FFD700' ? '#111' : '#fff', letterSpacing: 1,
            textTransform: 'uppercase', whiteSpace: 'nowrap', boxShadow: `0 4px 16px ${hotspot.color}60`,
          }}>{label}</div>
        </div>
      </Html>
      <pointLight position={[0, baseY, 0]} intensity={0.5} distance={2.5} color={hotspot.color} />
    </group>
  );
}

// ─── Hotspot positions inside the store ───────────────────────────────────────
const HOTSPOT_POSITIONS: [number, number, number][] = [
  [-10, 2.6, 2],
  [10, 2.6, 2],
  [0, 2.6, -1],
  [-5, 2.6, -5],
  [5, 2.6, -5],
  [0, 2.6, 7],
];

// ─── Full showroom scene ──────────────────────────────────────────────────────
function ShowroomScene({
  hotspots, lang, onHotspotClick, config, activeWaypointId, onWaypointClick,
}: {
  hotspots: HotspotData[]; lang: 'fr' | 'ar'; onHotspotClick: (h: HotspotData) => void;
  config: Config3D; activeWaypointId: string; onWaypointClick: (w: Waypoint) => void;
}) {
  const labelCartables = lang === 'ar' ? config.section_label_cartables_ar : config.section_label_cartables_fr;
  const labelTrousses = lang === 'ar' ? config.section_label_trousses_ar : config.section_label_trousses_fr;

  return (
    <>
      <fog attach="fog" args={[config.fog_color, config.fog_near, config.fog_far]} />
      <ambientLight intensity={config.ambient_intensity} color="#c8d4ff" />
      <directionalLight position={[0, 9, 5]} intensity={0.4} color="#ffffff" castShadow />

      {config.show_particles && (
        <Sparkles count={60} scale={[20, 8, 20]} position={[0, 5, 0]} size={1.2} speed={0.2} color="#88aaff" opacity={0.4} />
      )}

      <StoreFloor color={config.floor_color} />
      <FloorGrid />
      <StoreWalls wallColor={config.wall_color} />
      <CeilingLights />
      <EntranceArch color={config.primary_color} />
      <BrandBackWall
        title={config.brand_title}
        subtitle={config.brand_subtitle}
        primaryColor={config.primary_color}
        secondaryColor={config.secondary_color}
      />

      <AisleDivider x={-3.8} color={config.primary_color} />
      <AisleDivider x={3.8} color={config.secondary_color} />

      {/* LEFT — Cartables */}
      <>
        <SectionSign position={[-9, 7, 2]} label={labelCartables} color={config.primary_color} rotation={Math.PI / 16} />
        <ShelfUnit position={[-12.5, 0, -7]} color={config.primary_color} />
        <ShelfUnit position={[-12.5, 0, -2]} color={config.primary_color} />
        <ShelfUnit position={[-12.5, 0, 3]} color={config.primary_color} />
        <ShelfUnit position={[-12.5, 0, 8]} color={config.primary_color} />
        <BackpackDisplay position={[-10, 0, 0]} color={config.primary_color} />
        <BackpackDisplay position={[-10, 0, 5]} color={config.primary_color} />
        <pointLight position={[-10, 6, 2]} intensity={0.8} distance={8} color="#ff8888" />
      </>

      {/* RIGHT — Trousses */}
      <>
        <SectionSign position={[9, 7, 2]} label={labelTrousses} color={config.secondary_color} rotation={-Math.PI / 16} />
        <ShelfUnit position={[12.5, 0, -7]} color={config.secondary_color} />
        <ShelfUnit position={[12.5, 0, -2]} color={config.secondary_color} />
        <ShelfUnit position={[12.5, 0, 3]} color={config.secondary_color} />
        <ShelfUnit position={[12.5, 0, 8]} color={config.secondary_color} />
        <TrousseDisplay position={[10, 0, 1]} color={config.secondary_color} />
        <TrousseDisplay position={[10, 0, 5.5]} color={config.secondary_color} />
        <pointLight position={[10, 6, 2]} intensity={0.8} distance={8} color="#ffe066" />
      </>

      <CenterIsland color={config.accent_color} />
      <pointLight position={[0, 3, -1]} intensity={0.6} distance={5} color="#aaccff" />

      {hotspots.slice(0, 6).map((h, i) => (
        <HotspotPin
          key={h.id}
          hotspot={h}
          position={HOTSPOT_POSITIONS[i] ?? [0, 2.6, 0]}
          lang={lang}
          onClick={() => onHotspotClick(h)}
        />
      ))}

      {config.waypoints.map((wp) => (
        <FloorDot
          key={wp.id}
          waypoint={wp}
          lang={lang}
          isActive={wp.id === activeWaypointId}
          onClick={() => onWaypointClick(wp)}
          primaryColor={config.primary_color}
        />
      ))}
    </>
  );
}

// ─── Default export ───────────────────────────────────────────────────────────
export default function Scene3D({ hotspots, lang, onHotspotClick, config: configProp }: SceneProps) {
  const config = configProp ?? DEFAULT_CONFIG;

  const initialWp = config.waypoints[0] ?? { id: 'entrance', position: [0, 1.7, 9] as [number,number,number], lookAt: [0, 1.5, 0] as [number,number,number] };

  const [activeWaypointId, setActiveWaypointId] = useState(initialWp.id);
  const [targetPos, setTargetPos] = useState<THREE.Vector3>(
    () => new THREE.Vector3(...initialWp.position),
  );
  const [targetLook, setTargetLook] = useState<THREE.Vector3>(
    () => new THREE.Vector3(...(initialWp as Waypoint).lookAt ?? [0, 1.5, 0]),
  );

  const handleWaypointClick = useCallback((wp: Waypoint) => {
    setActiveWaypointId(wp.id);
    setTargetPos(new THREE.Vector3(...wp.position));
    setTargetLook(new THREE.Vector3(...wp.lookAt));
  }, []);

  return (
    <Canvas
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
        powerPreference: 'high-performance',
      }}
      shadows
      camera={{ fov: 72, near: 0.1, far: 80, position: [0, 1.7, 9] }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <CameraController targetPos={targetPos} targetLook={targetLook} />
      <ShowroomScene
        hotspots={hotspots}
        lang={lang}
        onHotspotClick={onHotspotClick}
        config={config}
        activeWaypointId={activeWaypointId}
        onWaypointClick={handleWaypointClick}
      />
    </Canvas>
  );
}
