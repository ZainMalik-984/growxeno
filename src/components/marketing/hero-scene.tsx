"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Float, Lightformer, MeshReflectorMaterial, RoundedBox, Sparkles } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * The hero's 3D scene (2026-11-16, brand palette: black, electric green,
 * metallic silver): a growth chart built as a sculpture. Brushed-silver columns
 * rise along an arc; an electric-green growth line draws itself over their
 * tops with a light travelling along it; a chrome ring and a green sphere float
 * in the depth around it. Lit by a neutral key light with real shadows and
 * emerald rim and fill lights, with light panels baked into a local environment
 * map for reflections (no HDR download: the CSP allows only this origin). The
 * floor is dark and reflective on large screens. Fog gives atmospheric depth;
 * silver and green sparkles are the only particles.
 *
 * Loaded with next/dynamic (ssr: false) from src/app/marketing-home.tsx, so
 * three.js never ships in the server bundle or blocks first paint.
 * `simplified` (phones, small tablets) drops shadow maps and some geometry. `reducedMotion` renders on demand and holds everything still.
 * `active` pauses rendering while the hero is off screen.
 */

const GREEN = "#08E52F";
const EMERALD = "#00B95B";
const SILVER = "#C7C8CC";
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Pointer position across the whole window (-1..1), since HTML panels sit over the canvas. */
function usePointer() {
  const pointer = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const move = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);
  return pointer;
}

function Rig({ reducedMotion, pointer }: { reducedMotion: boolean; pointer: React.RefObject<{ x: number; y: number }> }) {
  const target = useMemo(() => new THREE.Vector3(0, 1.55, 0), []);
  const invalidate = useThree((s) => s.invalidate);
  // Aim once even when nothing animates (reduced motion renders on demand).
  useEffect(() => {
    invalidate();
  }, [invalidate]);
  useFrame((state, delta) => {
    const cam = state.camera;
    if (!reducedMotion) {
      const p = pointer.current;
      cam.position.x = THREE.MathUtils.damp(cam.position.x, p.x * 0.55, 2.2, delta);
      cam.position.y = THREE.MathUtils.damp(cam.position.y, 2.35 + p.y * 0.25, 2.2, delta);
    }
    cam.lookAt(target);
  });
  return null;
}

function Sculpture({
  simplified,
  reducedMotion,
  pointer,
}: {
  simplified: boolean;
  reducedMotion: boolean;
  pointer: React.RefObject<{ x: number; y: number }>;
}) {
  const group = useRef<THREE.Group>(null);
  const runner = useRef<THREE.Mesh>(null);
  const drawn = useRef(reducedMotion ? 1 : 0);

  const count = simplified ? 5 : 7;
  const columns = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const t = i / (count - 1);
        return {
          x: (t - 0.5) * (simplified ? 4 : 5.2),
          z: 0.35 - Math.sin(t * Math.PI) * 0.95,
          h: 0.5 + Math.pow(t, 1.7) * 3.1,
        };
      }),
    [count, simplified],
  );
  const curve = useMemo(
    () => new THREE.CatmullRomCurve3(columns.map((c) => new THREE.Vector3(c.x, c.h + 0.32, c.z)), false, "centripetal"),
    [columns],
  );
  const tube = useMemo(() => new THREE.TubeGeometry(curve, 200, 0.026, 12, false), [curve]);
  useEffect(() => () => tube.dispose(), [tube]);

  useFrame((state, delta) => {
    // The growth line draws itself in once.
    if (drawn.current < 1) {
      drawn.current = Math.min(1, drawn.current + delta * 0.42);
      const total = tube.index?.count ?? 0;
      tube.setDrawRange(0, Math.floor((total * easeOut(drawn.current)) / 3) * 3);
    } else if (tube.drawRange.count !== Infinity && tube.index && tube.drawRange.count < tube.index.count) {
      tube.setDrawRange(0, tube.index.count);
    }
    if (runner.current) {
      const t = reducedMotion ? 1 : Math.min(easeOut(drawn.current), (state.clock.elapsedTime * 0.11) % 1);
      runner.current.position.copy(curve.getPointAt(Math.max(0.001, t)));
    }
    if (group.current && !reducedMotion) {
      const scroll = Math.min(1, window.scrollY / Math.max(1, window.innerHeight));
      const p = pointer.current;
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, -0.32 + p.x * 0.22 + scroll * 0.55, 2.6, delta);
      group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, 0.04 - p.y * 0.05, 2.6, delta);
      group.current.position.y = THREE.MathUtils.damp(group.current.position.y, -scroll * 0.6, 3, delta);
    }
  });

  const tallest = columns[columns.length - 1]!;

  return (
    <group ref={group} rotation={[0.04, -0.32, 0]}>
      {columns.map((c, i) => (
        <RoundedBox
          key={i}
          args={[0.6, c.h, 0.6]}
          radius={0.07}
          smoothness={simplified ? 2 : 4}
          position={[c.x, c.h / 2, c.z]}
          castShadow={!simplified}
          receiveShadow={!simplified}
        >
          <meshPhysicalMaterial color={SILVER} metalness={0.92} roughness={0.3} clearcoat={0.6} clearcoatRoughness={0.2} envMapIntensity={1.1} />
        </RoundedBox>
      ))}

      {/* Glowing cap on the tallest column: where the growth line lands. */}
      <mesh position={[tallest.x, tallest.h + 0.012, tallest.z]}>
        <boxGeometry args={[0.5, 0.02, 0.5]} />
        <meshBasicMaterial color={GREEN} toneMapped={false} />
      </mesh>

      <mesh geometry={tube}>
        <meshBasicMaterial color={GREEN} toneMapped={false} />
      </mesh>
      <mesh ref={runner}>
        <sphereGeometry args={[0.07, 24, 24]} />
        <meshBasicMaterial color="#E9FFEC" toneMapped={false} />
      </mesh>
      <pointLight position={[tallest.x, tallest.h + 0.8, tallest.z]} intensity={6} distance={4} color={GREEN} />

      <ContactShadows position={[0, 0.002, 0]} scale={13} blur={2.6} far={4.5} opacity={0.7} frames={1} resolution={simplified ? 256 : 512} color="#000000" />
    </group>
  );
}

function Floaters({ simplified, reducedMotion }: { simplified: boolean; reducedMotion: boolean }) {
  const speed = reducedMotion ? 0 : 1;
  return (
    <>
      <Float speed={1.4 * speed} rotationIntensity={0.5 * speed} floatIntensity={0.8 * speed} position={[1.55, 3.35, -0.9]}>
        <mesh castShadow={!simplified} rotation={[1.1, 0.3, 0.2]}>
          <torusGeometry args={[0.42, 0.11, 32, 96]} />
          <meshPhysicalMaterial color={SILVER} metalness={1} roughness={0.1} clearcoat={1} />
        </mesh>
      </Float>
      <Float speed={1.1 * speed} rotationIntensity={0.25 * speed} floatIntensity={0.6 * speed} position={[-2.2, 2.4, -0.3]}>
        <mesh>
          <sphereGeometry args={[0.2, 48, 48]} />
          <meshStandardMaterial color={GREEN} emissive={GREEN} emissiveIntensity={1.6} roughness={0.25} />
        </mesh>
      </Float>
    </>
  );
}

export default function HeroScene({
  simplified,
  reducedMotion,
  active,
  onReady,
}: {
  simplified: boolean;
  reducedMotion: boolean;
  active: boolean;
  onReady?: () => void;
}) {
  const pointer = usePointer();
  return (
    <Canvas
      className="!absolute inset-0"
      dpr={simplified ? [1, 1.5] : [1, 2]}
      shadows={simplified ? false : "percentage"}
      frameloop={active && !reducedMotion ? "always" : "demand"}
      camera={{ position: [0, 2.35, 9.8], fov: simplified ? 42 : 37, near: 0.1, far: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={() => onReady?.()}
      aria-hidden
    >
      <fog attach="fog" args={["#050706", 9.5, 19]} />
      <ambientLight intensity={0.18} />
      <directionalLight
        position={[-4.5, 7.5, 5]}
        intensity={2.1}
        color="#F4F5F4"
        castShadow={!simplified}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-bias={-0.0004}
      />
      <pointLight position={[4, 2.4, -2.5]} intensity={20} distance={12} color={EMERALD} />
      <pointLight position={[-5, 1.2, 2]} intensity={6} distance={10} color={EMERALD} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow={!simplified}>
        <planeGeometry args={[40, 40]} />
        {simplified ? (
          <meshStandardMaterial color="#070a08" roughness={0.9} metalness={0.05} />
        ) : (
          // Dark, softly blurred reflections of the columns and the green line.
          <MeshReflectorMaterial
            color="#070a08"
            blur={[400, 120]}
            resolution={512}
            mixBlur={1}
            mixStrength={2.2}
            roughness={0.85}
            metalness={0.4}
            depthScale={1}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.2}
            mirror={0.5}
          />
        )}
      </mesh>

      <Sculpture simplified={simplified} reducedMotion={reducedMotion} pointer={pointer} />
      <Floaters simplified={simplified} reducedMotion={reducedMotion} />
      <Sparkles
        count={simplified ? 16 : 44}
        scale={[10, 4.5, 5]}
        position={[0, 2.4, -0.5]}
        size={2}
        speed={reducedMotion ? 0 : 0.22}
        opacity={0.5}
        color={SILVER}
      />
      <Sparkles
        count={simplified ? 8 : 22}
        scale={[8, 4, 4]}
        position={[0.6, 2.6, -0.4]}
        size={2.6}
        speed={reducedMotion ? 0 : 0.3}
        opacity={0.7}
        color={GREEN}
      />
      <Rig reducedMotion={reducedMotion} pointer={pointer} />

      <Environment resolution={simplified ? 64 : 256} frames={1}>
        <Lightformer form="rect" intensity={2.4} color="#F4F5F4" position={[0, 6, -2]} rotation-x={Math.PI / 2} scale={[12, 3, 1]} />
        <Lightformer form="rect" intensity={4} color={EMERALD} position={[6, 1.6, 0]} rotation-y={-Math.PI / 2} scale={[7, 0.5, 1]} />
        <Lightformer form="ring" intensity={1.6} color="#ffffff" position={[-5, 3, 4]} scale={2.4} />
      </Environment>
    </Canvas>
  );
}
