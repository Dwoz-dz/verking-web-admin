import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { Html, Sparkles, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { DEFAULT_CONFIG, type Config3D, type Waypoint } from './use3DConfig';
import type { HotspotData } from './ProductPanel';

interface SceneProps {
  hotspots: HotspotData[];
  lang: 'fr' | 'ar';
  onHotspotClick: (hotspot: HotspotData) => void;
  config?: Config3D;
}

const CAMERA_HEIGHT = 1.72;
const LOOK_DISTANCE = 11;
const ROOM_BOUNDS = {
  minX: -12.6,
  maxX: 12.6,
  minZ: -11.2,
  maxZ: 11.2,
};

const HOTSPOT_POSITIONS: [number, number, number][] = [
  [-8.2, 2.5, 3.2],
  [8.2, 2.5, 3.2],
  [0, 2.5, 1.2],
  [-8.2, 2.5, -4.8],
  [8.2, 2.5, -4.8],
  [0, 2.5, -7.1],
];
const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toVector3(tuple: [number, number, number]) {
  return new THREE.Vector3(tuple[0], tuple[1], tuple[2]);
}

function getAnglesFromLook(position: [number, number, number], lookAt: [number, number, number]) {
  const dir = new THREE.Vector3(
    lookAt[0] - position[0],
    lookAt[1] - position[1],
    lookAt[2] - position[2],
  ).normalize();

  return {
    yaw: Math.atan2(dir.x, dir.z),
    pitch: clamp(Math.asin(dir.y), -0.48, 0.42),
  };
}

function buildLookTarget(position: THREE.Vector3, yaw: number, pitch: number) {
  const direction = new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch),
  ).normalize();
  return position.clone().add(direction.multiplyScalar(LOOK_DISTANCE));
}

function SceneBackground({ color }: { color: string }) {
  const { scene } = useThree();
  useEffect(() => {
    scene.background = new THREE.Color(color);
  }, [scene, color]);
  return null;
}

function CameraController({
  targetPosition,
  targetLook,
}: {
  targetPosition: THREE.Vector3;
  targetLook: THREE.Vector3;
}) {
  const { camera } = useThree();
  const helperCamera = useRef(new THREE.PerspectiveCamera());

  useEffect(() => {
    camera.position.copy(targetPosition);
    camera.lookAt(targetLook);
  }, [camera, targetPosition, targetLook]);

  useFrame((_, delta) => {
    const distance = camera.position.distanceTo(targetPosition);
    const moveLerp = THREE.MathUtils.clamp(1 - Math.exp(-delta * (4 + distance * 0.25)), 0.05, 0.25);
    const rotateLerp = THREE.MathUtils.clamp(1 - Math.exp(-delta * 6), 0.08, 0.3);

    camera.position.lerp(targetPosition, moveLerp);
    helperCamera.current.position.copy(camera.position);
    helperCamera.current.lookAt(targetLook);
    camera.quaternion.slerp(helperCamera.current.quaternion, rotateLerp);
  });

  return null;
}

function StoreShell({
  floorColor,
  wallColor,
}: {
  floorColor: string;
  wallColor: string;
}) {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[28, 24]} />
        <meshStandardMaterial color={floorColor} roughness={0.55} metalness={0.15} />
      </mesh>

      <mesh position={[0, 4.6, -12]} receiveShadow>
        <boxGeometry args={[28, 9.2, 0.25]} />
        <meshStandardMaterial color={wallColor} roughness={0.72} metalness={0.06} />
      </mesh>
      <mesh position={[-14, 4.6, 0]} receiveShadow>
        <boxGeometry args={[0.25, 9.2, 24]} />
        <meshStandardMaterial color={wallColor} roughness={0.72} metalness={0.06} />
      </mesh>
      <mesh position={[14, 4.6, 0]} receiveShadow>
        <boxGeometry args={[0.25, 9.2, 24]} />
        <meshStandardMaterial color={wallColor} roughness={0.72} metalness={0.06} />
      </mesh>
      <mesh position={[0, 9.2, 0]} receiveShadow>
        <boxGeometry args={[28, 0.3, 24]} />
        <meshStandardMaterial color="#1D2742" roughness={0.72} metalness={0.08} />
      </mesh>
    </>
  );
}

function FloorGrid() {
  return <gridHelper args={[28, 28, '#2C3E74', '#27325C']} position={[0, 0.01, 0]} />;
}

function ZoneFloor({
  position,
  size,
  color,
  label,
}: {
  position: [number, number, number];
  size: [number, number];
  color: string;
  label: string;
}) {
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <planeGeometry args={size} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.22}
          transparent
          opacity={0.14}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[Math.min(size[0], size[1]) * 0.24, Math.min(size[0], size[1]) * 0.28, 40]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.4}
          transparent
          opacity={0.34}
          depthWrite={false}
        />
      </mesh>
      <Html position={[0, 0.18, size[1] * 0.45]} center distanceFactor={10}>
        <div
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 900,
            fontSize: 10,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            padding: '3px 10px',
            borderRadius: 999,
            color: '#f8fafc',
            background: 'rgba(7,12,28,0.72)',
            border: '1px solid rgba(255,255,255,0.14)',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
      </Html>
    </group>
  );
}

function CeilingLights() {
  const positions: [number, number, number][] = [
    [-8.4, 8.9, -6.5], [0, 8.9, -6.5], [8.4, 8.9, -6.5],
    [-8.4, 8.9, 0], [0, 8.9, 0], [8.4, 8.9, 0],
    [-8.4, 8.9, 6.5], [0, 8.9, 6.5], [8.4, 8.9, 6.5],
  ];

  return (
    <>
      {positions.map((position, index) => (
        <group key={index} position={position}>
          <mesh>
            <boxGeometry args={[3.8, 0.08, 0.45]} />
            <meshStandardMaterial color="#D5E6FF" emissive="#D5E6FF" emissiveIntensity={0.9} />
          </mesh>
          <pointLight position={[0, -0.4, 0]} intensity={2.2} distance={9} color="#ECF4FF" decay={2} />
        </group>
      ))}
    </>
  );
}

function ShelfUnit({
  position,
  rotation = 0,
  color,
}: {
  position: [number, number, number];
  rotation?: number;
  color: string;
}) {
  const itemColors = ['#1D4ED8', '#E5252A', '#FFD700', '#2DD4BF', '#8B5CF6', '#FB923C'];
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 2.3, -0.38]} castShadow>
        <boxGeometry args={[2.5, 4.6, 0.08]} />
        <meshStandardMaterial color="#1B2242" roughness={0.85} />
      </mesh>
      <mesh position={[-1.2, 2.3, 0]} castShadow>
        <boxGeometry args={[0.08, 4.6, 0.8]} />
        <meshStandardMaterial color="#1B2242" roughness={0.85} />
      </mesh>
      <mesh position={[1.2, 2.3, 0]} castShadow>
        <boxGeometry args={[0.08, 4.6, 0.8]} />
        <meshStandardMaterial color="#1B2242" roughness={0.85} />
      </mesh>

      {[0.7, 1.45, 2.2, 2.95, 3.7].map((y, rowIndex) => (
        <group key={rowIndex}>
          <mesh position={[0, y, 0]} castShadow>
            <boxGeometry args={[2.42, 0.06, 0.8]} />
            <meshStandardMaterial color="#111935" roughness={0.6} />
          </mesh>
          <mesh position={[0, y + 0.03, -0.33]}>
            <boxGeometry args={[2.36, 0.03, 0.04]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
          </mesh>

          {[-0.92, -0.46, 0, 0.46, 0.92].map((x, itemIndex) => (
            <mesh key={itemIndex} position={[x, y + 0.2, 0]} castShadow>
              <boxGeometry args={[0.18, 0.34, 0.5]} />
              <meshStandardMaterial
                color={itemColors[(itemIndex + rowIndex) % itemColors.length]}
                roughness={0.58}
                emissive={itemColors[(itemIndex + rowIndex) % itemColors.length]}
                emissiveIntensity={0.12}
              />
            </mesh>
          ))}
        </group>
      ))}

      <mesh position={[0, 4.65, 0]} castShadow>
        <boxGeometry args={[2.52, 0.12, 0.9]} />
        <meshStandardMaterial color="#1B2242" roughness={0.65} />
      </mesh>
    </group>
  );
}

function CenterIsland({ accentColor }: { accentColor: string }) {
  return (
    <group position={[0, 0, -2.2]}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[5.2, 1.1, 3.2]} />
        <meshStandardMaterial color="#152349" roughness={0.52} metalness={0.2} />
      </mesh>
      <mesh position={[0, 1.14, 0]}>
        <boxGeometry args={[5.3, 0.08, 3.3]} />
        <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.7} />
      </mesh>

      {[-1.7, -0.8, 0, 0.8, 1.7].map((x, index) => (
        <mesh key={index} position={[x, 1.45, 0]} castShadow>
          <boxGeometry args={[0.58, 0.5, 0.58]} />
          <meshStandardMaterial color={index % 2 === 0 ? '#FFD700' : '#1D4ED8'} roughness={0.48} metalness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

function BackWallBrandPanel({
  brandTitle,
  brandSubtitle,
  backgroundUrl,
}: {
  brandTitle: string;
  brandSubtitle: string;
  backgroundUrl: string;
}) {
  const hasBackgroundImage = Boolean(backgroundUrl?.trim());
  const texture = useTexture(hasBackgroundImage ? backgroundUrl : TRANSPARENT_PIXEL);

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
  }, [texture]);

  return (
    <>
      <mesh position={[0, 4.4, -11.6]}>
        <planeGeometry args={[8.8, 3.2]} />
        <meshStandardMaterial
          color={hasBackgroundImage ? '#FFFFFF' : '#0E1A3A'}
          map={hasBackgroundImage ? texture : null}
          emissive="#0E1A3A"
          emissiveIntensity={hasBackgroundImage ? 0.18 : 0.4}
        />
      </mesh>
      <Html position={[0, 4.45, -11.5]} center transform distanceFactor={12}>
        <div
          style={{
            textAlign: 'center',
            fontFamily: 'Montserrat, sans-serif',
            color: '#F8FAFC',
            userSelect: 'none',
            textShadow: '0 2px 12px rgba(0,0,0,0.75)',
          }}
        >
          <div style={{ fontWeight: 900, letterSpacing: 0.8, fontSize: 28, lineHeight: 1 }}>
            {brandTitle || 'VERKING'}
          </div>
          <div style={{ fontWeight: 700, letterSpacing: 3, fontSize: 12, marginTop: 6, color: '#D9E5FF' }}>
            {brandSubtitle || 'S.T.P Stationery'}
          </div>
        </div>
      </Html>
    </>
  );
}

function FloorWaypoint({
  waypoint,
  lang,
  active,
  onClick,
  color,
}: {
  waypoint: Waypoint;
  lang: 'fr' | 'ar';
  active: boolean;
  onClick: () => void;
  color: string;
}) {
  const [hovered, setHovered] = useState(false);
  const pulse = useRef(0);

  useFrame((_, delta) => {
    pulse.current += delta;
  });

  const label = lang === 'ar' ? waypoint.label_ar : waypoint.label_fr;
  const scale = active ? 1.22 : hovered ? 1.12 : 1;
  const glow = active ? 0.48 + Math.sin(pulse.current * 4) * 0.08 : hovered ? 0.38 : 0.24;

  return (
    <group position={[waypoint.position[0], 0, waypoint.position[2]]}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.014, 0]}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <ringGeometry args={[0.44 * scale, 0.72 * scale, 48]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} transparent opacity={glow} depthWrite={false} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[0.34 * scale, 44]} />
        <meshStandardMaterial color="#0f1630" emissive={color} emissiveIntensity={active ? 0.36 : 0.2} transparent opacity={0.9} />
      </mesh>

      <Html position={[0, 0.08, 0]} center distanceFactor={8}>
        <button
          type="button"
          onClick={onClick}
          style={{
            borderRadius: 999,
            border: `1px solid ${active ? `${color}AA` : 'rgba(255,255,255,0.18)'}`,
            background: 'rgba(8,12,26,0.72)',
            color: '#E5E7EB',
            padding: '2px 10px',
            fontFamily: 'Montserrat, sans-serif',
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: 1.1,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
          }}
        >
          {label}
        </button>
      </Html>
    </group>
  );
}

function FloorMovePlane({
  onMove,
}: {
  onMove: (point: THREE.Vector3) => void;
}) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.02, 0]}
      onClick={(event) => {
        event.stopPropagation();
        onMove(event.point.clone());
      }}
    >
      <planeGeometry args={[25.2, 22.4]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

function HotspotPin({
  hotspot,
  position,
  lang,
  onClick,
}: {
  hotspot: HotspotData;
  position: [number, number, number];
  lang: 'fr' | 'ar';
  onClick: () => void;
}) {
  const sphereRef = useRef<THREE.Mesh>(null);
  const label = lang === 'ar' ? hotspot.label_ar : hotspot.label_fr;

  useFrame((state) => {
    if (!sphereRef.current) return;
    sphereRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2 + position[0]) * 0.08;
    sphereRef.current.rotation.y += 0.01;
  });

  return (
    <group position={[position[0], 0, position[2]]}>
      <mesh position={[0, 0.95, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 1.8, 8]} />
        <meshStandardMaterial color={hotspot.color} emissive={hotspot.color} emissiveIntensity={0.8} />
      </mesh>

      <mesh ref={sphereRef} position={[0, position[1], 0]} onClick={onClick}>
        <sphereGeometry args={[0.26, 20, 20]} />
        <meshStandardMaterial color={hotspot.color} emissive={hotspot.color} emissiveIntensity={1.15} roughness={0.2} metalness={0.4} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, 0]}>
        <ringGeometry args={[0.34, 0.5, 28]} />
        <meshStandardMaterial color={hotspot.color} emissive={hotspot.color} emissiveIntensity={1.5} transparent opacity={0.7} depthWrite={false} />
      </mesh>

      <Html position={[0, position[1] + 0.64, 0]} center distanceFactor={7}>
        <div
          onClick={onClick}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <div style={{ fontSize: 22, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.7))' }}>
            {hotspot.emoji}
          </div>
          <div
            style={{
              background: `${hotspot.color}E8`,
              borderRadius: 14,
              padding: '4px 10px',
              fontSize: 9,
              fontWeight: 900,
              fontFamily: 'Montserrat, sans-serif',
              color: hotspot.color === '#FFD700' ? '#111' : '#fff',
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </div>
        </div>
      </Html>
    </group>
  );
}

function ShowroomScene({
  hotspots,
  lang,
  config,
  activeWaypointId,
  onWaypointClick,
  onFloorClickMove,
  onHotspotClick,
}: {
  hotspots: HotspotData[];
  lang: 'fr' | 'ar';
  config: Config3D;
  activeWaypointId: string;
  onWaypointClick: (waypoint: Waypoint) => void;
  onFloorClickMove: (point: THREE.Vector3) => void;
  onHotspotClick: (hotspot: HotspotData) => void;
}) {
  const labelCartables = lang === 'ar' ? config.section_label_cartables_ar : config.section_label_cartables_fr;
  const labelTrousses = lang === 'ar' ? config.section_label_trousses_ar : config.section_label_trousses_fr;
  const labelCenter = lang === 'ar' ? config.section_label_center_ar : config.section_label_center_fr;

  return (
    <>
      <SceneBackground color={config.fog_color} />
      <fog attach="fog" args={[config.fog_color, Math.max(16, config.fog_near * 0.7), Math.max(48, config.fog_far)]} />

      <hemisphereLight args={['#E8F1FF', '#2A3556', 1.0]} />
      <ambientLight intensity={Math.max(0.5, config.ambient_intensity)} color="#EAF0FF" />
      <directionalLight
        position={[6, 13, 10]}
        intensity={1.05}
        color="#FFF8ED"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-8, 9, -4]} intensity={0.55} color="#BFD3FF" />
      <pointLight position={[0, 5.5, 2]} intensity={1.0} distance={18} color="#F4FAFF" decay={2} />
      <pointLight position={[-8.5, 4, 1.5]} intensity={1.0} distance={10} color={config.primary_color} decay={2} />
      <pointLight position={[8.5, 4, 1.5]} intensity={1.0} distance={10} color={config.secondary_color} decay={2} />
      <pointLight position={[0, 3.6, -6]} intensity={0.8} distance={8} color={config.accent_color} decay={2} />

      {config.show_particles && (
        <Sparkles count={40} scale={[22, 8, 22]} position={[0, 4.8, 0]} size={1.4} speed={0.14} color="#9CB8FF" opacity={0.28} />
      )}

      <StoreShell floorColor={config.floor_color} wallColor={config.wall_color} />
      <FloorGrid />
      <FloorMovePlane onMove={onFloorClickMove} />
      <CeilingLights />

      <ZoneFloor position={[-8, 0, 1.2]} size={[8.6, 14]} color={config.primary_color} label={labelCartables} />
      <ZoneFloor position={[8, 0, 1.2]} size={[8.6, 14]} color={config.secondary_color} label={labelTrousses} />
      <ZoneFloor position={[0, 0, -2.5]} size={[6.2, 12]} color={config.accent_color} label={labelCenter} />

      {[-7.4, -2.5, 2.4, 7.3].map((z, index) => (
        <ShelfUnit key={`left-${index}`} position={[-11.6, 0, z]} rotation={0} color={config.primary_color} />
      ))}
      {[-7.4, -2.5, 2.4, 7.3].map((z, index) => (
        <ShelfUnit key={`right-${index}`} position={[11.6, 0, z]} rotation={Math.PI} color={config.secondary_color} />
      ))}

      <CenterIsland accentColor={config.accent_color} />

      <BackWallBrandPanel
        brandTitle={config.brand_title}
        brandSubtitle={config.brand_subtitle}
        backgroundUrl={config.showroom_background_url}
      />

      {hotspots.slice(0, 6).map((hotspot, index) => (
        <HotspotPin
          key={hotspot.id}
          hotspot={hotspot}
          position={HOTSPOT_POSITIONS[index] || [0, 2.5, 0]}
          lang={lang}
          onClick={() => onHotspotClick(hotspot)}
        />
      ))}

      {config.waypoints.map((waypoint) => (
        <FloorWaypoint
          key={waypoint.id}
          waypoint={waypoint}
          lang={lang}
          active={activeWaypointId === waypoint.id}
          onClick={() => onWaypointClick(waypoint)}
          color={config.primary_color}
        />
      ))}
    </>
  );
}

export default function Scene3D({
  hotspots,
  lang,
  onHotspotClick,
  config: incomingConfig,
}: SceneProps) {
  const config = incomingConfig ?? DEFAULT_CONFIG;
  const initialWaypoint = config.waypoints[0] || {
    id: 'entrance',
    label_fr: 'Entree',
    label_ar: 'المدخل',
    position: [0, CAMERA_HEIGHT, 10.6] as [number, number, number],
    lookAt: [0, 2.2, 1.6] as [number, number, number],
  };

  const initialAngles = useMemo(
    () => getAnglesFromLook(initialWaypoint.position, initialWaypoint.lookAt),
    [initialWaypoint],
  );

  const [activeWaypointId, setActiveWaypointId] = useState(initialWaypoint.id);
  const [targetPosition, setTargetPosition] = useState(() => toVector3(initialWaypoint.position));
  const [targetYaw, setTargetYaw] = useState(initialAngles.yaw);
  const [targetPitch, setTargetPitch] = useState(initialAngles.pitch);
  const [isDragging, setIsDragging] = useState(false);

  const dragStateRef = useRef({
    active: false,
    moved: false,
    ignoreNextClick: false,
    lastX: 0,
    lastY: 0,
  });

  const targetLook = useMemo(
    () => buildLookTarget(targetPosition, targetYaw, targetPitch),
    [targetPosition, targetYaw, targetPitch],
  );

  const applyWaypoint = useCallback((waypoint: Waypoint) => {
    const y = Number.isFinite(waypoint.position[1]) ? waypoint.position[1] : CAMERA_HEIGHT;
    setTargetPosition(new THREE.Vector3(waypoint.position[0], y, waypoint.position[2]));
    const angles = getAnglesFromLook(waypoint.position, waypoint.lookAt);
    setTargetYaw(angles.yaw);
    setTargetPitch(angles.pitch);
  }, []);

  const handleWaypointClick = useCallback((waypoint: Waypoint) => {
    setActiveWaypointId(waypoint.id);
    applyWaypoint(waypoint);
  }, [applyWaypoint]);

  const consumeDragClickGuard = useCallback(() => {
    if (dragStateRef.current.ignoreNextClick) {
      dragStateRef.current.ignoreNextClick = false;
      return true;
    }
    return false;
  }, []);

  const handleFloorClickMove = useCallback((point: THREE.Vector3) => {
    if (consumeDragClickGuard()) return;

    const clampedX = clamp(point.x, ROOM_BOUNDS.minX, ROOM_BOUNDS.maxX);
    const clampedZ = clamp(point.z, ROOM_BOUNDS.minZ, ROOM_BOUNDS.maxZ);
    const nextPosition = new THREE.Vector3(clampedX, CAMERA_HEIGHT, clampedZ);
    setTargetPosition(nextPosition);

    if (config.waypoints.length === 0) return;
    let nearest = config.waypoints[0];
    let nearestDistanceSq = Number.POSITIVE_INFINITY;
    for (const waypoint of config.waypoints) {
      const dx = waypoint.position[0] - clampedX;
      const dz = waypoint.position[2] - clampedZ;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq < nearestDistanceSq) {
        nearestDistanceSq = distanceSq;
        nearest = waypoint;
      }
    }
    setActiveWaypointId(nearest.id);
  }, [config.waypoints, consumeDragClickGuard]);

  useEffect(() => {
    const current = config.waypoints.find((waypoint) => waypoint.id === activeWaypointId) || config.waypoints[0];
    if (!current) return;
    setActiveWaypointId(current.id);
    applyWaypoint(current);
  }, [config.waypoints, applyWaypoint]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    dragStateRef.current.active = true;
    dragStateRef.current.moved = false;
    dragStateRef.current.lastX = event.clientX;
    dragStateRef.current.lastY = event.clientY;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragStateRef.current.active) return;

    const dx = event.clientX - dragStateRef.current.lastX;
    const dy = event.clientY - dragStateRef.current.lastY;
    dragStateRef.current.lastX = event.clientX;
    dragStateRef.current.lastY = event.clientY;

    if (Math.abs(dx) + Math.abs(dy) > 1.6) {
      dragStateRef.current.moved = true;
    }

    setTargetYaw((prev) => prev - (dx * 0.006));
    setTargetPitch((prev) => clamp(prev - (dy * 0.0048), -0.46, 0.4));
  }, []);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragStateRef.current.active) return;
    if (dragStateRef.current.moved) {
      dragStateRef.current.ignoreNextClick = true;
    }
    dragStateRef.current.active = false;
    setIsDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  return (
    <Canvas
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.16,
        powerPreference: 'high-performance',
      }}
      shadows
      camera={{
        fov: 68,
        near: 0.1,
        far: 100,
        position: initialWaypoint.position,
      }}
      style={{
        position: 'absolute',
        inset: 0,
        background: '#1E293B',
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <CameraController targetPosition={targetPosition} targetLook={targetLook} />
      <ShowroomScene
        hotspots={hotspots}
        lang={lang}
        config={config}
        activeWaypointId={activeWaypointId}
        onWaypointClick={handleWaypointClick}
        onFloorClickMove={handleFloorClickMove}
        onHotspotClick={onHotspotClick}
      />
    </Canvas>
  );
}
