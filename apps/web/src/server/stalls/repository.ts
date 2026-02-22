import { Result } from 'better-result';
import * as z from 'zod/mini';

import type { D1Database } from '../cloudflare/runtime';
import { type CanonicalStall, mapDbRowToStall } from './contracts';

const activeStatusSchema = z.object({
  source_stall_key: z.string(),
  payload_hash: z.string(),
});

export interface ActiveStallIndexEntry {
  sourceStallKey: string;
  payloadHash: string;
}

export interface ApplyCanonicalStallsSummary {
  upsertedStalls: number;
  closedStalls: number;
  upsertedLocations: number;
}

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS stalls (
    id TEXT PRIMARY KEY,
    source_stall_key TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    cuisine TEXT NOT NULL,
    cuisine_label TEXT NOT NULL,
    country TEXT NOT NULL,
    primary_address TEXT NOT NULL,
    primary_lat REAL,
    primary_lng REAL,
    episode_number REAL,
    dish_name TEXT NOT NULL DEFAULT '',
    price REAL NOT NULL DEFAULT 0,
    rating_original REAL,
    rating_moderated REAL,
    opening_times TEXT NOT NULL DEFAULT '',
    time_categories_json TEXT NOT NULL DEFAULT '[]',
    hits_json TEXT NOT NULL DEFAULT '[]',
    misses_json TEXT NOT NULL DEFAULT '[]',
    youtube_title TEXT NOT NULL DEFAULT '',
    youtube_video_url TEXT,
    youtube_video_id TEXT,
    google_maps_name TEXT NOT NULL DEFAULT '',
    awards_json TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    source_rank INTEGER NOT NULL DEFAULT 0,
    source_sheet_hash TEXT,
    source_youtube_hash TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_synced_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS stall_locations (
    id TEXT PRIMARY KEY,
    stall_id TEXT NOT NULL,
    address TEXT NOT NULL,
    lat REAL,
    lng REAL,
    youtube_video_url TEXT,
    maps_query TEXT NOT NULL DEFAULT '',
    is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(stall_id, address),
    FOREIGN KEY (stall_id) REFERENCES stalls(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS stall_sync_runs (
    id TEXT PRIMARY KEY,
    trigger_source TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('dry-run', 'apply')),
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'guarded')),
    started_at TEXT NOT NULL,
    finished_at TEXT,
    summary_json TEXT NOT NULL DEFAULT '{}',
    error_text TEXT
  )`,
  'CREATE INDEX IF NOT EXISTS idx_stalls_status ON stalls(status)',
  'CREATE INDEX IF NOT EXISTS idx_stalls_cuisine ON stalls(cuisine)',
  'CREATE INDEX IF NOT EXISTS idx_stalls_country ON stalls(country)',
  'CREATE INDEX IF NOT EXISTS idx_stalls_last_synced_at ON stalls(last_synced_at)',
  'CREATE INDEX IF NOT EXISTS idx_stall_locations_stall_id ON stall_locations(stall_id)',
  'CREATE INDEX IF NOT EXISTS idx_stall_locations_primary ON stall_locations(stall_id, is_primary, is_active)',
] as const;

export async function ensureStallTables(db: D1Database): Promise<Result<void, Error>> {
  for (const statement of schemaStatements) {
    const isPragma = statement.trim().toUpperCase().startsWith('PRAGMA ');
    const executionResult = isPragma
      ? await Result.tryPromise(() => db.exec(statement))
      : await Result.tryPromise(() => db.prepare(statement).run());

    if (Result.isError(executionResult)) {
      const reason =
        executionResult.error instanceof Error
          ? executionResult.error.message
          : String(executionResult.error);
      return Result.err(
        new Error(`Failed to execute schema statement: ${statement}\nReason: ${reason}`)
      );
    }

    if (!executionResult.value.success) {
      return Result.err(new Error(`Schema statement reported unsuccessful execution: ${statement}`));
    }
  }

  return Result.ok();
}

export async function listActiveStalls(db: D1Database) {
  const query = `
    SELECT
      id,
      source_stall_key,
      slug,
      name,
      cuisine,
      cuisine_label,
      country,
      primary_address,
      primary_lat,
      primary_lng,
      episode_number,
      dish_name,
      price,
      rating_original,
      rating_moderated,
      opening_times,
      time_categories_json,
      hits_json,
      misses_json,
      youtube_title,
      youtube_video_url,
      youtube_video_id,
      google_maps_name,
      awards_json,
      status,
      source_rank,
      source_sheet_hash,
      source_youtube_hash,
      created_at,
      last_synced_at
    FROM stalls
    WHERE status = 'active'
    ORDER BY
      CASE WHEN rating_moderated IS NULL THEN -1 ELSE rating_moderated END DESC,
      name ASC
  `;

  const rowsResult = await Result.tryPromise(() =>
    db.prepare(query).all<Record<string, unknown>>()
  );
  if (Result.isError(rowsResult)) {
    return Result.err(new Error('Failed to read active stalls from D1.'));
  }

  const mapped = [];
  for (const row of rowsResult.value.results) {
    const mappedRow = mapDbRowToStall(row);
    if (Result.isError(mappedRow)) {
      return Result.err(mappedRow.error);
    }
    mapped.push(mappedRow.value);
  }

  return Result.ok(mapped);
}

export async function listActiveStallsByCuisine(db: D1Database, cuisine: string) {
  const query = `
    SELECT
      id,
      source_stall_key,
      slug,
      name,
      cuisine,
      cuisine_label,
      country,
      primary_address,
      primary_lat,
      primary_lng,
      episode_number,
      dish_name,
      price,
      rating_original,
      rating_moderated,
      opening_times,
      time_categories_json,
      hits_json,
      misses_json,
      youtube_title,
      youtube_video_url,
      youtube_video_id,
      google_maps_name,
      awards_json,
      status,
      source_rank,
      source_sheet_hash,
      source_youtube_hash,
      created_at,
      last_synced_at
    FROM stalls
    WHERE status = 'active' AND cuisine = ?
    ORDER BY
      CASE WHEN rating_moderated IS NULL THEN -1 ELSE rating_moderated END DESC,
      name ASC
  `;

  const rowsResult = await Result.tryPromise(() =>
    db.prepare(query).bind(cuisine).all<Record<string, unknown>>()
  );
  if (Result.isError(rowsResult)) {
    return Result.err(new Error('Failed to read cuisine stalls from D1.'));
  }

  const mapped = [];
  for (const row of rowsResult.value.results) {
    const mappedRow = mapDbRowToStall(row);
    if (Result.isError(mappedRow)) {
      return Result.err(mappedRow.error);
    }
    mapped.push(mappedRow.value);
  }

  return Result.ok(mapped);
}

export async function getActiveStallBySlug(db: D1Database, slug: string) {
  const query = `
    SELECT
      id,
      source_stall_key,
      slug,
      name,
      cuisine,
      cuisine_label,
      country,
      primary_address,
      primary_lat,
      primary_lng,
      episode_number,
      dish_name,
      price,
      rating_original,
      rating_moderated,
      opening_times,
      time_categories_json,
      hits_json,
      misses_json,
      youtube_title,
      youtube_video_url,
      youtube_video_id,
      google_maps_name,
      awards_json,
      status,
      source_rank,
      source_sheet_hash,
      source_youtube_hash,
      created_at,
      last_synced_at
    FROM stalls
    WHERE status = 'active' AND slug = ?
    LIMIT 1
  `;

  const rowResult = await Result.tryPromise(() =>
    db.prepare(query).bind(slug).first<Record<string, unknown>>()
  );
  if (Result.isError(rowResult)) {
    return Result.err(new Error('Failed to read stall by slug from D1.'));
  }

  const row = rowResult.value;
  if (!row) {
    return Result.ok(null);
  }

  const mapped = mapDbRowToStall(row);
  if (Result.isError(mapped)) {
    return Result.err(mapped.error);
  }

  return Result.ok(mapped.value);
}

export async function getActiveStallCount(db: D1Database): Promise<Result<number, Error>> {
  const countResult = await Result.tryPromise(() =>
    db.prepare("SELECT COUNT(*) AS count FROM stalls WHERE status = 'active'").first<Record<string, unknown>>()
  );
  if (Result.isError(countResult)) {
    return Result.err(new Error('Failed to read active stall count.'));
  }

  const count = Number((countResult.value?.count as number | string | undefined) ?? 0);
  return Result.ok(Number.isFinite(count) ? count : 0);
}

export async function getActiveStallIndex(
  db: D1Database
): Promise<Result<Map<string, ActiveStallIndexEntry>, Error>> {
  const query = `
    SELECT source_stall_key, (
      COALESCE(name, '') || '|' ||
      COALESCE(cuisine, '') || '|' ||
      COALESCE(cuisine_label, '') || '|' ||
      COALESCE(country, '') || '|' ||
      COALESCE(primary_address, '') || '|' ||
      COALESCE(primary_lat, '') || '|' ||
      COALESCE(primary_lng, '') || '|' ||
      COALESCE(episode_number, '') || '|' ||
      COALESCE(dish_name, '') || '|' ||
      COALESCE(price, '') || '|' ||
      COALESCE(rating_original, '') || '|' ||
      COALESCE(rating_moderated, '') || '|' ||
      COALESCE(opening_times, '') || '|' ||
      COALESCE(time_categories_json, '') || '|' ||
      COALESCE(hits_json, '') || '|' ||
      COALESCE(misses_json, '') || '|' ||
      COALESCE(youtube_title, '') || '|' ||
      COALESCE(youtube_video_url, '') || '|' ||
      COALESCE(youtube_video_id, '') || '|' ||
      COALESCE(google_maps_name, '') || '|' ||
      COALESCE(awards_json, '') || '|' ||
      COALESCE(status, '') || '|' ||
      COALESCE(source_rank, '') || '|' ||
      COALESCE(source_sheet_hash, '') || '|' ||
      COALESCE(source_youtube_hash, '')
    ) AS payload_hash
    FROM stalls
    WHERE status = 'active'
  `;

  const rowsResult = await Result.tryPromise(() =>
    db.prepare(query).all<Record<string, unknown>>()
  );
  if (Result.isError(rowsResult)) {
    return Result.err(new Error('Failed to read active stall index.'));
  }

  const map = new Map<string, ActiveStallIndexEntry>();
  for (const row of rowsResult.value.results) {
    const parsed = activeStatusSchema.safeParse(row);
    if (!parsed.success) {
      return Result.err(new Error('Invalid row returned for active stall index.'));
    }

    map.set(parsed.data.source_stall_key, {
      sourceStallKey: parsed.data.source_stall_key,
      payloadHash: parsed.data.payload_hash,
    });
  }

  return Result.ok(map);
}

export async function applyCanonicalStalls(
  db: D1Database,
  stalls: CanonicalStall[],
  syncedAtIso: string
): Promise<Result<ApplyCanonicalStallsSummary, Error>> {
  let upsertedStalls = 0;
  let upsertedLocations = 0;

  const workResult = await Result.tryPromise(async () => {
    for (const stall of stalls) {
      const stallUpsertQuery = `
        INSERT INTO stalls (
          id,
          source_stall_key,
          slug,
          name,
          cuisine,
          cuisine_label,
          country,
          primary_address,
          primary_lat,
          primary_lng,
          episode_number,
          dish_name,
          price,
          rating_original,
          rating_moderated,
          opening_times,
          time_categories_json,
          hits_json,
          misses_json,
          youtube_title,
          youtube_video_url,
          youtube_video_id,
          google_maps_name,
          awards_json,
          status,
          source_rank,
          source_sheet_hash,
          source_youtube_hash,
          updated_at,
          last_synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(source_stall_key) DO UPDATE SET
          slug = excluded.slug,
          name = excluded.name,
          cuisine = excluded.cuisine,
          cuisine_label = excluded.cuisine_label,
          country = excluded.country,
          primary_address = excluded.primary_address,
          primary_lat = excluded.primary_lat,
          primary_lng = excluded.primary_lng,
          episode_number = excluded.episode_number,
          dish_name = excluded.dish_name,
          price = excluded.price,
          rating_original = excluded.rating_original,
          rating_moderated = excluded.rating_moderated,
          opening_times = excluded.opening_times,
          time_categories_json = excluded.time_categories_json,
          hits_json = excluded.hits_json,
          misses_json = excluded.misses_json,
          youtube_title = excluded.youtube_title,
          youtube_video_url = excluded.youtube_video_url,
          youtube_video_id = excluded.youtube_video_id,
          google_maps_name = excluded.google_maps_name,
          awards_json = excluded.awards_json,
          status = excluded.status,
          source_rank = excluded.source_rank,
          source_sheet_hash = excluded.source_sheet_hash,
          source_youtube_hash = excluded.source_youtube_hash,
          updated_at = excluded.updated_at,
          last_synced_at = excluded.last_synced_at
      `;

      const stallUpsertResult = await Result.tryPromise(() =>
        db.prepare(stallUpsertQuery).bind(
          stall.id,
          stall.sourceStallKey,
          stall.slug,
          stall.name,
          stall.cuisine,
          stall.cuisineLabel,
          stall.country,
          stall.primaryAddress,
          stall.primaryLat,
          stall.primaryLng,
          stall.episodeNumber,
          stall.dishName,
          stall.price,
          stall.ratingOriginal,
          stall.ratingModerated,
          stall.openingTimes,
          JSON.stringify(stall.timeCategories),
          JSON.stringify(stall.hits),
          JSON.stringify(stall.misses),
          stall.youtubeTitle,
          stall.youtubeVideoUrl,
          stall.youtubeVideoId,
          stall.googleMapsName,
          JSON.stringify(stall.awards),
          stall.status,
          stall.sourceRank,
          stall.sourceSheetHash,
          stall.sourceYoutubeHash,
          syncedAtIso,
          syncedAtIso
        ).run()
      );
      if (Result.isError(stallUpsertResult)) {
        throw stallUpsertResult.error;
      }
      upsertedStalls += 1;

      const markInactiveResult = await Result.tryPromise(() =>
        db.prepare(
          `UPDATE stall_locations
           SET is_active = 0, is_primary = 0, updated_at = ?
           WHERE stall_id = ?`
        ).bind(syncedAtIso, stall.id).run()
      );
      if (Result.isError(markInactiveResult)) {
        throw markInactiveResult.error;
      }

      for (const location of stall.locations) {
        const locationUpsertResult = await Result.tryPromise(() =>
          db.prepare(
            `INSERT INTO stall_locations (
               id,
               stall_id,
               address,
               lat,
               lng,
               youtube_video_url,
               maps_query,
               is_primary,
               is_active,
               updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(stall_id, address) DO UPDATE SET
               id = excluded.id,
               lat = excluded.lat,
               lng = excluded.lng,
               youtube_video_url = excluded.youtube_video_url,
               maps_query = excluded.maps_query,
               is_primary = excluded.is_primary,
               is_active = excluded.is_active,
               updated_at = excluded.updated_at`
          ).bind(
            location.id,
            stall.id,
            location.address,
            location.lat,
            location.lng,
            location.youtubeVideoUrl,
            location.mapsQuery,
            location.isPrimary ? 1 : 0,
            location.isActive ? 1 : 0,
            syncedAtIso
          ).run()
        );
        if (Result.isError(locationUpsertResult)) {
          throw locationUpsertResult.error;
        }
        upsertedLocations += 1;
      }
    }

    const closeMissingResult = await Result.tryPromise(() =>
      db.prepare(
        `UPDATE stalls
         SET status = 'closed', updated_at = ?, last_synced_at = ?
         WHERE status = 'active' AND last_synced_at <> ?`
      ).bind(syncedAtIso, syncedAtIso, syncedAtIso).run()
    );
    if (Result.isError(closeMissingResult)) {
      throw closeMissingResult.error;
    }

    const deactivateLocationsResult = await Result.tryPromise(() =>
      db.prepare(
        `UPDATE stall_locations
         SET is_active = 0, is_primary = 0, updated_at = ?
         WHERE stall_id IN (SELECT id FROM stalls WHERE status = 'closed')`
      ).bind(syncedAtIso).run()
    );
    if (Result.isError(deactivateLocationsResult)) {
      throw deactivateLocationsResult.error;
    }
  });

  if (Result.isError(workResult)) {
    const reason = workResult.error instanceof Error ? workResult.error.message : String(workResult.error);
    return Result.err(new Error(`Failed to apply canonical stalls to D1. Reason: ${reason}`));
  }

  const closedCountResult = await Result.tryPromise(() =>
    db.prepare(
      `SELECT COUNT(*) AS count FROM stalls WHERE status = 'closed' AND updated_at = ?`
    ).bind(syncedAtIso).first<Record<string, unknown>>()
  );

  const closedStalls = Result.isError(closedCountResult)
    ? 0
    : Number((closedCountResult.value?.count as number | string | undefined) ?? 0);

  return Result.ok({
    upsertedStalls,
    closedStalls: Number.isFinite(closedStalls) ? closedStalls : 0,
    upsertedLocations,
  });
}

export interface SyncRunRecord {
  id: string;
  triggerSource: string;
  mode: 'dry-run' | 'apply';
  status: 'success' | 'failed' | 'guarded';
  startedAt: string;
  finishedAt: string;
  summaryJson: string;
  errorText: string | null;
}

export async function insertSyncRun(
  db: D1Database,
  run: SyncRunRecord
): Promise<Result<void, Error>> {
  const insertResult = await Result.tryPromise(() =>
    db.prepare(
      `INSERT INTO stall_sync_runs (
         id,
         trigger_source,
         mode,
         status,
         started_at,
         finished_at,
         summary_json,
         error_text
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      run.id,
      run.triggerSource,
      run.mode,
      run.status,
      run.startedAt,
      run.finishedAt,
      run.summaryJson,
      run.errorText
    ).run()
  );

  if (Result.isError(insertResult)) {
    return Result.err(new Error('Failed to insert stall sync run record.'));
  }

  return Result.ok();
}
