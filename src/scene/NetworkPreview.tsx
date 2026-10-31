import { useLayoutEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrthographicCamera } from 'three'

function ResponsiveCamera() {
  const camera = useThree((state) => state.camera)
  const width = useThree((state) => state.size.width)
  const invalidate = useThree((state) => state.invalidate)

  useLayoutEffect(() => {
    if (camera instanceof OrthographicCamera) {
      camera.zoom = Math.min(width / 16, 44)
      camera.updateProjectionMatrix()
      invalidate()
    }
  }, [camera, width, invalidate])

  return null
}

function Warehouse() {
  return (
    <group position={[0, 0.13, -1.65]}>
      <mesh castShadow receiveShadow position={[0, 0.95, 0]}>
        <boxGeometry args={[4.2, 1.9, 2.7]} />
        <meshStandardMaterial color="#496ee1" />
      </mesh>
      <mesh castShadow position={[0, 1.98, 0]}>
        <boxGeometry args={[4.45, 0.16, 2.95]} />
        <meshStandardMaterial color="#6589f1" />
      </mesh>
      {[-1.35, 0, 1.35].map((x) => (
        <group key={x} position={[x, 0.68, 1.37]}>
          <mesh>
            <boxGeometry args={[0.83, 1.35, 0.08]} />
            <meshStandardMaterial color="#e9efff" />
          </mesh>
          <mesh position={[0, 0, 0.06]}>
            <boxGeometry args={[0.65, 1.1, 0.06]} />
            <meshStandardMaterial color="#9eafd1" />
          </mesh>
          <mesh castShadow position={[0, 0.77, 0.32]}>
            <boxGeometry args={[1.05, 0.09, 0.75]} />
            <meshStandardMaterial color="#dbe5ff" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.5, 1.36]}>
        <boxGeometry args={[0.65, 0.22, 0.04]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}

function Tree({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.055, 0.07, 0.65, 6]} />
        <meshStandardMaterial color="#a28b70" />
      </mesh>
      <mesh castShadow position={[0, 1.05, 0]}>
        <icosahedronGeometry args={[0.49, 1]} />
        <meshStandardMaterial color="#95b8a0" />
      </mesh>
    </group>
  )
}

/** Visual foundation only. Selection and business entities arrive in phase 1. */
export default function NetworkPreview() {
  return (
    <Canvas
      orthographic
      shadows="percentage"
      camera={{ position: [11, 10, 12], zoom: 40 }}
      dpr={[1, 1.5]}
      frameloop="demand"
      fallback={
        <p className="scene-fallback">La vista de lista está disponible sin gráficos 3D.</p>
      }
      gl={{ antialias: true, alpha: true }}
    >
      <ResponsiveCamera />
      <ambientLight intensity={1.9} />
      <directionalLight
        castShadow
        position={[3, 9, 4]}
        intensity={2.4}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-normalBias={0.04}
      />
      <group position={[0, -0.4, 0]}>
        <mesh receiveShadow position={[0, 0, 0]}>
          <boxGeometry args={[12.8, 0.22, 9]} />
          <meshStandardMaterial color="#e1e6ef" />
        </mesh>
        <mesh receiveShadow position={[0, 0.125, -1.7]}>
          <boxGeometry args={[9.8, 0.04, 4.75]} />
          <meshStandardMaterial color="#edf0ec" />
        </mesh>
        <mesh receiveShadow position={[0, 0.12, 2.3]}>
          <boxGeometry args={[12.8, 0.025, 1.8]} />
          <meshStandardMaterial color="#bdc8dd" />
        </mesh>
        {[-5, -3, -1, 1, 3, 5].map((x) => (
          <mesh key={x} position={[x, 0.14, 2.3]}>
            <boxGeometry args={[0.72, 0.015, 0.055]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        ))}
        <Warehouse />
        <Tree position={[-4.1, 0.15, -3]} />
        <Tree position={[3.8, 0.15, -2.8]} />
        <Tree position={[4.8, 0.15, -1.4]} />
        {[-3.2, -2.6].map((x) => (
          <mesh key={x} castShadow position={[x, 0.45, 0.2]}>
            <boxGeometry args={[0.52, 0.6, 0.52]} />
            <meshStandardMaterial color="#d6b88b" />
          </mesh>
        ))}
      </group>
    </Canvas>
  )
}
