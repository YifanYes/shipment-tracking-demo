import type { ShipmentLeg } from '@/domain/contracts'
import felixstoweBirmingham from './routes/felixstowe-birmingham.json'
import genovaMilano from './routes/genova-milano.json'
import madridACoruna from './routes/madrid-a-coruna.json'
import madridAlgeciras from './routes/madrid-algeciras.json'
import madridBilbao from './routes/madrid-bilbao.json'
import madridMurcia from './routes/madrid-murcia.json'
import madridPortValencia from './routes/madrid-port-valencia.json'
import madridSevilla from './routes/madrid-sevilla.json'
import madridValencia from './routes/madrid-valencia.json'
import martorellMurcia from './routes/martorell-murcia.json'
import martorellPortBarcelona from './routes/martorell-port-barcelona.json'
import martorellSevilla from './routes/martorell-sevilla.json'
import martorellValencia from './routes/martorell-valencia.json'
import mersinAdana from './routes/mersin-adana.json'
import tangerMedCasablanca from './routes/tanger-med-casablanca.json'
import zaragozaBilbao from './routes/zaragoza-bilbao.json'
import zaragozaMalaga from './routes/zaragoza-malaga.json'
import zaragozaPortBarcelona from './routes/zaragoza-port-barcelona.json'
import zaragozaPortValencia from './routes/zaragoza-port-valencia.json'
import zaragozaValencia from './routes/zaragoza-valencia.json'

type Route = NonNullable<ShipmentLeg['route']>
type Point = readonly [longitude: number, latitude: number]

const points = (raw: readonly (readonly number[])[]): Point[] =>
  raw.map(([longitude, latitude]) => [longitude!, latitude!])

const road = (raw: readonly (readonly number[])[]): Route => ({
  coordinates: points(raw),
  source: 'OSRM · OpenStreetMap',
})

/** Road geometries fetched once from OSRM and simplified to about 35 m (60 m above 600 km). */
const roadRoutes = {
  'site-madrid>destination-valencia': road(madridValencia),
  'site-madrid>destination-sevilla': road(madridSevilla),
  'site-madrid>destination-bilbao': road(madridBilbao),
  'site-madrid>destination-murcia': road(madridMurcia),
  'site-madrid>destination-a-coruna': road(madridACoruna),
  'site-madrid>port-valencia': road(madridPortValencia),
  'site-madrid>port-algeciras': road(madridAlgeciras),
  'site-barcelona>destination-valencia': road(martorellValencia),
  'site-barcelona>destination-murcia': road(martorellMurcia),
  'site-barcelona>destination-sevilla': road(martorellSevilla),
  'site-barcelona>port-barcelona': road(martorellPortBarcelona),
  'site-zaragoza>destination-bilbao': road(zaragozaBilbao),
  'site-zaragoza>destination-valencia': road(zaragozaValencia),
  'site-zaragoza>destination-malaga': road(zaragozaMalaga),
  'site-zaragoza>port-barcelona': road(zaragozaPortBarcelona),
  'site-zaragoza>port-valencia': road(zaragozaPortValencia),
  'port-tanger-med>destination-casablanca': road(tangerMedCasablanca),
  'port-genova>destination-milano': road(genovaMilano),
  'port-mersin>destination-adana': road(mersinAdana),
  'port-felixstowe>destination-birmingham': road(felixstoweBirmingham),
} as const satisfies Record<string, Route>

/* Hand-authored sea passages. Each one stays offshore and keeps to the straits. */
const fromValencia: Point[] = [
  [-0.317, 39.444],
  [-0.2, 39.43],
]
const fromBarcelona: Point[] = [
  [2.165, 41.35],
  [2.3, 41.3],
]
const valenciaToGibraltar: Point[] = [
  [0.1, 39.1],
  [0.4, 38.75],
  [0.05, 38.3],
  [-0.45, 37.75],
  [-0.6, 37.5],
  [-1.3, 37.4],
  [-2.05, 36.65],
  [-2.3, 36.58],
  [-3.4, 36.55],
  [-4.4, 36.45],
  [-4.9, 36.3],
  [-5.25, 35.98],
  [-5.4, 35.94],
]
const barcelonaToNao: Point[] = [
  [1.3, 40.6],
  [0.6, 39.6],
  [0.4, 38.75],
]
const gibraltarToFelixstowe: Point[] = [
  [-5.6, 35.93],
  [-6.3, 36.0],
  [-8.0, 36.6],
  [-9.2, 36.9],
  [-9.6, 38.4],
  [-9.75, 39.4],
  [-9.6, 41.0],
  [-9.6, 42.5],
  [-9.6, 43.2],
  [-8.5, 44.0],
  [-5.5, 46.0],
  [-5.7, 48.3],
  [-5.3, 49.1],
  [-4.0, 49.6],
  [-2.0, 50.0],
  [0.0, 50.35],
  [1.2, 50.8],
  [1.55, 51.05],
  [1.75, 51.4],
  [1.65, 51.8],
  [1.45, 51.93],
  [1.315, 51.955],
]
const westernMedToMersin: Point[] = [
  [10.0, 38.3],
  [11.6, 37.5],
  [12.6, 37.0],
  [14.5, 36.3],
  [16.5, 35.8],
  [20.0, 35.3],
  [23.0, 34.7],
  [26.5, 34.6],
  [28.0, 35.6],
  [30.5, 36.0],
  [32.5, 35.9],
  [34.0, 36.15],
  [34.5, 36.55],
  [34.64, 36.72],
  [34.64, 36.79],
]
const toGenova: Point[] = [
  [5.5, 42.3],
  [7.5, 43.4],
  [8.6, 44.25],
  [8.88, 44.38],
  [8.88, 44.405],
]

const sea = (...segments: Point[][]): Route => ({
  coordinates: segments.flat(),
  source: 'Itinerario sintético del operador',
})

const seaRoutes = {
  'port-algeciras>port-tanger-med': sea([
    [-5.438, 36.133],
    [-5.41, 36.1],
    [-5.4, 36.05],
    [-5.45, 35.94],
    [-5.48, 35.91],
    [-5.503, 35.885],
  ]),
  'port-valencia>port-tanger-med': sea(fromValencia, valenciaToGibraltar, [
    [-5.48, 35.91],
    [-5.503, 35.885],
  ]),
  'port-valencia>port-felixstowe': sea(fromValencia, valenciaToGibraltar, gibraltarToFelixstowe),
  'port-barcelona>port-felixstowe': sea(
    fromBarcelona,
    barcelonaToNao,
    valenciaToGibraltar.slice(2),
    gibraltarToFelixstowe,
  ),
  'port-valencia>port-mersin': sea(
    fromValencia,
    [
      [0.4, 38.75],
      [1.5, 38.4],
      [4.5, 38.4],
      [8.0, 38.6],
    ],
    westernMedToMersin,
  ),
  'port-barcelona>port-mersin': sea(
    fromBarcelona,
    [
      [3.0, 41.0],
      [4.5, 40.4],
      [7.8, 38.8],
    ],
    westernMedToMersin,
  ),
  'port-barcelona>port-genova': sea(fromBarcelona, [[3.5, 41.6]], toGenova),
  'port-valencia>port-genova': sea(
    fromValencia,
    [
      [0.5, 39.7],
      [1.8, 40.4],
      [3.5, 41.2],
    ],
    toGenova,
  ),
} as const satisfies Record<string, Route>

const allRoutes: Readonly<Record<string, Route>> = { ...roadRoutes, ...seaRoutes }

/** Stored geometry for a leg, or undefined: legs without one are never drawn as a straight line. */
export function routeFor(originId: string, destinationId: string): Route | undefined {
  return allRoutes[`${originId}>${destinationId}`]
}
