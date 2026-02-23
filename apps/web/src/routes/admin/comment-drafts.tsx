import { Link, createFileRoute } from "@tanstack/react-router";
import { Result } from "better-result";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Button,
  Checkbox,
  Input,
  Label,
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sg-food-guide/ui";

import {
  getCommentSuggestionAdminData,
  reviewCommentSuggestionDraft,
} from "../../server/comment-suggestions/admin.functions";
import type {
  AdminDraftSortField,
  CommentSuggestionDraft,
  ExtractionMethod,
  ModerationFlag,
} from "../../server/comment-suggestions/contracts";

type DraftStatusFilter = "new" | "reviewed" | "approved" | "rejected";
type SortDirection = "asc" | "desc";
type LogicMode = "all" | "any";
type ModerationFlagMode = "all" | "any" | "none";
type TriState = "all" | "yes" | "no";
type PresetId = "default" | "reviewQueue" | "highSignal" | "rejectedCleanup";

interface SortRule {
  field: AdminDraftSortField;
  direction: SortDirection;
}

interface DraftEditState {
  editedName: string;
  editedCountry: string;
  reviewNote: string;
  rejectedReason: string;
}

interface AdminDraftQueryState {
  searchInput: string;
  logicMode: LogicMode;
  statuses: DraftStatusFilter[];
  countries: string[];
  extractionMethods: ExtractionMethod[];
  moderationFlags: ModerationFlag[];
  moderationFlagMode: ModerationFlagMode;
  hasMapsUrls: TriState;
  hasReviewNote: TriState;
  hasRejectedReason: TriState;
  minConfidenceScore: string;
  maxConfidenceScore: string;
  minSupportCount: string;
  maxSupportCount: string;
  minTopLikeCount: string;
  maxTopLikeCount: string;
  sortRules: SortRule[];
  pageSize: 50 | 100;
}

interface AdminDraftListRequestInput {
  status: "all";
  statuses?: DraftStatusFilter[];
  countries?: string[];
  extractionMethods?: ExtractionMethod[];
  moderationFlags?: ModerationFlag[];
  moderationFlagMode?: ModerationFlagMode;
  hasMapsUrls?: boolean;
  hasReviewNote?: boolean;
  hasRejectedReason?: boolean;
  minConfidenceScore?: number;
  maxConfidenceScore?: number;
  minSupportCount?: number;
  maxSupportCount?: number;
  minTopLikeCount?: number;
  maxTopLikeCount?: number;
  query?: string;
  logicMode?: LogicMode;
  sort?: SortRule[];
  cursor?: string;
  limit?: number;
}

const allStatuses: DraftStatusFilter[] = ["new", "reviewed", "approved", "rejected"];
const allExtractionMethods: ExtractionMethod[] = ["rules", "llm", "mixed"];
const allModerationFlags: ModerationFlag[] = [
  "spam",
  "profanity",
  "self-promo",
  "insufficient-signal",
];
const defaultSortRules: SortRule[] = [{ field: "topLikeCount", direction: "desc" }];

const sortFieldLabels: Record<AdminDraftSortField, string> = {
  normalizedName: "Normalized name",
  country: "Country",
  status: "Status",
  extractionMethod: "Extraction method",
  confidenceScore: "Confidence",
  supportCount: "Support count",
  topLikeCount: "Like count",
  createdAt: "Created at",
  updatedAt: "Updated at",
  firstSeenAt: "First seen",
  lastSeenAt: "Last seen",
  lastSyncedAt: "Last synced",
};

const statusLabels: Record<DraftStatusFilter, string> = {
  new: "New",
  reviewed: "Reviewed",
  approved: "Approved",
  rejected: "Rejected",
};

const extractionMethodLabels: Record<ExtractionMethod, string> = {
  rules: "Rules",
  llm: "LLM",
  mixed: "Mixed",
};

const moderationFlagLabels: Record<ModerationFlag, string> = {
  spam: "Spam",
  profanity: "Profanity",
  "self-promo": "Self promo",
  "insufficient-signal": "Insufficient signal",
};

const presetLabels: Record<PresetId, string> = {
  default: "Default",
  reviewQueue: "Review queue",
  highSignal: "High signal",
  rejectedCleanup: "Rejected cleanup",
};

const queryStorageKey = "admin-comment-drafts-query-v1";

const defaultQueryState: AdminDraftQueryState = {
  searchInput: "",
  logicMode: "all",
  statuses: allStatuses,
  countries: [],
  extractionMethods: allExtractionMethods,
  moderationFlags: [],
  moderationFlagMode: "any",
  hasMapsUrls: "all",
  hasReviewNote: "all",
  hasRejectedReason: "all",
  minConfidenceScore: "",
  maxConfidenceScore: "",
  minSupportCount: "",
  maxSupportCount: "",
  minTopLikeCount: "",
  maxTopLikeCount: "",
  sortRules: defaultSortRules,
  pageSize: 50,
};

function uniqueStrings<T extends string>(values: T[]): T[] {
  const seen = new Set<T>();
  const result: T[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
}

function parseCsv(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return uniqueStrings(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function normalizeSortRules(rules: SortRule[] | undefined): SortRule[] {
  if (!rules?.length) {
    return defaultSortRules;
  }

  const seen = new Set<AdminDraftSortField>();
  const next: SortRule[] = [];
  for (const rule of rules) {
    if (!(rule.field in sortFieldLabels)) {
      continue;
    }
    if (seen.has(rule.field)) {
      continue;
    }

    seen.add(rule.field);
    next.push({
      field: rule.field,
      direction: rule.direction === "asc" ? "asc" : "desc",
    });

    if (next.length >= 3) {
      break;
    }
  }

  return next.length > 0 ? next : defaultSortRules;
}

function normalizeStatuses(statuses: string[] | undefined): DraftStatusFilter[] {
  if (!statuses?.length) {
    return allStatuses;
  }

  const normalized = uniqueStrings(
    statuses
      .map((status) => status.trim().toLowerCase())
      .filter((status): status is DraftStatusFilter =>
        allStatuses.includes(status as DraftStatusFilter),
      ),
  );

  return normalized.length > 0 ? normalized : allStatuses;
}

function normalizeExtractionMethods(methods: string[] | undefined): ExtractionMethod[] {
  if (!methods?.length) {
    return allExtractionMethods;
  }

  const normalized = uniqueStrings(
    methods
      .map((method) => method.trim().toLowerCase())
      .filter((method): method is ExtractionMethod =>
        allExtractionMethods.includes(method as ExtractionMethod),
      ),
  );

  return normalized.length > 0 ? normalized : allExtractionMethods;
}

function normalizeModerationFlags(flags: string[] | undefined): ModerationFlag[] {
  if (!flags?.length) {
    return [];
  }

  return uniqueStrings(
    flags
      .map((flag) => flag.trim().toLowerCase())
      .filter((flag): flag is ModerationFlag =>
        allModerationFlags.includes(flag as ModerationFlag),
      ),
  );
}

function normalizeCountries(countries: string[] | undefined): string[] {
  if (!countries?.length) {
    return [];
  }

  return uniqueStrings(
    countries
      .map((country) => country.trim().toUpperCase())
      .filter((country) => country.length > 0)
      .slice(0, 20),
  );
}

function normalizeTriState(value: string | null | undefined): TriState {
  if (value === "yes" || value === "no") {
    return value;
  }
  return "all";
}

function normalizeQueryState(input: Partial<AdminDraftQueryState>): AdminDraftQueryState {
  const pageSize = input.pageSize === 100 ? 100 : 50;
  return {
    searchInput: typeof input.searchInput === "string" ? input.searchInput.slice(0, 200) : "",
    logicMode: input.logicMode === "any" ? "any" : "all",
    statuses: normalizeStatuses(input.statuses),
    countries: normalizeCountries(input.countries),
    extractionMethods: normalizeExtractionMethods(input.extractionMethods),
    moderationFlags: normalizeModerationFlags(input.moderationFlags),
    moderationFlagMode:
      input.moderationFlagMode === "all" || input.moderationFlagMode === "none"
        ? input.moderationFlagMode
        : "any",
    hasMapsUrls: normalizeTriState(input.hasMapsUrls),
    hasReviewNote: normalizeTriState(input.hasReviewNote),
    hasRejectedReason: normalizeTriState(input.hasRejectedReason),
    minConfidenceScore:
      typeof input.minConfidenceScore === "string" ? input.minConfidenceScore : "",
    maxConfidenceScore:
      typeof input.maxConfidenceScore === "string" ? input.maxConfidenceScore : "",
    minSupportCount: typeof input.minSupportCount === "string" ? input.minSupportCount : "",
    maxSupportCount: typeof input.maxSupportCount === "string" ? input.maxSupportCount : "",
    minTopLikeCount: typeof input.minTopLikeCount === "string" ? input.minTopLikeCount : "",
    maxTopLikeCount: typeof input.maxTopLikeCount === "string" ? input.maxTopLikeCount : "",
    sortRules: normalizeSortRules(input.sortRules),
    pageSize,
  };
}

function parseOptionalNumber(value: string, integer = false): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  if (integer) {
    return Math.max(0, Math.trunc(parsed));
  }
  return parsed;
}

function triStateToBoolean(value: TriState): boolean | undefined {
  if (value === "yes") {
    return true;
  }
  if (value === "no") {
    return false;
  }
  return undefined;
}

function buildDraftListRequestInput(
  state: AdminDraftQueryState,
  debouncedSearchQuery: string,
  cursor?: string,
): AdminDraftListRequestInput {
  const query = debouncedSearchQuery.trim();
  const statuses = state.statuses.length === allStatuses.length ? undefined : state.statuses;
  const extractionMethods =
    state.extractionMethods.length === allExtractionMethods.length
      ? undefined
      : state.extractionMethods;

  return {
    status: "all",
    statuses,
    countries: state.countries.length > 0 ? state.countries : undefined,
    extractionMethods,
    moderationFlags: state.moderationFlags.length > 0 ? state.moderationFlags : undefined,
    moderationFlagMode: state.moderationFlags.length > 0 ? state.moderationFlagMode : undefined,
    hasMapsUrls: triStateToBoolean(state.hasMapsUrls),
    hasReviewNote: triStateToBoolean(state.hasReviewNote),
    hasRejectedReason: triStateToBoolean(state.hasRejectedReason),
    minConfidenceScore: parseOptionalNumber(state.minConfidenceScore),
    maxConfidenceScore: parseOptionalNumber(state.maxConfidenceScore),
    minSupportCount: parseOptionalNumber(state.minSupportCount, true),
    maxSupportCount: parseOptionalNumber(state.maxSupportCount, true),
    minTopLikeCount: parseOptionalNumber(state.minTopLikeCount, true),
    maxTopLikeCount: parseOptionalNumber(state.maxTopLikeCount, true),
    query: query.length > 0 ? query : undefined,
    logicMode: state.logicMode,
    sort: normalizeSortRules(state.sortRules),
    cursor,
    limit: state.pageSize,
  };
}

function buildRequestKey(input: AdminDraftListRequestInput): string {
  return JSON.stringify(input);
}

function readQueryStateFromUrl(): Partial<AdminDraftQueryState> {
  if (typeof window === "undefined") {
    return {};
  }

  const params = new URLSearchParams(window.location.search);
  const sortTokens = parseCsv(params.get("sort"));
  const sortRules: SortRule[] = sortTokens
    .map((token) => {
      const [field, direction] = token.split(":");
      if (field == null || !(field in sortFieldLabels)) {
        return null;
      }
      if (direction !== "asc" && direction !== "desc") {
        return null;
      }
      return {
        field: field as AdminDraftSortField,
        direction,
      };
    })
    .filter((rule): rule is SortRule => rule !== null);

  const pageSizeParam = params.get("ps");
  const pageSize = pageSizeParam === "100" ? 100 : pageSizeParam === "50" ? 50 : undefined;

  const nextState: Partial<AdminDraftQueryState> = {};
  const searchInput = params.get("q");
  if (searchInput !== null) {
    nextState.searchInput = searchInput;
  }

  const logic = params.get("logic");
  if (logic === "all" || logic === "any") {
    nextState.logicMode = logic;
  }

  if (params.get("status") !== null) {
    nextState.statuses = normalizeStatuses(parseCsv(params.get("status")));
  }

  if (params.get("country") !== null) {
    nextState.countries = normalizeCountries(parseCsv(params.get("country")));
  }

  if (params.get("method") !== null) {
    nextState.extractionMethods = normalizeExtractionMethods(parseCsv(params.get("method")));
  }

  if (params.get("flag") !== null) {
    nextState.moderationFlags = normalizeModerationFlags(parseCsv(params.get("flag")));
  }

  const flagMode = params.get("flagMode");
  if (flagMode === "all" || flagMode === "any" || flagMode === "none") {
    nextState.moderationFlagMode = flagMode;
  }

  if (params.get("maps") !== null) {
    nextState.hasMapsUrls = normalizeTriState(params.get("maps"));
  }

  if (params.get("reviewNote") !== null) {
    nextState.hasReviewNote = normalizeTriState(params.get("reviewNote"));
  }

  if (params.get("rejectReason") !== null) {
    nextState.hasRejectedReason = normalizeTriState(params.get("rejectReason"));
  }

  const minConfidence = params.get("minConfidence");
  if (minConfidence !== null) {
    nextState.minConfidenceScore = minConfidence;
  }

  const maxConfidence = params.get("maxConfidence");
  if (maxConfidence !== null) {
    nextState.maxConfidenceScore = maxConfidence;
  }

  const minSupport = params.get("minSupport");
  if (minSupport !== null) {
    nextState.minSupportCount = minSupport;
  }

  const maxSupport = params.get("maxSupport");
  if (maxSupport !== null) {
    nextState.maxSupportCount = maxSupport;
  }

  const minLikes = params.get("minLikes");
  if (minLikes !== null) {
    nextState.minTopLikeCount = minLikes;
  }

  const maxLikes = params.get("maxLikes");
  if (maxLikes !== null) {
    nextState.maxTopLikeCount = maxLikes;
  }

  if (sortRules.length > 0) {
    nextState.sortRules = sortRules;
  }

  if (pageSize) {
    nextState.pageSize = pageSize;
  }

  return nextState;
}

function writeQueryStateToUrl(state: AdminDraftQueryState): void {
  if (typeof window === "undefined") {
    return;
  }

  const params = new URLSearchParams();

  if (state.searchInput.trim()) {
    params.set("q", state.searchInput.trim());
  }

  if (state.logicMode === "any") {
    params.set("logic", "any");
  }

  if (state.statuses.length > 0 && state.statuses.length < allStatuses.length) {
    params.set("status", state.statuses.join(","));
  }

  if (state.countries.length > 0) {
    params.set("country", state.countries.join(","));
  }

  if (
    state.extractionMethods.length > 0 &&
    state.extractionMethods.length < allExtractionMethods.length
  ) {
    params.set("method", state.extractionMethods.join(","));
  }

  if (state.moderationFlags.length > 0) {
    params.set("flag", state.moderationFlags.join(","));
    params.set("flagMode", state.moderationFlagMode);
  }

  if (state.hasMapsUrls !== "all") {
    params.set("maps", state.hasMapsUrls);
  }

  if (state.hasReviewNote !== "all") {
    params.set("reviewNote", state.hasReviewNote);
  }

  if (state.hasRejectedReason !== "all") {
    params.set("rejectReason", state.hasRejectedReason);
  }

  if (state.minConfidenceScore.trim()) {
    params.set("minConfidence", state.minConfidenceScore.trim());
  }

  if (state.maxConfidenceScore.trim()) {
    params.set("maxConfidence", state.maxConfidenceScore.trim());
  }

  if (state.minSupportCount.trim()) {
    params.set("minSupport", state.minSupportCount.trim());
  }

  if (state.maxSupportCount.trim()) {
    params.set("maxSupport", state.maxSupportCount.trim());
  }

  if (state.minTopLikeCount.trim()) {
    params.set("minLikes", state.minTopLikeCount.trim());
  }

  if (state.maxTopLikeCount.trim()) {
    params.set("maxLikes", state.maxTopLikeCount.trim());
  }

  const normalizedSortRules = normalizeSortRules(state.sortRules);
  if (normalizedSortRules.length > 0) {
    params.set(
      "sort",
      normalizedSortRules.map((rule) => `${rule.field}:${rule.direction}`).join(","),
    );
  }

  if (state.pageSize !== 50) {
    params.set("ps", String(state.pageSize));
  }

  const currentSearch = window.location.search.startsWith("?")
    ? window.location.search.slice(1)
    : window.location.search;
  const nextSearch = params.toString();
  if (currentSearch === nextSearch) {
    return;
  }

  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
  window.history.replaceState(null, "", nextUrl);
}

function readQueryStateFromStorage(): Partial<AdminDraftQueryState> {
  if (typeof window === "undefined") {
    return {};
  }

  const raw = window.localStorage.getItem(queryStorageKey);
  if (!raw) {
    return {};
  }

  const parsedResult = Result.try(() => JSON.parse(raw));
  if (
    Result.isError(parsedResult) ||
    typeof parsedResult.value !== "object" ||
    parsedResult.value === null
  ) {
    return {};
  }

  return parsedResult.value as Partial<AdminDraftQueryState>;
}

function writeQueryStateToStorage(state: AdminDraftQueryState): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(queryStorageKey, JSON.stringify(state));
}

function buildSummaryText(state: AdminDraftQueryState): string {
  const activeFilters: string[] = [];

  if (state.statuses.length < allStatuses.length) {
    activeFilters.push(`statuses:${state.statuses.length}`);
  }
  if (state.countries.length > 0) {
    activeFilters.push(`countries:${state.countries.length}`);
  }
  if (state.extractionMethods.length < allExtractionMethods.length) {
    activeFilters.push(`methods:${state.extractionMethods.length}`);
  }
  if (state.moderationFlags.length > 0) {
    activeFilters.push(`flags:${state.moderationFlags.length}(${state.moderationFlagMode})`);
  }
  if (state.hasMapsUrls !== "all") {
    activeFilters.push(`maps:${state.hasMapsUrls}`);
  }
  if (state.hasReviewNote !== "all") {
    activeFilters.push(`reviewNote:${state.hasReviewNote}`);
  }
  if (state.hasRejectedReason !== "all") {
    activeFilters.push(`rejectReason:${state.hasRejectedReason}`);
  }
  if (
    state.minConfidenceScore.trim() ||
    state.maxConfidenceScore.trim() ||
    state.minSupportCount.trim() ||
    state.maxSupportCount.trim() ||
    state.minTopLikeCount.trim() ||
    state.maxTopLikeCount.trim()
  ) {
    activeFilters.push("ranges");
  }

  const sortText = normalizeSortRules(state.sortRules)
    .map((rule) => `${sortFieldLabels[rule.field]} ${rule.direction === "asc" ? "asc" : "desc"}`)
    .join(", ");

  const filterText = activeFilters.length > 0 ? activeFilters.join(" | ") : "no filters";
  return `${filterText} | sort: ${sortText}`;
}

function useDebouncedValue(value: string, delayMs: number): string {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debouncedValue;
}

function createPresetState(presetId: PresetId): AdminDraftQueryState {
  if (presetId === "reviewQueue") {
    return {
      ...defaultQueryState,
      statuses: ["new", "reviewed"],
      sortRules: [
        { field: "supportCount", direction: "desc" },
        { field: "topLikeCount", direction: "desc" },
      ],
    };
  }

  if (presetId === "highSignal") {
    return {
      ...defaultQueryState,
      minSupportCount: "3",
      minTopLikeCount: "10",
      sortRules: [
        { field: "topLikeCount", direction: "desc" },
        { field: "supportCount", direction: "desc" },
      ],
    };
  }

  if (presetId === "rejectedCleanup") {
    return {
      ...defaultQueryState,
      statuses: ["rejected"],
      hasRejectedReason: "no",
      sortRules: [{ field: "updatedAt", direction: "desc" }],
    };
  }

  return { ...defaultQueryState };
}

export const Route = createFileRoute("/admin/comment-drafts")({
  loader: async () => {
    const dataResult = await Result.tryPromise(() =>
      getCommentSuggestionAdminData({
        data: {
          status: "all",
          limit: 50,
          sort: defaultSortRules,
        },
      }),
    );

    if (Result.isError(dataResult)) {
      return {
        authorized: false,
        error:
          dataResult.error instanceof Error ? dataResult.error.message : String(dataResult.error),
      } as const;
    }

    return {
      authorized: true,
      payload: dataResult.value,
    } as const;
  },
  component: AdminCommentDraftsPage,
});

function AdminCommentDraftsPage() {
  const loaderData = Route.useLoaderData();
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [queryState, setQueryState] = useState<AdminDraftQueryState>(defaultQueryState);
  const [isQueryStateHydrated, setIsQueryStateHydrated] = useState(false);
  const [drafts, setDrafts] = useState<CommentSuggestionDraft[]>(
    loaderData.authorized ? loaderData.payload.drafts : [],
  );
  const [nextCursor, setNextCursor] = useState<string | null>(
    loaderData.authorized ? loaderData.payload.nextCursor : null,
  );
  const [totalCount, setTotalCount] = useState<number>(
    loaderData.authorized ? (loaderData.payload.totalCount ?? loaderData.payload.drafts.length) : 0,
  );
  const [counts, setCounts] = useState(
    loaderData.authorized
      ? loaderData.payload.counts
      : {
          new: 0,
          reviewed: 0,
          approved: 0,
          rejected: 0,
        },
  );
  const [loadError, setLoadError] = useState("");
  const [isLoadingInitial, setIsLoadingInitial] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [pendingDraftId, setPendingDraftId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, DraftEditState>>({});
  const [refreshTick, setRefreshTick] = useState(0);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedPreset, setSelectedPreset] = useState<PresetId>("default");

  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);
  const activeRequestKeyRef = useRef("");
  const fetchGenerationRef = useRef(0);
  const consumedLoaderSeedRef = useRef(false);

  const debouncedSearchQuery = useDebouncedValue(queryState.searchInput, 250);

  const baseRequestInput = useMemo(
    () => buildDraftListRequestInput(queryState, debouncedSearchQuery),
    [queryState, debouncedSearchQuery],
  );
  const baseRequestKey = useMemo(() => buildRequestKey(baseRequestInput), [baseRequestInput]);

  const loaderSeedRequestKey = useMemo(
    () => buildRequestKey(buildDraftListRequestInput(defaultQueryState, "")),
    [],
  );

  useEffect(() => {
    if (!loaderData.authorized) {
      return;
    }

    setEdits((current) => {
      const nextEdits: Record<string, DraftEditState> = {};
      for (const draft of drafts) {
        const existing = current[draft.id];
        nextEdits[draft.id] = existing ?? {
          editedName: draft.displayName,
          editedCountry: draft.country,
          reviewNote: draft.reviewNote,
          rejectedReason: draft.rejectedReason ?? "",
        };
      }
      return nextEdits;
    });
  }, [loaderData.authorized, drafts]);

  useEffect(() => {
    if (!loaderData.authorized) {
      return;
    }

    const storedState = readQueryStateFromStorage();
    const urlState = readQueryStateFromUrl();
    const merged = normalizeQueryState({
      ...storedState,
      ...urlState,
    });

    setQueryState(merged);
    setIsQueryStateHydrated(true);
  }, [loaderData.authorized]);

  useEffect(() => {
    if (!loaderData.authorized || !isQueryStateHydrated) {
      return;
    }

    writeQueryStateToStorage(queryState);
    writeQueryStateToUrl(queryState);
  }, [loaderData.authorized, isQueryStateHydrated, queryState]);

  useEffect(() => {
    if (!loaderData.authorized || !isQueryStateHydrated) {
      return;
    }

    if (
      !consumedLoaderSeedRef.current &&
      baseRequestKey === loaderSeedRequestKey &&
      refreshTick === 0
    ) {
      consumedLoaderSeedRef.current = true;
      activeRequestKeyRef.current = baseRequestKey;
      return;
    }

    const currentRequestKey = baseRequestKey;
    activeRequestKeyRef.current = currentRequestKey;
    const fetchGeneration = fetchGenerationRef.current + 1;
    fetchGenerationRef.current = fetchGeneration;

    setIsLoadingInitial(true);
    setLoadError("");

    void (async () => {
      const listResult = await Result.tryPromise(() =>
        getCommentSuggestionAdminData({ data: baseRequestInput }),
      );
      if (
        fetchGenerationRef.current !== fetchGeneration ||
        activeRequestKeyRef.current !== currentRequestKey
      ) {
        return;
      }

      if (Result.isError(listResult)) {
        setLoadError(
          listResult.error instanceof Error ? listResult.error.message : String(listResult.error),
        );
        setIsLoadingInitial(false);
        return;
      }

      setDrafts(listResult.value.drafts);
      setNextCursor(listResult.value.nextCursor);
      setCounts(listResult.value.counts);
      setTotalCount(listResult.value.totalCount ?? listResult.value.drafts.length);
      setExpandedRows(new Set());
      setIsLoadingInitial(false);
    })();
  }, [
    baseRequestInput,
    baseRequestKey,
    isQueryStateHydrated,
    loaderData.authorized,
    loaderSeedRequestKey,
    refreshTick,
  ]);

  const handleLoadMore = useCallback(async () => {
    if (!loaderData.authorized || !nextCursor || isLoadingMore || isLoadingInitial) {
      return;
    }

    const requestKeyAtStart = activeRequestKeyRef.current;
    setIsLoadingMore(true);

    const loadMoreInput = buildDraftListRequestInput(queryState, debouncedSearchQuery, nextCursor);
    const listResult = await Result.tryPromise(() =>
      getCommentSuggestionAdminData({ data: loadMoreInput }),
    );

    if (requestKeyAtStart !== activeRequestKeyRef.current) {
      setIsLoadingMore(false);
      return;
    }

    if (Result.isError(listResult)) {
      setLoadError(
        listResult.error instanceof Error ? listResult.error.message : String(listResult.error),
      );
      setIsLoadingMore(false);
      return;
    }

    setDrafts((current) => {
      const seen = new Set(current.map((draft) => draft.id));
      const next = [...current];
      for (const draft of listResult.value.drafts) {
        if (seen.has(draft.id)) {
          continue;
        }
        seen.add(draft.id);
        next.push(draft);
      }
      return next;
    });
    setNextCursor(listResult.value.nextCursor);
    setCounts(listResult.value.counts);
    setIsLoadingMore(false);
  }, [
    debouncedSearchQuery,
    isLoadingInitial,
    isLoadingMore,
    loaderData.authorized,
    nextCursor,
    queryState,
  ]);

  useEffect(() => {
    if (!loaderData.authorized || !nextCursor || isLoadingMore || isLoadingInitial) {
      return;
    }

    const node = loadMoreTriggerRef.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const isIntersecting = entries.some((entry) => entry.isIntersecting);
        if (isIntersecting) {
          void handleLoadMore();
        }
      },
      {
        root: null,
        rootMargin: "360px",
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [handleLoadMore, isLoadingInitial, isLoadingMore, loaderData.authorized, nextCursor]);

  const compactSummary = useMemo(() => buildSummaryText(queryState), [queryState]);

  if (!loaderData.authorized) {
    return (
      <div className="bg-background min-h-screen px-4 py-12">
        <div className="border-border bg-surface-card mx-auto max-w-2xl rounded-xl border p-6">
          <h1 className="font-display text-2xl font-black">Admin Access Required</h1>
          <p className="text-foreground-muted mt-3 text-sm">
            Cloudflare Access admin identity was not accepted. Ensure you are authenticated through
            Cloudflare Access and allowed by your Access policy.
          </p>
          <p className="text-destructive-text mt-3 text-xs">{loaderData.error}</p>
          <div className="mt-4 flex items-center gap-3">
            <Link to="/admin/login" className="text-primary text-sm hover:underline">
              Sign in via Cloudflare Access
            </Link>
            <Link to="/" className="text-primary text-sm hover:underline">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  async function runDraftAction(
    draftId: string,
    action: "review" | "approve" | "reject",
  ): Promise<void> {
    const edit = edits[draftId];
    if (!edit) {
      return;
    }

    setPendingDraftId(draftId);
    setActionMessage("");

    const actionResult = await Result.tryPromise(() =>
      reviewCommentSuggestionDraft({
        data: {
          draftId,
          action,
          reviewNote: edit.reviewNote,
          editedName: edit.editedName,
          editedCountry: edit.editedCountry,
          rejectedReason: edit.rejectedReason,
        },
      }),
    );

    if (Result.isError(actionResult)) {
      setActionMessage(
        `Failed to ${action} draft: ${actionResult.error instanceof Error ? actionResult.error.message : String(actionResult.error)}`,
      );
      setPendingDraftId(null);
      return;
    }

    setActionMessage(`Draft ${action} action completed.`);
    setPendingDraftId(null);
    setRefreshTick((value) => value + 1);
  }

  function toggleStatus(status: DraftStatusFilter, checked: boolean): void {
    setQueryState((current) => {
      if (checked) {
        return normalizeQueryState({
          ...current,
          statuses: [...current.statuses, status],
        });
      }

      return normalizeQueryState({
        ...current,
        statuses: current.statuses.filter((item) => item !== status),
      });
    });
  }

  function toggleExtractionMethod(method: ExtractionMethod, checked: boolean): void {
    setQueryState((current) => {
      if (checked) {
        return normalizeQueryState({
          ...current,
          extractionMethods: [...current.extractionMethods, method],
        });
      }

      return normalizeQueryState({
        ...current,
        extractionMethods: current.extractionMethods.filter((item) => item !== method),
      });
    });
  }

  function toggleModerationFlag(flag: ModerationFlag, checked: boolean): void {
    setQueryState((current) => {
      if (checked) {
        return normalizeQueryState({
          ...current,
          moderationFlags: [...current.moderationFlags, flag],
        });
      }

      return normalizeQueryState({
        ...current,
        moderationFlags: current.moderationFlags.filter((item) => item !== flag),
      });
    });
  }

  function toggleExpanded(draftId: string): void {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(draftId)) {
        next.delete(draftId);
      } else {
        next.add(draftId);
      }
      return next;
    });
  }

  const hasActiveFilters =
    queryState.searchInput.trim().length > 0 ||
    queryState.statuses.length < allStatuses.length ||
    queryState.countries.length > 0 ||
    queryState.extractionMethods.length < allExtractionMethods.length ||
    queryState.moderationFlags.length > 0 ||
    queryState.hasMapsUrls !== "all" ||
    queryState.hasReviewNote !== "all" ||
    queryState.hasRejectedReason !== "all" ||
    queryState.minConfidenceScore.trim().length > 0 ||
    queryState.maxConfidenceScore.trim().length > 0 ||
    queryState.minSupportCount.trim().length > 0 ||
    queryState.maxSupportCount.trim().length > 0 ||
    queryState.minTopLikeCount.trim().length > 0 ||
    queryState.maxTopLikeCount.trim().length > 0 ||
    queryState.pageSize !== 50 ||
    JSON.stringify(normalizeSortRules(queryState.sortRules)) !== JSON.stringify(defaultSortRules);

  return (
    <div className="bg-background min-h-screen">
      <header className="border-border bg-surface border-b px-4 py-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-black">Comment Draft Queue</h1>
              <p className="text-foreground-faint mt-1 text-xs">
                Signed in as {loaderData.payload.adminEmail}. Cloudflare Access protected admin
                route.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/" className="text-foreground-faint hover:text-primary text-sm">
                Main app
              </Link>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <StatusPill label="New" count={counts.new} />
            <StatusPill label="Reviewed" count={counts.reviewed} />
            <StatusPill label="Approved" count={counts.approved} />
            <StatusPill label="Rejected" count={counts.rejected} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <section className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
          <Input
            value={queryState.searchInput}
            onChange={(event) =>
              setQueryState((current) =>
                normalizeQueryState({
                  ...current,
                  searchInput: event.target.value,
                }),
              )
            }
            placeholder="Search name, status, reviewer, reason, notes, id"
            className="border-border bg-surface-raised"
          />

          <Button
            type="button"
            variant="outline"
            onClick={() => setIsFiltersOpen(true)}
            className="border-border bg-surface-raised w-full justify-start px-3 text-left md:w-auto"
          >
            {compactSummary}
          </Button>

          <ResponsiveDialog open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
            <ResponsiveDialogContent showCloseButton={false} className="pt-0 sm:max-w-4xl sm:gap-0">
              <ResponsiveDialogHeader className="border-border -mx-4 border-b px-4 pb-3 sm:pt-3 sm:pb-2">
                <div className="flex items-center justify-between">
                  <ResponsiveDialogTitle className="font-display text-lg font-bold">
                    Filter and Sort
                  </ResponsiveDialogTitle>
                  <ResponsiveDialogClose aria-label="Close filter and sort dialog">
                    <span
                      aria-hidden="true"
                      className="iconify ph--x-bold text-foreground-muted size-4 shrink-0"
                    />
                  </ResponsiveDialogClose>
                </div>
              </ResponsiveDialogHeader>

              <div className="grid grid-cols-1 gap-4 px-4 pt-4 pb-4 sm:grid-cols-2 sm:px-0">
                <label className="text-foreground-faint space-y-1 text-xs">
                  <span>Preset</span>
                  <Select
                    value={selectedPreset}
                    onValueChange={(value) => {
                      const nextPreset: PresetId =
                        value === "reviewQueue" ||
                        value === "highSignal" ||
                        value === "rejectedCleanup"
                          ? value
                          : "default";
                      setSelectedPreset(nextPreset);
                      setQueryState(createPresetState(nextPreset));
                    }}
                  >
                    <SelectTrigger className="border-border bg-surface-raised w-full">
                      <SelectValue>
                        {(value) => presetLabels[(value as PresetId) ?? "default"]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="reviewQueue">Review queue</SelectItem>
                      <SelectItem value="highSignal">High signal</SelectItem>
                      <SelectItem value="rejectedCleanup">Rejected cleanup</SelectItem>
                    </SelectContent>
                  </Select>
                </label>

                <label className="text-foreground-faint space-y-1 text-xs">
                  <span>Global filter mode</span>
                  <Select
                    value={queryState.logicMode}
                    onValueChange={(value) =>
                      setQueryState((current) =>
                        normalizeQueryState({
                          ...current,
                          logicMode: value === "any" ? "any" : "all",
                        }),
                      )
                    }
                  >
                    <SelectTrigger className="border-border bg-surface-raised w-full">
                      <SelectValue>
                        {(value) =>
                          value === "any" ? "Any filter can match" : "All filters must match"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All filters must match</SelectItem>
                      <SelectItem value="any">Any filter can match</SelectItem>
                    </SelectContent>
                  </Select>
                </label>

                <div className="space-y-1">
                  <p className="text-foreground-faint text-xs">Statuses</p>
                  <div className="grid grid-cols-2 gap-2">
                    {allStatuses.map((status) => (
                      <Label
                        key={status}
                        className="border-border bg-surface-raised min-h-10 rounded-lg border px-3 text-sm font-normal"
                      >
                        <Checkbox
                          variant="tick"
                          checked={queryState.statuses.includes(status)}
                          onCheckedChange={(checked) => toggleStatus(status, checked)}
                        />
                        {statusLabels[status]}
                      </Label>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-foreground-faint text-xs">Extraction methods</p>
                  <div className="grid grid-cols-1 gap-2">
                    {allExtractionMethods.map((method) => (
                      <Label
                        key={method}
                        className="border-border bg-surface-raised min-h-10 rounded-lg border px-3 text-sm font-normal"
                      >
                        <Checkbox
                          variant="tick"
                          checked={queryState.extractionMethods.includes(method)}
                          onCheckedChange={(checked) => toggleExtractionMethod(method, checked)}
                        />
                        {extractionMethodLabels[method]}
                      </Label>
                    ))}
                  </div>
                </div>

                <label className="text-foreground-faint space-y-1 text-xs">
                  <span>Countries (comma separated)</span>
                  <Input
                    value={queryState.countries.join(", ")}
                    onChange={(event) =>
                      setQueryState((current) =>
                        normalizeQueryState({
                          ...current,
                          countries: parseCsv(event.target.value),
                        }),
                      )
                    }
                    placeholder="SG, MY"
                    className="border-border bg-surface-raised"
                  />
                </label>

                <div className="space-y-2">
                  <p className="text-foreground-faint text-xs">Moderation flags</p>

                  <Select
                    value={queryState.moderationFlagMode}
                    onValueChange={(value) =>
                      setQueryState((current) =>
                        normalizeQueryState({
                          ...current,
                          moderationFlagMode:
                            value === "all" || value === "none"
                              ? (value as ModerationFlagMode)
                              : "any",
                        }),
                      )
                    }
                  >
                    <SelectTrigger className="border-border bg-surface-raised w-full">
                      <SelectValue>
                        {(value) => {
                          if (value === "all") return "All selected flags";
                          if (value === "none") return "None of selected flags";
                          return "Any selected flag";
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any selected flag</SelectItem>
                      <SelectItem value="all">All selected flags</SelectItem>
                      <SelectItem value="none">None of selected flags</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="grid grid-cols-1 gap-2">
                    {allModerationFlags.map((flag) => (
                      <Label
                        key={flag}
                        className="border-border bg-surface-raised min-h-10 rounded-lg border px-3 text-sm font-normal"
                      >
                        <Checkbox
                          variant="tick"
                          checked={queryState.moderationFlags.includes(flag)}
                          onCheckedChange={(checked) => toggleModerationFlag(flag, checked)}
                        />
                        {moderationFlagLabels[flag]}
                      </Label>
                    ))}
                  </div>
                </div>

                <label className="text-foreground-faint space-y-1 text-xs">
                  <span>Has maps URLs</span>
                  <Select
                    value={queryState.hasMapsUrls}
                    onValueChange={(value) =>
                      setQueryState((current) =>
                        normalizeQueryState({
                          ...current,
                          hasMapsUrls: normalizeTriState(value),
                        }),
                      )
                    }
                  >
                    <SelectTrigger className="border-border bg-surface-raised w-full">
                      <SelectValue>
                        {(value) => (value === "yes" ? "Yes" : value === "no" ? "No" : "All")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </label>

                <label className="text-foreground-faint space-y-1 text-xs">
                  <span>Has review note</span>
                  <Select
                    value={queryState.hasReviewNote}
                    onValueChange={(value) =>
                      setQueryState((current) =>
                        normalizeQueryState({
                          ...current,
                          hasReviewNote: normalizeTriState(value),
                        }),
                      )
                    }
                  >
                    <SelectTrigger className="border-border bg-surface-raised w-full">
                      <SelectValue>
                        {(value) => (value === "yes" ? "Yes" : value === "no" ? "No" : "All")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </label>

                <label className="text-foreground-faint space-y-1 text-xs">
                  <span>Has reject reason</span>
                  <Select
                    value={queryState.hasRejectedReason}
                    onValueChange={(value) =>
                      setQueryState((current) =>
                        normalizeQueryState({
                          ...current,
                          hasRejectedReason: normalizeTriState(value),
                        }),
                      )
                    }
                  >
                    <SelectTrigger className="border-border bg-surface-raised w-full">
                      <SelectValue>
                        {(value) => (value === "yes" ? "Yes" : value === "no" ? "No" : "All")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </label>

                <div className="space-y-1">
                  <p className="text-foreground-faint text-xs">Confidence range</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={queryState.minConfidenceScore}
                      onChange={(event) =>
                        setQueryState((current) => ({
                          ...current,
                          minConfidenceScore: event.target.value,
                        }))
                      }
                      placeholder="Min"
                      className="border-border bg-surface-raised"
                    />
                    <Input
                      value={queryState.maxConfidenceScore}
                      onChange={(event) =>
                        setQueryState((current) => ({
                          ...current,
                          maxConfidenceScore: event.target.value,
                        }))
                      }
                      placeholder="Max"
                      className="border-border bg-surface-raised"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-foreground-faint text-xs">Support range</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={queryState.minSupportCount}
                      onChange={(event) =>
                        setQueryState((current) => ({
                          ...current,
                          minSupportCount: event.target.value,
                        }))
                      }
                      placeholder="Min"
                      className="border-border bg-surface-raised"
                    />
                    <Input
                      value={queryState.maxSupportCount}
                      onChange={(event) =>
                        setQueryState((current) => ({
                          ...current,
                          maxSupportCount: event.target.value,
                        }))
                      }
                      placeholder="Max"
                      className="border-border bg-surface-raised"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-foreground-faint text-xs">Likes range</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={queryState.minTopLikeCount}
                      onChange={(event) =>
                        setQueryState((current) => ({
                          ...current,
                          minTopLikeCount: event.target.value,
                        }))
                      }
                      placeholder="Min"
                      className="border-border bg-surface-raised"
                    />
                    <Input
                      value={queryState.maxTopLikeCount}
                      onChange={(event) =>
                        setQueryState((current) => ({
                          ...current,
                          maxTopLikeCount: event.target.value,
                        }))
                      }
                      placeholder="Max"
                      className="border-border bg-surface-raised"
                    />
                  </div>
                </div>

                <label className="text-foreground-faint space-y-1 text-xs">
                  <span>Page size</span>
                  <Select
                    value={String(queryState.pageSize)}
                    onValueChange={(value) =>
                      setQueryState((current) => ({
                        ...current,
                        pageSize: value === "100" ? 100 : 50,
                      }))
                    }
                  >
                    <SelectTrigger className="border-border bg-surface-raised w-full">
                      <SelectValue>{(value) => value}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
              </div>

              <div className="border-border border-t px-4 py-4 sm:px-0">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-foreground-faint text-xs">Sort rules (max 3)</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={queryState.sortRules.length >= 3}
                    onClick={() =>
                      setQueryState((current) =>
                        normalizeQueryState({
                          ...current,
                          sortRules: [
                            ...current.sortRules,
                            { field: "updatedAt", direction: "desc" },
                          ],
                        }),
                      )
                    }
                  >
                    Add sort
                  </Button>
                </div>

                <div className="space-y-2">
                  {queryState.sortRules.map((rule, index) => (
                    <div
                      key={`${rule.field}-${index}`}
                      className="grid grid-cols-[minmax(0,1fr)_120px_auto] gap-2"
                    >
                      <Select
                        value={rule.field}
                        onValueChange={(value) =>
                          setQueryState((current) => {
                            const nextSortRules = [...current.sortRules];
                            const currentSortRule = nextSortRules[index];
                            if (!currentSortRule) {
                              return current;
                            }
                            nextSortRules[index] = {
                              ...currentSortRule,
                              field: value as AdminDraftSortField,
                            };
                            return normalizeQueryState({
                              ...current,
                              sortRules: nextSortRules,
                            });
                          })
                        }
                      >
                        <SelectTrigger className="border-border bg-surface-raised w-full">
                          <SelectValue>
                            {(value) =>
                              sortFieldLabels[(value as AdminDraftSortField) ?? "topLikeCount"]
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(sortFieldLabels) as AdminDraftSortField[]).map((field) => (
                            <SelectItem key={field} value={field}>
                              {sortFieldLabels[field]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={rule.direction}
                        onValueChange={(value) =>
                          setQueryState((current) => {
                            const nextSortRules = [...current.sortRules];
                            const currentSortRule = nextSortRules[index];
                            if (!currentSortRule) {
                              return current;
                            }
                            nextSortRules[index] = {
                              ...currentSortRule,
                              direction: value === "asc" ? "asc" : "desc",
                            };
                            return normalizeQueryState({
                              ...current,
                              sortRules: nextSortRules,
                            });
                          })
                        }
                      >
                        <SelectTrigger className="border-border bg-surface-raised w-full">
                          <SelectValue>{(value) => (value === "asc" ? "Asc" : "Desc")}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="desc">Desc</SelectItem>
                          <SelectItem value="asc">Asc</SelectItem>
                        </SelectContent>
                      </Select>

                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={index === 0}
                          onClick={() =>
                            setQueryState((current) => {
                              const nextSortRules = [...current.sortRules];
                              const currentSortRule = nextSortRules[index];
                              const previousSortRule = nextSortRules[index - 1];
                              if (!currentSortRule || !previousSortRule) {
                                return current;
                              }
                              nextSortRules[index - 1] = currentSortRule;
                              nextSortRules[index] = previousSortRule;
                              return normalizeQueryState({
                                ...current,
                                sortRules: nextSortRules,
                              });
                            })
                          }
                        >
                          Up
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={index === queryState.sortRules.length - 1}
                          onClick={() =>
                            setQueryState((current) => {
                              const nextSortRules = [...current.sortRules];
                              const currentSortRule = nextSortRules[index];
                              const nextSortRule = nextSortRules[index + 1];
                              if (!currentSortRule || !nextSortRule) {
                                return current;
                              }
                              nextSortRules[index + 1] = currentSortRule;
                              nextSortRules[index] = nextSortRule;
                              return normalizeQueryState({
                                ...current,
                                sortRules: nextSortRules,
                              });
                            })
                          }
                        >
                          Down
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={queryState.sortRules.length <= 1}
                          onClick={() =>
                            setQueryState((current) =>
                              normalizeQueryState({
                                ...current,
                                sortRules: current.sortRules.filter(
                                  (_, ruleIndex) => ruleIndex !== index,
                                ),
                              }),
                            )
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSelectedPreset("default");
                      setQueryState(defaultQueryState);
                    }}
                  >
                    Reset all
                  </Button>

                  <Button type="button" variant="outline" onClick={() => setIsFiltersOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>
            </ResponsiveDialogContent>
          </ResponsiveDialog>
        </section>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <p className="text-foreground-faint">
            Showing {drafts.length} of {totalCount} drafts
            {hasActiveFilters ? " with active filters" : ""}.
          </p>
          {isLoadingInitial ? <p className="text-foreground-faint">Refreshing...</p> : null}
        </div>

        {actionMessage ? <p className="text-primary mb-3 text-sm">{actionMessage}</p> : null}
        {loadError ? <p className="text-destructive-text mb-3 text-sm">{loadError}</p> : null}

        <section className="border-border bg-surface-card overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[1024px] text-sm">
            <thead className="bg-surface-raised text-left text-xs tracking-wide uppercase">
              <tr>
                <th className="px-3 py-2 font-semibold">Draft</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Country</th>
                <th className="px-3 py-2 font-semibold">Method</th>
                <th className="px-3 py-2 font-semibold">Confidence</th>
                <th className="px-3 py-2 font-semibold">Support</th>
                <th className="px-3 py-2 font-semibold">Likes</th>
                <th className="px-3 py-2 font-semibold">Flags</th>
                <th className="px-3 py-2 font-semibold">Updated</th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((draft) => {
                const edit = edits[draft.id] ?? {
                  editedName: draft.displayName,
                  editedCountry: draft.country,
                  reviewNote: draft.reviewNote,
                  rejectedReason: draft.rejectedReason ?? "",
                };
                const isPending = pendingDraftId === draft.id;
                const isExpanded = expandedRows.has(draft.id);

                return (
                  <Fragment key={draft.id}>
                    <tr className="border-border border-t align-top">
                      <td className="px-3 py-2">
                        <p className="font-medium">{draft.displayName}</p>
                        <p className="text-foreground-faint mt-1 text-xs">{draft.normalizedName}</p>
                      </td>
                      <td className="px-3 py-2">
                        <span className="border-border bg-surface-raised rounded-md border px-2 py-1 text-xs">
                          {statusLabels[draft.status]}
                        </span>
                      </td>
                      <td className="px-3 py-2">{draft.country}</td>
                      <td className="px-3 py-2">
                        {extractionMethodLabels[draft.extractionMethod]}
                      </td>
                      <td className="px-3 py-2">{Math.round(draft.confidenceScore)}</td>
                      <td className="px-3 py-2">{draft.supportCount}</td>
                      <td className="px-3 py-2">{draft.topLikeCount}</td>
                      <td className="px-3 py-2 text-xs">
                        {draft.moderationFlags.length > 0 ? draft.moderationFlags.join(", ") : "-"}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {draft.updatedAt.replace("T", " ").slice(0, 16)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => toggleExpanded(draft.id)}
                        >
                          {isExpanded ? "Hide" : "Details"}
                        </Button>
                      </td>
                    </tr>

                    {isExpanded ? (
                      <tr className="border-border bg-surface-raised border-t">
                        <td colSpan={10} className="px-3 py-3">
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            <Input
                              value={edit.editedName}
                              onChange={(event) =>
                                setEdits((current) => ({
                                  ...current,
                                  [draft.id]: {
                                    ...edit,
                                    editedName: event.target.value,
                                  },
                                }))
                              }
                              placeholder="Approved stall name"
                              className="border-border bg-surface-card"
                            />

                            <Input
                              value={edit.editedCountry}
                              onChange={(event) =>
                                setEdits((current) => ({
                                  ...current,
                                  [draft.id]: {
                                    ...edit,
                                    editedCountry: event.target.value.toUpperCase(),
                                  },
                                }))
                              }
                              placeholder="Country code"
                              className="border-border bg-surface-card"
                            />

                            <Input
                              value={edit.reviewNote}
                              onChange={(event) =>
                                setEdits((current) => ({
                                  ...current,
                                  [draft.id]: {
                                    ...edit,
                                    reviewNote: event.target.value,
                                  },
                                }))
                              }
                              placeholder="Review note"
                              className="border-border bg-surface-card md:col-span-2"
                            />

                            <Input
                              value={edit.rejectedReason}
                              onChange={(event) =>
                                setEdits((current) => ({
                                  ...current,
                                  [draft.id]: {
                                    ...edit,
                                    rejectedReason: event.target.value,
                                  },
                                }))
                              }
                              placeholder="Reject reason"
                              className="border-border bg-surface-card md:col-span-2"
                            />
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                            <Metric label="Support" value={`${draft.supportCount}`} />
                            <Metric label="Top likes" value={`${draft.topLikeCount}`} />
                            <Metric label="Comments" value={`${draft.evidenceCommentIds.length}`} />
                            <Metric label="Videos" value={`${draft.evidenceVideoIds.length}`} />
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              disabled={isPending}
                              onClick={() => runDraftAction(draft.id, "review")}
                              className="border-border bg-surface-card"
                            >
                              Mark reviewed
                            </Button>

                            <Button
                              type="button"
                              disabled={isPending}
                              onClick={() => runDraftAction(draft.id, "approve")}
                              className="bg-primary text-primary-foreground"
                            >
                              Approve
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              disabled={isPending}
                              onClick={() => runDraftAction(draft.id, "reject")}
                              className="border-destructive text-destructive-text hover:bg-destructive-surface"
                            >
                              Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}

              {drafts.length === 0 && !isLoadingInitial ? (
                <tr>
                  <td colSpan={10} className="text-foreground-faint px-3 py-8 text-center text-sm">
                    No drafts matched the current search and filter options.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <div ref={loadMoreTriggerRef} className="h-2" />

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-foreground-faint text-xs">
            {nextCursor ? "More drafts available." : "End of draft queue."}
          </div>

          {nextCursor ? (
            <Button
              type="button"
              variant="outline"
              disabled={isLoadingMore || isLoadingInitial}
              onClick={() => void handleLoadMore()}
            >
              {isLoadingMore ? "Loading..." : "Load more"}
            </Button>
          ) : null}
        </div>
      </main>
    </div>
  );
}

function StatusPill({ label, count }: { label: string; count: number }) {
  return (
    <span className="border-border bg-surface-raised rounded-md border px-2 py-1">
      {label}: {count}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border bg-surface-card rounded-md border px-2 py-1">
      <p className="text-foreground-faint">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
