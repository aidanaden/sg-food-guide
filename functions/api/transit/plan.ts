interface Env {
  ONEMAP_EMAIL?: string;
  ONEMAP_PASSWORD?: string;
  LTA_ACCOUNT_KEY?: string;
}

type TransitMode = 'bus' | 'train';
type ProviderStatus = 'ok' | 'partial' | 'fallback';

type TransitKind = 'bus' | 'train';

interface Coord {
  lat: number;
  lng: number;
}

interface TransitLive {
  etaMinutes?: number;
  sampledAtIso?: string;
  confidence?: string;
}

interface TransitDetails {
  kind: TransitKind;
  serviceOrLine?: string;
  boardStopOrStation?: string;
  alightStopOrStation?: string;
  numStops?: number;
  headsignOrDirection?: string;
  live?: TransitLive;
}

interface TransitLeg {
  from: Coord;
  to: Coord;
  distanceKm: number;
  durationMin: number;
  steps: string[];
  latlngs: [number, number][];
  transit: TransitDetails;
  warnings: string[];
  exact: boolean;
}

interface TransitResponse {
  status: ProviderStatus;
  provider: 'onemap_lta';
  legs: TransitLeg[];
  warnings: string[];
}

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

interface OneMapAuthResponse {
  access_token?: string;
  expiry_timestamp?: number;
}

const ONE_MAP_AUTH_URL = 'https://www.onemap.gov.sg/api/auth/post/getToken';
const ONE_MAP_ROUTE_URL = 'https://www.onemap.gov.sg/api/public/routingsvc/route';
const LTA_BUS_ARRIVAL_URL = 'https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival';
const LTA_TRAIN_ALERT_URL = 'https://datamall2.mytransport.sg/ltaodataservice/TrainServiceAlerts';

const ONE_MAP_TOKEN_SKEW_MS = 60_000;
const ONE_MAP_ROUTE_TTL_MS = 60_000;
const LTA_BUS_TTL_MS = 20_000;
const LTA_TRAIN_TTL_MS = 60_000;

const SPEED_KMPH: Record<TransitMode, number> = {
  bus: 20,
  train: 32,
};

const DEFAULT_WARNING = 'Exact transit details unavailable. Showing estimated route.';

let oneMapTokenCache: CacheEntry<string> | null = null;
const oneMapRouteCache = new Map<string, CacheEntry<any>>();
const ltaBusCache = new Map<string, CacheEntry<TransitLive | null>>();
let ltaTrainCache: CacheEntry<string[] | null> | null = null;

export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get('mode');
  if (mode !== 'bus' && mode !== 'train') {
    return json(
      {
        error: 'Invalid mode. Expected "bus" or "train".',
      },
      400
    );
  }

  const stopsParam = searchParams.get('stops') || '';
  const stops = parseStops(stopsParam);
  if (stops.length < 2) {
    return json(
      {
        error: 'At least two valid stops are required in the "stops" query parameter.',
      },
      400
    );
  }

  const legPairs = buildLegPairs(stops);

  if (!env.ONEMAP_EMAIL || !env.ONEMAP_PASSWORD) {
    const fallback = buildFallbackResponse(legPairs, mode, [
      'OneMap credentials are not configured on the server.',
      DEFAULT_WARNING,
    ]);
    return json(fallback, 200);
  }

  const token = await getOneMapToken(env);
  if (!token) {
    const fallback = buildFallbackResponse(legPairs, mode, [
      'Unable to authenticate with OneMap transit service.',
      DEFAULT_WARNING,
    ]);
    return json(fallback, 200);
  }

  const plannedLegs = await Promise.all(
    legPairs.map(([from, to]) => planOneMapLeg({
      env,
      token,
      mode,
      from,
      to,
    }))
  );

  const exactCount = plannedLegs.filter((leg) => leg.exact).length;
  const status: ProviderStatus =
    exactCount === plannedLegs.length ? 'ok' : exactCount > 0 ? 'partial' : 'fallback';

  const warnings = dedupe(
    plannedLegs.flatMap((leg) => leg.warnings).filter(Boolean)
  );

  const response: TransitResponse = {
    status,
    provider: 'onemap_lta',
    legs: plannedLegs,
    warnings,
  };

  return json(response, 200);
}

function parseStops(value: string): Coord[] {
  return value
    .split('|')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [latRaw, lngRaw] = chunk.split(',');
      const lat = Number(latRaw);
      const lng = Number(lngRaw);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
      return { lat, lng };
    })
    .filter((coord): coord is Coord => coord !== null);
}

function buildLegPairs(stops: Coord[]): Array<[Coord, Coord]> {
  const pairs: Array<[Coord, Coord]> = [];
  for (let i = 1; i < stops.length; i++) {
    pairs.push([stops[i - 1], stops[i]]);
  }
  return pairs;
}

function buildFallbackResponse(
  pairs: Array<[Coord, Coord]>,
  mode: TransitMode,
  warnings: string[]
): TransitResponse {
  return {
    status: 'fallback',
    provider: 'onemap_lta',
    legs: pairs.map(([from, to]) => buildFallbackLeg(from, to, mode, warnings)),
    warnings: dedupe(warnings),
  };
}

async function getOneMapToken(env: Env): Promise<string | null> {
  const now = Date.now();
  if (oneMapTokenCache && oneMapTokenCache.expiresAt > now) {
    return oneMapTokenCache.value;
  }

  try {
    const res = await fetch(ONE_MAP_AUTH_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: env.ONEMAP_EMAIL,
        password: env.ONEMAP_PASSWORD,
      }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as OneMapAuthResponse;
    if (!data.access_token) return null;

    const rawExpiry = Number(data.expiry_timestamp || 0);
    const expiresAt =
      rawExpiry > 0
        ? rawExpiry * 1000 - ONE_MAP_TOKEN_SKEW_MS
        : now + 30 * 60_000;

    oneMapTokenCache = {
      value: data.access_token,
      expiresAt,
    };

    return data.access_token;
  } catch {
    return null;
  }
}

interface PlanLegArgs {
  env: Env;
  token: string;
  mode: TransitMode;
  from: Coord;
  to: Coord;
}

async function planOneMapLeg(args: PlanLegArgs): Promise<TransitLeg> {
  const { env, token, mode, from, to } = args;

  const routeData = await fetchOneMapRoute(token, from, to, mode);
  if (!routeData) {
    return buildFallbackLeg(from, to, mode, [
      'OneMap routing response was unavailable for this leg.',
      DEFAULT_WARNING,
    ]);
  }

  const itinerary = pickPrimaryItinerary(routeData);
  if (!itinerary) {
    return buildFallbackLeg(from, to, mode, [
      'OneMap returned no itinerary for this leg.',
      DEFAULT_WARNING,
    ]);
  }

  const rawLegs = Array.isArray(itinerary.legs) ? itinerary.legs : [];
  const totalDistanceKm = inferDistanceKm(rawLegs, from, to);
  const totalDurationMin = inferDurationMin(itinerary.duration, totalDistanceKm, mode);
  const latlngs = decodeItineraryGeometry(rawLegs, from, to);

  const transitLegRaw = pickTransitLeg(rawLegs, mode);
  const serviceOrLine = extractServiceOrLine(transitLegRaw, mode);
  const boardName = extractStopName(transitLegRaw?.from);
  const alightName = extractStopName(transitLegRaw?.to);
  const numStops = toFiniteNumber(transitLegRaw?.numStops);
  const headsignOrDirection = extractHeadsign(transitLegRaw);

  const warnings: string[] = [];
  if (!serviceOrLine) warnings.push('Service or line was not returned for this leg.');
  if (!boardName || !alightName) warnings.push('Boarding or alighting stop was not returned for this leg.');

  const transit: TransitDetails = {
    kind: mode,
    serviceOrLine: serviceOrLine || undefined,
    boardStopOrStation: boardName || undefined,
    alightStopOrStation: alightName || undefined,
    numStops: Number.isFinite(numStops) ? Math.round(numStops) : undefined,
    headsignOrDirection: headsignOrDirection || undefined,
  };

  if (mode === 'bus') {
    const boardStopCode = extractStopCode(transitLegRaw?.from, boardName);
    const serviceNo = normalizeServiceNo(serviceOrLine);
    const live = await getBusArrivalLive(env, boardStopCode, serviceNo);
    if (live) {
      transit.live = live;
    } else {
      warnings.push('Live bus arrival was unavailable for this leg.');
    }
  } else {
    const alerts = await getTrainAlerts(env);
    if (alerts && alerts.length > 0) {
      warnings.push(...alerts.slice(0, 2));
    }
  }

  const steps = buildTransitSteps({
    rawLegs,
    mode,
    serviceOrLine,
    boardName,
    alightName,
    numStops,
    durationMin: totalDurationMin,
  });

  const exact = Boolean(serviceOrLine && boardName && alightName);

  return {
    from,
    to,
    distanceKm: totalDistanceKm,
    durationMin: totalDurationMin,
    steps,
    latlngs,
    transit,
    warnings: dedupe(warnings),
    exact,
  };
}

async function fetchOneMapRoute(
  token: string,
  from: Coord,
  to: Coord,
  mode: TransitMode
): Promise<any | null> {
  const key = `${mode}:${roundCoord(from)}>${roundCoord(to)}`;
  const cached = oneMapRouteCache.get(key);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;

  const date = new Date();
  const dateStr = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${date.getFullYear()}`;
  const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;

  const url = new URL(ONE_MAP_ROUTE_URL);
  url.searchParams.set('start', `${from.lat},${from.lng}`);
  url.searchParams.set('end', `${to.lat},${to.lng}`);
  url.searchParams.set('routeType', 'pt');
  url.searchParams.set('mode', mode.toUpperCase());
  url.searchParams.set('date', dateStr);
  url.searchParams.set('time', timeStr);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    oneMapRouteCache.set(key, {
      value: data,
      expiresAt: now + ONE_MAP_ROUTE_TTL_MS,
    });
    return data;
  } catch {
    return null;
  }
}

function pickPrimaryItinerary(data: any): any | null {
  const itineraries = data?.plan?.itineraries;
  if (!Array.isArray(itineraries) || itineraries.length === 0) return null;
  return itineraries[0] || null;
}

function inferDistanceKm(rawLegs: any[], from: Coord, to: Coord): number {
  const meters = rawLegs.reduce((sum, leg) => {
    const v = toFiniteNumber(leg?.distance);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);
  if (meters > 0) return Math.max(0.1, meters / 1000);
  return Math.max(0.1, haversineKm(from, to));
}

function inferDurationMin(rawDuration: unknown, distanceKm: number, mode: TransitMode): number {
  const duration = toFiniteNumber(rawDuration);
  if (Number.isFinite(duration) && duration > 0 && distanceKm > 0) {
    const asMinutes = Math.max(1, duration);
    const asSeconds = Math.max(1, duration / 60);
    const targetSpeed = SPEED_KMPH[mode];

    const speedFromMinutes = distanceKm / (asMinutes / 60);
    const speedFromSeconds = distanceKm / (asSeconds / 60);

    const minutesScore = Math.abs(Math.log((speedFromMinutes + 0.01) / (targetSpeed + 0.01)));
    const secondsScore = Math.abs(Math.log((speedFromSeconds + 0.01) / (targetSpeed + 0.01)));

    const best = secondsScore < minutesScore ? asSeconds : asMinutes;
    return Math.max(1, Math.round(best));
  }

  const speed = SPEED_KMPH[mode];
  return Math.max(1, Math.round((distanceKm / speed) * 60));
}

function pickTransitLeg(rawLegs: any[], mode: TransitMode): any | null {
  const predicate = (leg: any) => {
    const modeName = String(leg?.mode || '').toUpperCase();
    if (mode === 'bus') return modeName.includes('BUS');
    return modeName.includes('RAIL') || modeName.includes('SUBWAY') || modeName.includes('TRAIN') || modeName.includes('MRT');
  };

  return rawLegs.find(predicate) || null;
}

function extractServiceOrLine(rawLeg: any, mode: TransitMode): string {
  if (!rawLeg) return '';
  const candidates = [
    rawLeg.routeShortName,
    rawLeg.route,
    rawLeg.service,
    rawLeg.serviceNo,
    rawLeg.tripShortName,
    rawLeg.headsign,
    rawLeg.line,
  ]
    .map((v) => (v == null ? '' : String(v).trim()))
    .filter(Boolean);

  if (candidates.length === 0) return '';

  const primary = candidates[0];
  if (mode === 'bus') {
    const match = primary.match(/[0-9]{1,3}[A-Z]?/i);
    return match ? match[0].toUpperCase() : primary;
  }
  return primary;
}

function extractStopName(rawNode: any): string {
  if (!rawNode) return '';
  const candidates = [rawNode.name, rawNode.stopName, rawNode.label]
    .map((v) => (v == null ? '' : String(v).trim()))
    .filter(Boolean);
  return candidates[0] || '';
}

function extractHeadsign(rawLeg: any): string {
  if (!rawLeg) return '';
  const candidates = [rawLeg.headsign, rawLeg.direction, rawLeg.tripHeadsign]
    .map((v) => (v == null ? '' : String(v).trim()))
    .filter(Boolean);
  return candidates[0] || '';
}

function extractStopCode(rawNode: any, fallbackName = ''): string {
  const candidates = [
    rawNode?.stopCode,
    rawNode?.stopId,
    rawNode?.code,
    fallbackName,
  ]
    .map((v) => (v == null ? '' : String(v)))
    .filter(Boolean);

  for (const candidate of candidates) {
    const match = candidate.match(/\b\d{5}\b/);
    if (match) return match[0];
  }

  return '';
}

function normalizeServiceNo(value: string): string {
  const text = String(value || '').trim().toUpperCase();
  if (!text) return '';
  const match = text.match(/[0-9]{1,3}[A-Z]?/);
  return match ? match[0] : text;
}

async function getBusArrivalLive(
  env: Env,
  busStopCode: string,
  serviceNo: string
): Promise<TransitLive | undefined> {
  if (!env.LTA_ACCOUNT_KEY || !busStopCode || !serviceNo) return undefined;

  const key = `${busStopCode}:${serviceNo}`;
  const now = Date.now();
  const cached = ltaBusCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value || undefined;

  const url = new URL(LTA_BUS_ARRIVAL_URL);
  url.searchParams.set('BusStopCode', busStopCode);
  url.searchParams.set('ServiceNo', serviceNo);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        AccountKey: env.LTA_ACCOUNT_KEY,
        accept: 'application/json',
      },
    });
    if (!res.ok) {
      ltaBusCache.set(key, { value: null, expiresAt: now + LTA_BUS_TTL_MS });
      return undefined;
    }

    const data = await res.json();
    const services = Array.isArray(data?.Services) ? data.Services : [];
    const service =
      services.find((item: any) => String(item?.ServiceNo || '').toUpperCase() === serviceNo.toUpperCase()) ||
      services[0];

    const arrivalIso = service?.NextBus?.EstimatedArrival;
    if (!arrivalIso) {
      ltaBusCache.set(key, { value: null, expiresAt: now + LTA_BUS_TTL_MS });
      return undefined;
    }

    const etaMinutes = Math.max(0, Math.ceil((new Date(arrivalIso).getTime() - now) / 60_000));
    const confidence = Number(service?.NextBus?.Monitored) === 1 ? 'realtime' : 'estimated';
    const live: TransitLive = {
      etaMinutes,
      sampledAtIso: new Date(now).toISOString(),
      confidence,
    };

    ltaBusCache.set(key, {
      value: live,
      expiresAt: now + LTA_BUS_TTL_MS,
    });
    return live;
  } catch {
    ltaBusCache.set(key, { value: null, expiresAt: now + LTA_BUS_TTL_MS });
    return undefined;
  }
}

async function getTrainAlerts(env: Env): Promise<string[] | null> {
  if (!env.LTA_ACCOUNT_KEY) return null;

  const now = Date.now();
  if (ltaTrainCache && ltaTrainCache.expiresAt > now) {
    return ltaTrainCache.value;
  }

  try {
    const res = await fetch(LTA_TRAIN_ALERT_URL, {
      headers: {
        AccountKey: env.LTA_ACCOUNT_KEY,
        accept: 'application/json',
      },
    });

    if (!res.ok) {
      ltaTrainCache = { value: null, expiresAt: now + LTA_TRAIN_TTL_MS };
      return null;
    }

    const data = await res.json();
    const value = Array.isArray(data?.value) ? data.value : [];

    const disruptions = value.filter((item: any) => Number(item?.Status) === 2);
    const messages = disruptions
      .map((item: any) => String(item?.Message || '').trim())
      .filter(Boolean);

    const result = messages.length > 0 ? messages : null;
    ltaTrainCache = {
      value: result,
      expiresAt: now + LTA_TRAIN_TTL_MS,
    };
    return result;
  } catch {
    ltaTrainCache = { value: null, expiresAt: now + LTA_TRAIN_TTL_MS };
    return null;
  }
}

interface BuildStepArgs {
  rawLegs: any[];
  mode: TransitMode;
  serviceOrLine: string;
  boardName: string;
  alightName: string;
  numStops: number;
  durationMin: number;
}

function buildTransitSteps(args: BuildStepArgs): string[] {
  const { rawLegs, mode, serviceOrLine, boardName, alightName, numStops, durationMin } = args;

  if (!Array.isArray(rawLegs) || rawLegs.length === 0) {
    return genericModeSteps(mode, serviceOrLine, boardName, alightName, numStops, durationMin);
  }

  const steps = rawLegs
    .map((rawLeg) => {
      const modeName = String(rawLeg?.mode || '').toUpperCase();
      const toName = extractStopName(rawLeg?.to);
      const fromName = extractStopName(rawLeg?.from);
      const distanceKm = Math.max(0.05, toFiniteNumber(rawLeg?.distance) / 1000 || 0);

      if (modeName.includes('WALK')) {
        return `Walk ${formatDistance(distanceKm)} to ${toName || 'the next transfer point'}.`;
      }

      if (modeName.includes('BUS')) {
        const service = extractServiceOrLine(rawLeg, 'bus') || serviceOrLine || 'the bus service';
        const stops = Number.isFinite(toFiniteNumber(rawLeg?.numStops))
          ? ` (${Math.round(toFiniteNumber(rawLeg?.numStops))} stops)`
          : '';
        return `Take bus ${service} from ${fromName || boardName || 'the boarding stop'} to ${toName || alightName || 'the alighting stop'}${stops}.`;
      }

      if (modeName.includes('RAIL') || modeName.includes('SUBWAY') || modeName.includes('TRAIN') || modeName.includes('MRT')) {
        const line = extractServiceOrLine(rawLeg, 'train') || serviceOrLine || 'the train line';
        const stops = Number.isFinite(toFiniteNumber(rawLeg?.numStops))
          ? ` (${Math.round(toFiniteNumber(rawLeg?.numStops))} stops)`
          : '';
        return `Take ${line} from ${fromName || boardName || 'the boarding station'} to ${toName || alightName || 'the alighting station'}${stops}.`;
      }

      if (fromName || toName) {
        return `Continue from ${fromName || 'current point'} to ${toName || 'next point'} (${formatDistance(distanceKm)}).`;
      }

      return '';
    })
    .filter(Boolean);

  if (steps.length > 0) return steps.slice(0, 8);
  return genericModeSteps(mode, serviceOrLine, boardName, alightName, numStops, durationMin);
}

function genericModeSteps(
  mode: TransitMode,
  serviceOrLine: string,
  boardName: string,
  alightName: string,
  numStops: number,
  durationMin: number
): string[] {
  const board = boardName || (mode === 'bus' ? 'a nearby bus stop' : 'a nearby MRT/LRT station');
  const alight = alightName || 'your destination stop';
  if (mode === 'bus') {
    return [
      `Walk to ${board}.`,
      `Take bus ${serviceOrLine || 'service'} for about ${durationMin} min.`,
      `Alight at ${alight}${Number.isFinite(numStops) ? ` (${Math.max(1, Math.round(numStops))} stops)` : ''}.`,
    ];
  }

  return [
    `Walk to ${board}.`,
    `Take ${serviceOrLine || 'the MRT/LRT line'} for about ${durationMin} min.`,
    `Exit at ${alight}${Number.isFinite(numStops) ? ` (${Math.max(1, Math.round(numStops))} stops)` : ''}.`,
  ];
}

function decodeItineraryGeometry(rawLegs: any[], from: Coord, to: Coord): [number, number][] {
  const allCoords: [number, number][] = [];

  rawLegs.forEach((rawLeg, idx) => {
    const encoded = rawLeg?.legGeometry?.points;
    const decoded = typeof encoded === 'string' ? decodePolyline(encoded) : [];
    const coords = decoded.length > 0 ? decoded : inferLegFallbackCoords(rawLeg);

    if (coords.length === 0) return;

    if (idx > 0) coords.shift();
    allCoords.push(...coords);
  });

  if (allCoords.length > 0) return allCoords;
  return [
    [from.lat, from.lng],
    [to.lat, to.lng],
  ];
}

function inferLegFallbackCoords(rawLeg: any): [number, number][] {
  const fromLat = toFiniteNumber(rawLeg?.from?.lat);
  const fromLon = toFiniteNumber(rawLeg?.from?.lon ?? rawLeg?.from?.lng);
  const toLat = toFiniteNumber(rawLeg?.to?.lat);
  const toLon = toFiniteNumber(rawLeg?.to?.lon ?? rawLeg?.to?.lng);

  if ([fromLat, fromLon, toLat, toLon].every(Number.isFinite)) {
    return [
      [fromLat, fromLon],
      [toLat, toLon],
    ];
  }

  return [];
}

function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coords.push([lat / 1e5, lng / 1e5]);
  }

  return coords;
}

function buildFallbackLeg(from: Coord, to: Coord, mode: TransitMode, warnings: string[]): TransitLeg {
  const distanceKm = Math.max(0.1, haversineKm(from, to));
  const durationMin = Math.max(1, Math.round((distanceKm / SPEED_KMPH[mode]) * 60));

  const transit: TransitDetails = {
    kind: mode,
    serviceOrLine: undefined,
    boardStopOrStation: undefined,
    alightStopOrStation: undefined,
  };

  return {
    from,
    to,
    distanceKm,
    durationMin,
    steps: genericModeSteps(mode, '', '', '', NaN, durationMin),
    latlngs: [
      [from.lat, from.lng],
      [to.lat, to.lng],
    ],
    transit,
    warnings: dedupe(warnings),
    exact: false,
  };
}

function haversineKm(a: Coord, b: Coord): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function formatDistance(distanceKm: number): string {
  if (distanceKm >= 1) return `${distanceKm.toFixed(1)} km`;
  return `${Math.max(50, Math.round((distanceKm * 1000) / 10) * 10)} m`;
}

function roundCoord(coord: Coord): string {
  return `${coord.lat.toFixed(5)},${coord.lng.toFixed(5)}`;
}

function toFiniteNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : NaN;
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  values.forEach((value) => {
    const text = String(value || '').trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    out.push(text);
  });
  return out;
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
