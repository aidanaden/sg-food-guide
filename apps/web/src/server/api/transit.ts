import { Result, type Result as ResultType } from 'better-result';
import * as z from 'zod/mini';

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
const MAX_STOPS = 25;

let oneMapTokenCache: CacheEntry<string> | null = null;
const ltaBusCache = new Map<string, CacheEntry<TransitLive | null>>();
let ltaTrainCache: CacheEntry<string[] | null> | null = null;
const transitQuerySchema = z.object({
  mode: z.string(),
  stops: z.string(),
});
const modeSchema = z.enum(['bus', 'train']);
const coordSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});
const oneMapLegNodeSchema = z.object({
  name: z.optional(z.union([z.string(), z.number()])),
  stopName: z.optional(z.union([z.string(), z.number()])),
  label: z.optional(z.union([z.string(), z.number()])),
  stopCode: z.optional(z.union([z.string(), z.number()])),
  stopId: z.optional(z.union([z.string(), z.number()])),
  code: z.optional(z.union([z.string(), z.number()])),
  lat: z.optional(z.union([z.string(), z.number()])),
  lon: z.optional(z.union([z.string(), z.number()])),
  lng: z.optional(z.union([z.string(), z.number()])),
});
const oneMapLegSchema = z.object({
  mode: z.optional(z.union([z.string(), z.number()])),
  distance: z.optional(z.union([z.string(), z.number()])),
  numStops: z.optional(z.union([z.string(), z.number()])),
  routeShortName: z.optional(z.union([z.string(), z.number()])),
  route: z.optional(z.union([z.string(), z.number()])),
  service: z.optional(z.union([z.string(), z.number()])),
  serviceNo: z.optional(z.union([z.string(), z.number()])),
  tripShortName: z.optional(z.union([z.string(), z.number()])),
  headsign: z.optional(z.union([z.string(), z.number()])),
  line: z.optional(z.union([z.string(), z.number()])),
  direction: z.optional(z.union([z.string(), z.number()])),
  tripHeadsign: z.optional(z.union([z.string(), z.number()])),
  from: z.optional(oneMapLegNodeSchema),
  to: z.optional(oneMapLegNodeSchema),
  legGeometry: z.optional(z.object({
    points: z.optional(z.string()),
  })),
});
const oneMapItinerarySchema = z.object({
  duration: z.optional(z.union([z.string(), z.number()])),
  legs: z.optional(z.array(oneMapLegSchema)),
});
const oneMapAuthSchema = z.object({
  access_token: z.optional(z.string()),
  expiry_timestamp: z.optional(z.union([z.number(), z.string()])),
});
const oneMapRouteSchema = z.object({
  plan: z.optional(
    z.object({
      itineraries: z.optional(z.array(oneMapItinerarySchema)),
    })
  ),
});
const ltaBusServiceSchema = z.object({
  ServiceNo: z.optional(z.union([z.string(), z.number()])),
  NextBus: z.optional(z.object({
    EstimatedArrival: z.optional(z.string()),
    Monitored: z.optional(z.union([z.number(), z.string()])),
  })),
});
const ltaBusPayloadSchema = z.object({
  Services: z.optional(z.array(ltaBusServiceSchema)),
});
const ltaTrainPayloadSchema = z.object({
  value: z.optional(z.array(z.object({
    Status: z.optional(z.union([z.number(), z.string()])),
    Message: z.optional(z.string()),
  }))),
});

type OneMapRoutePayload = z.infer<typeof oneMapRouteSchema>;
type OneMapItinerary = z.infer<typeof oneMapItinerarySchema>;
type OneMapLeg = z.infer<typeof oneMapLegSchema>;
type OneMapLegNode = z.infer<typeof oneMapLegNodeSchema>;

const oneMapRouteCache = new Map<string, CacheEntry<OneMapRoutePayload>>();

interface TransitQuery {
  mode: TransitMode;
  stops: Coord[];
}

export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const { searchParams } = new URL(request.url);

  const parsedQuery = parseTransitQuery(searchParams);
  if (Result.isError(parsedQuery)) {
    return json(
      {
        error: parsedQuery.error,
      },
      400
    );
  }

  const { mode, stops } = parsedQuery.value;

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

function parseTransitQuery(searchParams: URLSearchParams): ResultType<TransitQuery, string> {
  const parsed = transitQuerySchema.safeParse({
    mode: searchParams.get('mode') ?? '',
    stops: searchParams.get('stops') ?? '',
  });
  if (!parsed.success) {
    return Result.err('Invalid transit query parameters.');
  }

  const modeResult = modeSchema.safeParse(parsed.data.mode);
  if (!modeResult.success) {
    return Result.err('Invalid mode. Expected "bus" or "train".');
  }

  const stops = parseStops(parsed.data.stops);
  if (stops.length > MAX_STOPS) {
    return Result.err(`Too many stops. Maximum supported stops per request is ${MAX_STOPS}.`);
  }
  if (stops.length < 2) {
    return Result.err('At least two valid stops are required in the "stops" query parameter.');
  }

  return Result.ok({
    mode: modeResult.data,
    stops,
  });
}

function parseStops(value: string): Coord[] {
  const parsedStops: Coord[] = [];

  value
    .split('|')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .forEach((chunk) => {
      const [latRaw, lngRaw] = chunk.split(',');
      const lat = Number(latRaw);
      const lng = Number(lngRaw);
      const parsed = coordSchema.safeParse({ lat, lng });
      if (!parsed.success) return;
      if (parsed.data.lat < -90 || parsed.data.lat > 90 || parsed.data.lng < -180 || parsed.data.lng > 180) {
        return;
      }
      parsedStops.push(parsed.data);
    });

  return parsedStops;
}

function buildLegPairs(stops: Coord[]): Array<[Coord, Coord]> {
  const pairs: Array<[Coord, Coord]> = [];
  for (let i = 1; i < stops.length; i++) {
    const from = stops[i - 1];
    const to = stops[i];
    if (!from || !to) continue;
    pairs.push([from, to]);
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

  const responseResult = await Result.tryPromise(() => fetch(ONE_MAP_AUTH_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: env.ONEMAP_EMAIL,
      password: env.ONEMAP_PASSWORD,
    }),
  }));
  if (Result.isError(responseResult)) return null;

  const response = responseResult.value;
  if (!response.ok) return null;

  const jsonResult = await Result.tryPromise(() => response.json());
  if (Result.isError(jsonResult)) return null;

  const payload = oneMapAuthSchema.safeParse(jsonResult.value);
  if (!payload.success || !payload.data.access_token) return null;

  const rawExpiry = Number(payload.data.expiry_timestamp || 0);
  const rawExpiryMs =
    rawExpiry > 1_000_000_000_000 ? rawExpiry : rawExpiry * 1000;
  const expiresAt =
    rawExpiry > 0
      ? rawExpiryMs - ONE_MAP_TOKEN_SKEW_MS
      : now + 30 * 60_000;

  oneMapTokenCache = {
    value: payload.data.access_token,
    expiresAt,
  };

  return payload.data.access_token;
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
): Promise<OneMapRoutePayload | null> {
  const key = `${mode}:${roundCoord(from)}>${roundCoord(to)}`;
  const cached = oneMapRouteCache.get(key);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;

  const { dateStr, timeStr } = getSingaporeDateTimeStrings();

  const url = new URL(ONE_MAP_ROUTE_URL);
  url.searchParams.set('start', `${from.lat},${from.lng}`);
  url.searchParams.set('end', `${to.lat},${to.lng}`);
  url.searchParams.set('routeType', 'pt');
  url.searchParams.set('mode', mode.toUpperCase());
  url.searchParams.set('date', dateStr);
  url.searchParams.set('time', timeStr);

  const responseResult = await Result.tryPromise(() => fetch(url.toString(), {
    headers: {
      authorization: `Bearer ${token}`,
    },
  }));
  if (Result.isError(responseResult)) return null;

  const response = responseResult.value;
  if (!response.ok) return null;

  const jsonResult = await Result.tryPromise(() => response.json());
  if (Result.isError(jsonResult)) return null;

  const payload = oneMapRouteSchema.safeParse(jsonResult.value);
  if (!payload.success) return null;

  oneMapRouteCache.set(key, {
    value: payload.data,
    expiresAt: now + ONE_MAP_ROUTE_TTL_MS,
  });
  return payload.data;
}

function getSingaporeDateTimeStrings(value = new Date()): { dateStr: string; timeStr: string } {
  const parts = new Intl.DateTimeFormat('en-SG', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(value);

  const map = new Map(parts.map((part) => [part.type, part.value]));
  const month = map.get('month') || '01';
  const day = map.get('day') || '01';
  const year = map.get('year') || '1970';
  const hourRaw = map.get('hour') || '00';
  const hour = hourRaw === '24' ? '00' : hourRaw;
  const minute = map.get('minute') || '00';
  const second = map.get('second') || '00';

  return {
    dateStr: `${month}-${day}-${year}`,
    timeStr: `${hour}:${minute}:${second}`,
  };
}

function pickPrimaryItinerary(data: OneMapRoutePayload): OneMapItinerary | null {
  const itineraries = data.plan?.itineraries;
  if (!itineraries || itineraries.length === 0) return null;
  return itineraries[0] ?? null;
}

function inferDistanceKm(rawLegs: OneMapLeg[], from: Coord, to: Coord): number {
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

function pickTransitLeg(rawLegs: OneMapLeg[], mode: TransitMode): OneMapLeg | null {
  const predicate = (leg: OneMapLeg) => {
    const modeName = String(leg?.mode || '').toUpperCase();
    if (mode === 'bus') return modeName.includes('BUS');
    return modeName.includes('RAIL') || modeName.includes('SUBWAY') || modeName.includes('TRAIN') || modeName.includes('MRT');
  };

  return rawLegs.find(predicate) || null;
}

function extractServiceOrLine(rawLeg: OneMapLeg | null | undefined, mode: TransitMode): string {
  if (!rawLeg) return '';
  const primary = [
    rawLeg.routeShortName,
    rawLeg.route,
    rawLeg.service,
    rawLeg.serviceNo,
    rawLeg.tripShortName,
    rawLeg.headsign,
    rawLeg.line,
  ]
    .map((v) => (v == null ? '' : String(v).trim()))
    .find((value) => value.length > 0);

  if (!primary) return '';
  if (mode === 'bus') {
    const match = primary.match(/[0-9]{1,3}[A-Z]?/i);
    return match ? match[0].toUpperCase() : primary;
  }
  return primary;
}

function extractStopName(rawNode: OneMapLegNode | null | undefined): string {
  if (!rawNode) return '';
  const primary = [rawNode.name, rawNode.stopName, rawNode.label]
    .map((v) => (v == null ? '' : String(v).trim()))
    .find((value) => value.length > 0);
  return primary || '';
}

function extractHeadsign(rawLeg: OneMapLeg | null | undefined): string {
  if (!rawLeg) return '';
  const primary = [rawLeg.headsign, rawLeg.direction, rawLeg.tripHeadsign]
    .map((v) => (v == null ? '' : String(v).trim()))
    .find((value) => value.length > 0);
  return primary || '';
}

function extractStopCode(rawNode: OneMapLegNode | null | undefined, fallbackName = ''): string {
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
  const ltaAccountKey = env.LTA_ACCOUNT_KEY;
  if (!ltaAccountKey || !busStopCode || !serviceNo) return undefined;

  const key = `${busStopCode}:${serviceNo}`;
  const now = Date.now();
  const cached = ltaBusCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value || undefined;

  const url = new URL(LTA_BUS_ARRIVAL_URL);
  url.searchParams.set('BusStopCode', busStopCode);
  url.searchParams.set('ServiceNo', serviceNo);

  const responseResult = await Result.tryPromise(() => fetch(url.toString(), {
    headers: {
      AccountKey: ltaAccountKey,
      accept: 'application/json',
    },
  }));
  if (Result.isError(responseResult)) {
    ltaBusCache.set(key, { value: null, expiresAt: now + LTA_BUS_TTL_MS });
    return undefined;
  }

  const response = responseResult.value;
  if (!response.ok) {
    ltaBusCache.set(key, { value: null, expiresAt: now + LTA_BUS_TTL_MS });
    return undefined;
  }

  const jsonResult = await Result.tryPromise(() => response.json());
  if (Result.isError(jsonResult)) {
    ltaBusCache.set(key, { value: null, expiresAt: now + LTA_BUS_TTL_MS });
    return undefined;
  }

  const payload = ltaBusPayloadSchema.safeParse(jsonResult.value);
  const services = payload.success ? payload.data.Services || [] : [];
  const service =
    services.find((item) => String(item.ServiceNo || '').toUpperCase() === serviceNo.toUpperCase()) ||
    services[0];

  const arrivalIso = service?.NextBus?.EstimatedArrival;
  if (!arrivalIso) {
    ltaBusCache.set(key, { value: null, expiresAt: now + LTA_BUS_TTL_MS });
    return undefined;
  }

  const arrivalMs = new Date(arrivalIso).getTime();
  if (!Number.isFinite(arrivalMs)) {
    ltaBusCache.set(key, { value: null, expiresAt: now + LTA_BUS_TTL_MS });
    return undefined;
  }

  const etaMinutes = Math.max(0, Math.ceil((arrivalMs - now) / 60_000));
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
}

async function getTrainAlerts(env: Env): Promise<string[] | null> {
  const ltaAccountKey = env.LTA_ACCOUNT_KEY;
  if (!ltaAccountKey) return null;

  const now = Date.now();
  if (ltaTrainCache && ltaTrainCache.expiresAt > now) {
    return ltaTrainCache.value;
  }

  const responseResult = await Result.tryPromise(() => fetch(LTA_TRAIN_ALERT_URL, {
    headers: {
      AccountKey: ltaAccountKey,
      accept: 'application/json',
    },
  }));
  if (Result.isError(responseResult)) {
    ltaTrainCache = { value: null, expiresAt: now + LTA_TRAIN_TTL_MS };
    return null;
  }

  const response = responseResult.value;
  if (!response.ok) {
    ltaTrainCache = { value: null, expiresAt: now + LTA_TRAIN_TTL_MS };
    return null;
  }

  const jsonResult = await Result.tryPromise(() => response.json());
  if (Result.isError(jsonResult)) {
    ltaTrainCache = { value: null, expiresAt: now + LTA_TRAIN_TTL_MS };
    return null;
  }

  const payload = ltaTrainPayloadSchema.safeParse(jsonResult.value);
  const value = payload.success ? payload.data.value || [] : [];

  const disruptions = value.filter((item) => Number(item.Status) === 2);
  const messages = disruptions
    .map((item) => String(item.Message || '').trim())
    .filter(Boolean);

  const result = messages.length > 0 ? messages : null;
  ltaTrainCache = {
    value: result,
    expiresAt: now + LTA_TRAIN_TTL_MS,
  };
  return result;
}

interface BuildStepArgs {
  rawLegs: OneMapLeg[];
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

function decodeItineraryGeometry(rawLegs: OneMapLeg[], from: Coord, to: Coord): [number, number][] {
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

function inferLegFallbackCoords(rawLeg: OneMapLeg): [number, number][] {
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
