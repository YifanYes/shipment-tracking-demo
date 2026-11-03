import type { Account, DemoIdentity, LogisticsLocation, Operator } from '@/domain/contracts'

export const referenceTime = '2026-10-31T10:00:00.000Z'

export const accounts: readonly Account[] = [
  { id: 'account-norte', name: 'Norte Hogar' },
  { id: 'account-levante', name: 'Levante Retail' },
  { id: 'account-atlantico', name: 'Atlántico Industrial' },
]

const allAccounts = accounts.map((account) => account.id)

export const originSiteIds = ['site-madrid', 'site-barcelona', 'site-zaragoza'] as const

/** The first identity is the default one. */
export const identities: readonly DemoIdentity[] = [
  {
    id: 'operations-madrid',
    name: 'Operaciones Madrid',
    role: 'operations',
    allowedOriginSiteIds: ['site-madrid'],
    allowedAccountIds: allAccounts,
  },
  {
    id: 'operations-network',
    name: 'Operaciones · Red',
    role: 'operations',
    allowedOriginSiteIds: originSiteIds,
    allowedAccountIds: allAccounts,
  },
  ...accounts.map((account): DemoIdentity => ({
    id: `customer-${account.id.replace('account-', '')}`,
    name: `Cliente · ${account.name}`,
    role: 'customer',
    accountId: account.id,
  })),
]

type Place = Omit<LogisticsLocation, 'kind'>
const place = (kind: LogisticsLocation['kind']) => (item: Place) => ({ ...item, kind })

const sites = [
  {
    id: 'site-madrid',
    name: 'Centro Madrid',
    kind: 'warehouse',
    placeLabel: 'Madrid',
    countryCode: 'ES',
    coordinates: [-3.7038, 40.4168],
  },
  {
    id: 'site-barcelona',
    name: 'Planta Martorell',
    kind: 'factory',
    placeLabel: 'Martorell, Barcelona',
    countryCode: 'ES',
    coordinates: [1.931, 41.474],
  },
  {
    id: 'site-zaragoza',
    name: 'Plataforma Zaragoza',
    kind: 'warehouse',
    placeLabel: 'Zaragoza',
    countryCode: 'ES',
    coordinates: [-0.993, 41.625],
  },
] satisfies LogisticsLocation[]

const ports = (
  [
    {
      id: 'port-valencia',
      name: 'Puerto de Valencia',
      placeLabel: 'Valencia',
      countryCode: 'ES',
      coordinates: [-0.317, 39.444],
    },
    {
      id: 'port-barcelona',
      name: 'Puerto de Barcelona',
      placeLabel: 'Barcelona',
      countryCode: 'ES',
      coordinates: [2.165, 41.35],
    },
    {
      id: 'port-algeciras',
      name: 'Puerto de Algeciras',
      placeLabel: 'Algeciras',
      countryCode: 'ES',
      coordinates: [-5.438, 36.133],
    },
    {
      id: 'port-tanger-med',
      name: 'Puerto de Tanger Med',
      placeLabel: 'Tánger',
      countryCode: 'MA',
      coordinates: [-5.503, 35.885],
    },
    {
      id: 'port-genova',
      name: 'Puerto de Génova',
      placeLabel: 'Génova',
      countryCode: 'IT',
      coordinates: [8.88, 44.405],
    },
    {
      id: 'port-mersin',
      name: 'Puerto de Mersin',
      placeLabel: 'Mersin',
      countryCode: 'TR',
      coordinates: [34.64, 36.79],
    },
    {
      id: 'port-felixstowe',
      name: 'Puerto de Felixstowe',
      placeLabel: 'Felixstowe',
      countryCode: 'GB',
      coordinates: [1.315, 51.955],
    },
  ] satisfies Place[]
).map(place('port'))

const destinations = (
  [
    {
      id: 'destination-valencia',
      name: 'Almacén Valencia',
      placeLabel: 'Valencia',
      countryCode: 'ES',
      coordinates: [-0.3763, 39.4699],
    },
    {
      id: 'destination-sevilla',
      name: 'Almacén Sevilla',
      placeLabel: 'Sevilla',
      countryCode: 'ES',
      coordinates: [-5.9845, 37.3891],
    },
    {
      id: 'destination-bilbao',
      name: 'Almacén Bilbao',
      placeLabel: 'Bilbao',
      countryCode: 'ES',
      coordinates: [-2.935, 43.263],
    },
    {
      id: 'destination-malaga',
      name: 'Almacén Málaga',
      placeLabel: 'Málaga',
      countryCode: 'ES',
      coordinates: [-4.4214, 36.7213],
    },
    {
      id: 'destination-a-coruna',
      name: 'Almacén A Coruña',
      placeLabel: 'A Coruña',
      countryCode: 'ES',
      coordinates: [-8.4115, 43.3623],
    },
    {
      id: 'destination-murcia',
      name: 'Almacén Murcia',
      placeLabel: 'Murcia',
      countryCode: 'ES',
      coordinates: [-1.1307, 37.9922],
    },
    {
      id: 'destination-casablanca',
      name: 'Distribuidor Casablanca',
      placeLabel: 'Casablanca',
      countryCode: 'MA',
      coordinates: [-7.5898, 33.5731],
    },
    {
      id: 'destination-milano',
      name: 'Distribuidor Milán',
      placeLabel: 'Milán',
      countryCode: 'IT',
      coordinates: [9.19, 45.4642],
    },
    {
      id: 'destination-adana',
      name: 'Distribuidor Adana',
      placeLabel: 'Adana',
      countryCode: 'TR',
      coordinates: [35.3213, 37.0],
    },
    {
      id: 'destination-birmingham',
      name: 'Distribuidor Birmingham',
      placeLabel: 'Birmingham',
      countryCode: 'GB',
      coordinates: [-1.8904, 52.4862],
    },
  ] satisfies Place[]
).map(place('destination'))

/** Positions reported by operator events. Road points lie on the stored OSRM geometry. */
const waypoints = (
  [
    {
      id: 'waypoint-a3-perales',
      name: 'A-3 · Perales de Tajuña',
      placeLabel: 'Perales de Tajuña',
      countryCode: 'ES',
      coordinates: [-3.220108, 40.148136],
    },
    {
      id: 'waypoint-a4-bailen',
      name: 'A-4 · Bailén',
      placeLabel: 'Bailén',
      countryCode: 'ES',
      coordinates: [-3.74916, 38.11055],
    },
    {
      id: 'waypoint-a1-larache',
      name: 'A1 · Larache',
      placeLabel: 'Larache',
      countryCode: 'MA',
      coordinates: [-6.11918, 35.17254],
    },
    {
      id: 'waypoint-a23-teruel',
      name: 'A-23 · Teruel',
      placeLabel: 'Teruel',
      countryCode: 'ES',
      coordinates: [-1.0888, 40.35914],
    },
    {
      id: 'waypoint-a6-benavente',
      name: 'A-6 · Benavente',
      placeLabel: 'Benavente',
      countryCode: 'ES',
      coordinates: [-5.66048, 42.0054],
    },
    {
      id: 'waypoint-a5-trujillo',
      name: 'A-5 · Trujillo',
      placeLabel: 'Trujillo',
      countryCode: 'ES',
      coordinates: [-5.87148, 39.45105],
    },
    {
      id: 'waypoint-ap7-castellon',
      name: 'AP-7 · Castellón',
      placeLabel: 'Castellón de la Plana',
      countryCode: 'ES',
      coordinates: [-0.05396, 40.007],
    },
    {
      id: 'waypoint-ap7-benicarlo',
      name: 'AP-7 · Benicarló',
      placeLabel: 'Benicarló',
      countryCode: 'ES',
      coordinates: [0.3834, 40.42638],
    },
    {
      id: 'waypoint-ap68-logrono',
      name: 'AP-68 · Logroño',
      placeLabel: 'Logroño',
      countryCode: 'ES',
      coordinates: [-2.45086, 42.43316],
    },
    {
      id: 'waypoint-a31-albacete',
      name: 'A-31 · Albacete',
      placeLabel: 'Albacete',
      countryCode: 'ES',
      coordinates: [-1.83793, 38.9925],
    },
    {
      id: 'waypoint-a7-valencia',
      name: 'A-7 · Valencia',
      placeLabel: 'Valencia',
      countryCode: 'ES',
      coordinates: [-0.46575, 39.52801],
    },
    {
      id: 'waypoint-a1-burgos',
      name: 'A-1 · Burgos',
      placeLabel: 'Burgos',
      countryCode: 'ES',
      coordinates: [-3.68915, 42.32328],
    },
    {
      id: 'waypoint-sea-golfo-leon',
      name: 'Golfo de León',
      placeLabel: 'Mar Mediterráneo',
      countryCode: 'FR',
      coordinates: [5.5, 42.3],
    },
    {
      id: 'waypoint-sea-canal-sicilia',
      name: 'Canal de Sicilia',
      placeLabel: 'Mar Mediterráneo',
      countryCode: 'IT',
      coordinates: [11.6, 37.5],
    },
    {
      id: 'waypoint-sea-cabo-san-vicente',
      name: 'Cabo de San Vicente',
      placeLabel: 'Océano Atlántico',
      countryCode: 'PT',
      coordinates: [-9.2, 36.9],
    },
    {
      id: 'waypoint-sea-liguria',
      name: 'Mar de Liguria',
      placeLabel: 'Mar Mediterráneo',
      countryCode: 'FR',
      coordinates: [7.5, 43.4],
    },
    {
      id: 'waypoint-sea-baleares',
      name: 'Mar Balear',
      placeLabel: 'Mar Mediterráneo',
      countryCode: 'ES',
      coordinates: [1.8, 40.4],
    },
  ] satisfies Place[]
).map(place('waypoint'))

export const locations: readonly LogisticsLocation[] = [
  ...sites,
  ...ports,
  ...destinations,
  ...waypoints,
]

export const operators: readonly Operator[] = [
  { id: 'operator-iberia', name: 'Vía Cargo', modes: ['road'] },
  { id: 'operator-cierzo', name: 'Transportes Cierzo', modes: ['road'] },
  { id: 'operator-boreal', name: 'Naviera Boreal', modes: ['sea'] },
  { id: 'operator-puente', name: 'Puente Aduanas', modes: ['road'] },
]
