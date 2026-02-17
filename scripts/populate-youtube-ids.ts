/**
 * Populate missing youtubeVideoId fields using a fixed episode -> video ID map.
 *
 * Usage:
 *   bun scripts/populate-youtube-ids.ts
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stalls } from '../src/data/stalls';

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, 'src', 'data');
const CUISINES_DIR = join(DATA_DIR, 'cuisines');

const EPISODE_VIDEO_IDS: Record<string, string> = {
  '1': 'VtI1jReYURc',
  '2': 'HCEt9dZewQI',
  '3': 'C3ZHkCbk9lE',
  '4': '7ulGVnQtdUQ',
  '5': '064LPEThd80',
  '6': 'QUfLVsImPQs',
  '7': 'bnbrOAaAXH4',
  '8': 'KPcVViNXiao',
  '9': 'VwbWO4to_fQ',
  '9.5': 'jYzdZ5oTF5Y',
  '10': 'dcLbVk7RUTA',
  '11': 'FYwR2CruOhg',
  '12': 'lu43mArWhhQ',
  '13': 'NvUCBADOL_E',
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function titleVariants(title: string): string[] {
  const variants = new Set<string>([title]);
  variants.add(title.replace(/'/g, "\\'"));
  variants.add(title.replace(/"/g, '\\"'));
  return [...variants];
}

function getDataFiles(): string[] {
  return [
    join(DATA_DIR, 'stalls.ts'),
    ...readdirSync(CUISINES_DIR)
      .filter((name) => name.endsWith('.ts'))
      .map((name) => join(CUISINES_DIR, name)),
  ];
}

function buildTitleToVideoIdMap(): Map<string, string> {
  const titleToId = new Map<string, string>();
  const unresolvedEpisodes = new Set<string>();

  for (const stall of stalls) {
    const title = stall.youtubeTitle.trim();
    if (!title || stall.youtubeVideoId) continue;

    const episodeKey = String(stall.episodeNumber);
    const videoId = EPISODE_VIDEO_IDS[episodeKey];
    if (!videoId) {
      unresolvedEpisodes.add(episodeKey);
      continue;
    }

    const existing = titleToId.get(title);
    if (existing && existing !== videoId) {
      throw new Error(
        `Conflicting video IDs for title "${title}": "${existing}" vs "${videoId}"`
      );
    }
    titleToId.set(title, videoId);
  }

  if (unresolvedEpisodes.size > 0) {
    throw new Error(
      `Missing episode mappings for: ${[...unresolvedEpisodes].sort().join(', ')}`
    );
  }

  return titleToId;
}

function insertVideoIdByTitle(content: string, title: string, videoId: string): [string, number] {
  let next = content;
  let replacements = 0;

  for (const variant of titleVariants(title)) {
    const titleRe = escapeRegex(variant);
    const pattern = new RegExp(
      `(youtubeTitle:\\s*)(['"])${titleRe}\\2(,\\s*)(googleMapsName:)`,
      'g'
    );

    next = next.replace(pattern, (_m, p1: string, quote: string, p3: string, p4: string) => {
      replacements += 1;
      return `${p1}${quote}${variant}${quote}${p3}youtubeVideoId: '${videoId}'${p3}${p4}`;
    });
  }

  return [next, replacements];
}

function main() {
  const titleToVideoId = buildTitleToVideoIdMap();
  if (titleToVideoId.size === 0) {
    console.log('No missing youtubeVideoId values.');
    return;
  }

  console.log(`Applying ${titleToVideoId.size} youtubeVideoId updates from episode mappings...`);

  const dataFiles = getDataFiles();
  let totalReplacements = 0;

  for (const filePath of dataFiles) {
    let content = readFileSync(filePath, 'utf-8');
    const before = content;
    let fileReplacements = 0;

    for (const [title, videoId] of titleToVideoId.entries()) {
      const [next, replacements] = insertVideoIdByTitle(content, title, videoId);
      content = next;
      fileReplacements += replacements;
      totalReplacements += replacements;
    }

    if (content !== before) {
      writeFileSync(filePath, content);
      console.log(`Updated ${filePath} (${fileReplacements} rows)`);
    }
  }

  console.log(`Inserted youtubeVideoId in ${totalReplacements} rows.`);
}

main();
