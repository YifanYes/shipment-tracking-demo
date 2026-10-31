import { useLayoutEffect, useRef, type RefObject } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrthographicCamera } from 'three'
import { Html } from '@react-three/drei'
import type { ShipmentView } from '@/domain/selectors'

function ResponsiveCamera({ selected }: { selected: boolean }) {
  const camera = useThree((state) => state.camera)
  const width = useThree((state) => state.size.width)
  const invalidate = useThree((state) => state.invalidate)

  useLayoutEffect(() => {
    if (camera instanceof OrthographicCamera) {
      camera.zoom = Math.min(width / (selected ? 15 : 17), selected ? 48 : 44)
      camera.lookAt(0, 0, 0)
      camera.updateProjectionMatrix()
      invalidate()
    }
  }, [camera, width, invalidate, selected])

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

function ShipmentRoute({
  item,
  selected,
  onSelect,
  portal,
}: {
  item: ShipmentView
  selected: boolean
  onSelect: (id: string) => void
  portal: RefObject<HTMLDivElement>
}) {
  const originX = item.origin?.scenePosition[0] ?? -4
  const destinationX = item.destination?.scenePosition[0] ?? 4
  const delivered = item.projection.lifecycle === 'delivered'
  const truckX = delivered ? destinationX : (originX + destinationX) / 2
  return (
    <group>
      <group position={[originX, 0, 0]} scale={0.55}>
        <Warehouse />
      </group>
      <group position={[destinationX, 0, 0]} scale={0.55}>
        <Warehouse />
      </group>
      <Html portal={portal} position={[originX, 2, -1]} center>
        <span className="scene-site-label">{item.origin?.placeLabel}</span>
      </Html>
      <Html portal={portal} position={[destinationX, 2, -1]} center>
        <span className="scene-site-label">{item.destination?.placeLabel}</span>
      </Html>
      <group
        position={[truckX, 0.18, 2.3]}
        onClick={(event) => {
          event.stopPropagation()
          onSelect(item.shipment.id)
        }}
      >
        <mesh castShadow position={[-0.2, 0.65, 0]}>
          <boxGeometry args={[1.6, 0.9, 0.85]} />
          <meshStandardMaterial color={selected ? '#4367df' : '#f5f8ff'} />
        </mesh>
        <mesh castShadow position={[0.88, 0.5, 0]}>
          <boxGeometry args={[0.58, 0.65, 0.8]} />
          <meshStandardMaterial color={delivered ? '#388068' : '#6589f1'} />
        </mesh>
        {[-0.65, 0.7].flatMap((x) =>
          [-0.44, 0.44].map((z) => (
            <mesh key={`${x}-${z}`} position={[x, 0.2, z]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.22, 0.22, 0.14, 12]} />
              <meshStandardMaterial color="#344862" />
            </mesh>
          )),
        )}
        {selected && (
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.1, 1.2, 40]} />
            <meshBasicMaterial color="#4367df" />
          </mesh>
        )}
        <Html portal={portal} position={[0, 1.75, 0]} center>
          <button
            type="button"
            className="scene-vehicle-label"
            aria-pressed={selected}
            onClick={() => onSelect(item.shipment.id)}
            aria-label={`Abrir ${item.shipment.reference} desde el vehículo`}
          >
            <strong>{item.shipment.reference}</strong>
            <span>{delivered ? 'Entregado' : 'En tránsito'}</span>
          </button>
        </Html>
      </group>
    </group>
  )
}

/** Inputs are already scoped by the same selector used by the list and detail. */
export default function NetworkPreview({
  shipments,
  selectedId,
  onSelect,
}: {
  shipments: readonly ShipmentView[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const portal = useRef<HTMLDivElement>(null!)
  if (!shipments.length)
    return <p className="scene-fallback">No hay vehículos ni rutas en tu perímetro.</p>
  return (
    <div className="network-canvas" ref={portal}>
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
        <ResponsiveCamera selected={selectedId !== null} />
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
          {shipments.map((item) => (
            <ShipmentRoute
              key={item.shipment.id}
              item={item}
              selected={selectedId === item.shipment.id}
              onSelect={onSelect}
              portal={portal}
            />
          ))}
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
    </div>
  )
}
