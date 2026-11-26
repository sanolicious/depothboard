export type Sex = "M" | "F";
export type Federation = "AIDA" | "CMAS" | "PORTAL";
export type Card = "W" | "Y" | "R";
export type AthleteStatus = "active" | "inactive" | "minor";
export type EventStatus = "live" | "upcoming" | "past";
export type ResultStatus = "provisional" | "official" | "unofficial";

/**
 * Licence funnel tiers:
 * free sample → short access → long/watermark → social → HQ/master → commercial quote.
 */
export type LicenseTier =
  | "sample"
  | "short"
  | "watermark"
  | "social"
  | "master"
  | "commercial";

export type ConsentPurpose =
  | "recording"
  | "publication"
  | "commercial"
  | "coach";

export type ConsentStatus = "granted" | "withdrawn" | "missing";
export type ConsentGrantedBy = "self" | "guardian";

export type ProvenanceSourceCode =
  | "AIDA_HTML"
  | "CMAS_API"
  | "CMAS_PDF"
  | "FR_GAP"
  | "ORGANIZER_UPLOAD"
  | "FEDERATION_FEED"
  | "MANUAL";

export type ContractStatus = "NONE" | "PENDING" | "LICENSED";

export interface ProvenanceSource {
  id: string;
  code: ProvenanceSourceCode;
  federation: Federation;
  label: string;
  contractStatus: ContractStatus;
  notes: string;
}

export interface LicenseTierInfo {
  id: LicenseTier;
  label: string;
  priceEur: number;
  description: string;
}

export interface ConsentRecord {
  id: string;
  athleteId: string;
  athleteSlug: string;
  purpose: ConsentPurpose;
  status: ConsentStatus;
  grantedBy: ConsentGrantedBy;
  method: "seed" | "panel" | "claim" | "import";
  at: string;
  withdrawnAt?: string;
  version: string;
  /** True when a guardian granted (or must grant) this consent for a minor. */
  guardianConsent?: boolean;
  /**
   * Optional link to a field / capture session (ecosystem hook).
   * Lets later field apps and drones attach recording consent to a session.
   */
  fieldSessionId?: string;
}

/** Per-dive / per-event recording rights grant (AIDA owned vs CMAS link-only). */
export interface RecordingRights {
  id: string;
  diveId: string;
  eventId: string;
  athleteSlug: string;
  federation: "AIDA" | "CMAS";
  rightsModel: "diveye_owned" | "cmas_link";
  provenanceSourceId: string;
  downloadable: boolean;
  embedOnly: boolean;
  saleEnabled: boolean;
  maxLicenseTier: LicenseTier;
  watermarkRequired: boolean;
  blockReason?: string;
  embedUrl?: string;
}

export type ClaimVerifyMethod =
  | "email_match"
  | "event_proof"
  | "coach_confirm"
  | "id_document";

export interface ClaimRequest {
  id: string;
  athleteName: string;
  athleteSlug?: string;
  email: string;
  userId?: string;
  federationId?: string;
  guardian: boolean;
  verifyMethod?: ClaimVerifyMethod;
  eventProofIds?: string[];
  status: "pending" | "needs_info" | "approved" | "rejected";
  createdAt: string;
  reviewedAt?: string;
  notes?: string;
}

export type UserRole =
  | "visitor"
  | "athlete"
  | "guardian"
  | "steward"
  | "operator"
  | "judge"
  | "coach"
  | "admin";

/** Seed demo account (credentials auth MVP). */
export interface DemoUser {
  id: string;
  email: string;
  /** Plaintext demo password only — never for production. */
  password: string;
  name: string;
  role: UserRole;
  /** Linked athlete after approved claim (null while pending / fan). */
  athleteSlug: string | null;
  notes?: string;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  athleteSlug: string | null;
}

export type OrderStatus =
  | "paid_simulated"
  /** Stripe Checkout completed (test or live). */
  | "paid"
  | "pending"
  | "cancelled"
  /** Legacy seed statuses (PWF-14 stubs). */
  | "paid_stub"
  | "pending_stub"
  | "cancelled_stub";

export type DeliveryKind = "download" | "stream" | "processing" | "quote";

export type DeliveryStatus = "ready" | "processing" | "quote_pending";

export interface OrderDelivery {
  kind: DeliveryKind;
  status: DeliveryStatus;
  /** Placeholder file download (sample / social). */
  downloadUrl?: string;
  /** Watermarked stream link (sample / watermark / short). */
  streamUrl?: string;
  /** Human-readable delivery note (HQ processing, commercial quote). */
  note?: string;
}

export interface OrderItem {
  sku: string;
  productId?: string;
  title: string;
  priceEur: number;
  licenseTier?: LicenseTier;
  diveId?: string;
  footageAssetId?: string;
  delivery?: OrderDelivery;
}

export interface Order {
  id: string;
  userId: string;
  email: string;
  status: OrderStatus;
  createdAt: string;
  totalEur: number;
  items: OrderItem[];
  payment?: {
    provider: "simulated" | "stripe_test";
    simulated: boolean;
    /** Stripe Checkout Session id when provider is stripe_test. */
    stripeSessionId?: string;
    stripePaymentIntentId?: string | null;
  };
  notes?: string;
}

/** @deprecated Prefer Order — kept as alias for older imports. */
export type OrderStub = Order;

/** Client cart line (localStorage + drawer). */
export interface CartLine {
  productId: string;
  sku: string;
  title: string;
  description: string;
  price: number;
  licenseTier?: LicenseTier;
  diveId?: string;
  scene: { h: number; x: string; d: number };
}

export interface Discipline {
  code: string;
  name: string;
  group: "depth" | "pool";
  unit: "m" | "s";
  factor: number;
}

export interface Athlete {
  id: string;
  slug: string;
  name: string;
  country: string;
  countryName: string;
  sex: Sex;
  status: AthleteStatus;
  minor: boolean;
  neutral: boolean;
  rankDelta: number;
  form: number[];
  bio: string;
  claimed: boolean;
  club: string | null;
  /** Guardian has verified consent for a minor athlete (recording/publication). */
  guardianConsentGranted?: boolean;
}

export interface Event {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  federation: "AIDA" | "CMAS";
  type: "depth" | "pool";
  status: EventStatus;
  startDate: string;
  endDate: string;
  venue: string;
  country: string;
  lat: number;
  lng: number;
  day?: number;
  ofDays?: number;
  disciplines: string[];
  liveUrl?: string;
  rightsModel: "diveye_owned" | "cmas_link";
}

export interface Performance {
  id: string;
  athleteId: string;
  athleteSlug: string;
  eventId: string;
  eventName: string;
  discipline: string;
  federation: "AIDA" | "CMAS";
  date: string;
  ap: number;
  rp: number;
  card: Card;
  points: number;
  wr?: boolean;
  nr?: boolean;
  status: ResultStatus;
  diveId: string;
  day: number;
  ot: string;
  /** Secondary ingest tag — FR gap-fill rows carry source "FR". */
  source?: "AIDA" | "CMAS" | "FR" | string;
  provenance?: string;
}

export interface DiveMarker {
  id: string;
  label: string;
  at: number;
  kind: string;
}

/** OT / Diveye production marker kinds on the dive timeline. */
export type FootageMarkerKind =
  | "start"
  | "turn"
  | "surface"
  | "protocol"
  | "penalty"
  | "blackout"
  | "card";

export type FootageQuality = "preview" | "hq";

export interface FootageMarker {
  id: string;
  kind: FootageMarkerKind;
  label: string;
  /** Absolute seconds from clip start. */
  atSec: number;
  /** Normalized 0–1 position on the timeline. */
  at: number;
}

/**
 * Diveye OT/HQ media asset. Linked to a performance via officialTop / OT
 * (± otToleranceMin) plus athlete + event (+ optional strong diveId).
 */
export interface FootageAsset {
  id: string;
  /** Strong link when known (preferred over OT fuzzy match). */
  performanceDiveId?: string;
  athleteSlug: string;
  eventId: string;
  discipline: string;
  /** Official top / OT clock from Diveye production (HH:MM or HH:MM:SS). */
  officialTop: string;
  /** Match tolerance in minutes against Performance.ot. */
  otToleranceMin: number;
  quality: FootageQuality;
  /** Storage locator — `local:…` mock keys or future `s3://…` / disk paths. */
  storageKey: string;
  durationSec: number;
  cameras: string[];
  markers: FootageMarker[];
  federation: "AIDA" | "CMAS";
  rightsModel: "diveye_owned" | "cmas_link";
  posterKey?: string;
  /** CMAS embed / external stream URL (no Diveye file sale). */
  embedUrl?: string;
  scene?: { h: number; x: string; d: number };
  annotation?: { type: "none" | "penalty" | "dq"; text: string };
  priceEur?: number;
  notes?: string;
}

export interface ShowcaseDive {
  id: string;
  athleteSlug: string;
  eventId: string;
  discipline: string;
  ap: number;
  rp: number;
  card: Card;
  date: string;
  day: number;
  ot: string;
  status: ResultStatus;
  wr?: boolean;
  title: string;
  durationSec: number;
  cameras: string[];
  markers: DiveMarker[];
  annotation: { type: "none" | "penalty" | "dq"; text: string };
  price: number;
  scene: { h: number; x: string; d: number };
  licenseTier?: LicenseTier;
  /** Linked Diveye FootageAsset id when OT/HQ media is attached. */
  footageAssetId?: string;
  footageQuality?: FootageQuality;
  storageKey?: string;
  previewUrl?: string;
  posterUrl?: string;
  embedUrl?: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  kind: "clip" | "pack" | "media";
  price: number;
  description: string;
  delivery: string;
  licenseTier?: LicenseTier;
  diveId?: string;
  saleEnabled?: boolean;
}

/* ------------------------------------------------------------------ */
/* Ecosystem hooks — devices / field sessions / telemetry (no HW UI)  */
/* ------------------------------------------------------------------ */

/** Diveye capture / computer tiers (fleet model only — not product UI). */
export type DeviceTier = "Compact" | "Connected" | "Pro";

export type DeviceStatus = "online" | "offline" | "maintenance" | "retired";

/**
 * Capture or dive-computer device registered to an org / centre.
 * Hook for later field app + drone plug-in (M8, S8.*).
 */
export interface Device {
  id: string;
  serial: string;
  tier: DeviceTier;
  /** Owning organisation / freediving centre slug or id. */
  ownerOrg: string;
  firmware: string;
  /** ISO-8601 last heartbeat / telemetry. */
  lastSeen: string;
  /** Optional battery % when the device reports it. */
  battery?: number;
  label?: string;
  status?: DeviceStatus;
  notes?: string;
}

export type FieldSessionKind = "competition" | "training" | "demo";
export type FieldSessionStatus =
  | "planned"
  | "active"
  | "completed"
  | "cancelled";

/**
 * Field / capture session — competition day or training block at a site.
 * Maps to future `capture_session` in the product spec.
 */
export interface FieldSession {
  id: string;
  kind: FieldSessionKind;
  status: FieldSessionStatus;
  ownerOrg: string;
  /** Competition event when kind is competition. */
  eventId?: string;
  label: string;
  venue?: string;
  startedAt: string;
  endedAt?: string;
  /** Devices assigned to this session (fleet slice). */
  deviceIds: string[];
  /** Consent records covering recording/publication for this session. */
  consentIds?: string[];
  notes?: string;
}

/**
 * Person ↔ dive ↔ device assignment for a field session.
 * Hook for the field app (M2) without building that UI now.
 */
export interface DiveAssignment {
  id: string;
  fieldSessionId: string;
  athleteSlug: string;
  /** Links to Performance.diveId / ShowcaseDive.id when known. */
  diveId?: string;
  deviceId: string;
  assignedAt: string;
  role?: "primary" | "backup" | "safety";
  notes?: string;
}

export type TelemetryChannel =
  | "depth_m"
  | "speed_ms"
  | "heart_rate"
  | "battery_pct"
  | "temperature_c"
  | "custom";

/**
 * Sparse telemetry hook for overlay / dive computer sync (S4.2, S8.1).
 * Samples stay tiny in seed — real streams come later.
 */
export interface TelemetrySample {
  id: string;
  deviceId: string;
  /** Relative seconds from session or dive start. */
  atSec: number;
  channel: TelemetryChannel;
  value: number;
  unit: string;
  fieldSessionId?: string;
  diveId?: string;
  diveAssignmentId?: string;
  recordedAt?: string;
}

/** Seed cart seed rows (optional demo). Prefer CartLine in the UI. */
export interface CartItem {
  productId: string;
  title: string;
  description: string;
  price: number;
  scene: { h: number; x: string; d: number };
  sku?: string;
  licenseTier?: LicenseTier;
  diveId?: string;
}

export interface LiveResultRow {
  place: number;
  athleteSlug: string;
  ap: number;
  rp: number;
  card: Card;
  nr?: boolean;
}

export interface SeedDb {
  asOf: string;
  disciplines: Discipline[];
  wr: Record<Sex, Record<string, number>>;
  athletes: Athlete[];
  events: Event[];
  performances: Performance[];
  showcaseDives: ShowcaseDive[];
  products: Product[];
  cartSeed: CartItem[];
  liveResults: LiveResultRow[];
  stats: { athletes: number; events: number; results: number; asOf: string };
  site: {
    name: string;
    url: string;
    tagline: string;
    endorsement: string;
  };
  provenanceSources?: ProvenanceSource[];
  licenseTiers?: LicenseTierInfo[];
  consents?: ConsentRecord[];
  recordingRights?: RecordingRights[];
  claimRequests?: ClaimRequest[];
  footageAssets?: FootageAsset[];
  devices?: Device[];
  fieldSessions?: FieldSession[];
  diveAssignments?: DiveAssignment[];
  telemetrySamples?: TelemetrySample[];
  mockAccountAthleteSlug?: string;
  claimsInbox?: string;
}

/* ------------------------------------------------------------------ */
/* Federation judges — training / evidence (PWF-20, Diveye module 6)   */
/* ------------------------------------------------------------------ */

/** Tags a judge attaches when reviewing footage / a training case. */
export type JudgeEvidenceTag =
  | "early_start"
  | "late_start"
  | "surface_protocol"
  | "blackout"
  | "grab"
  | "lane_line"
  | "turn"
  | "depth_marker"
  | "airway"
  | "other";

/** Review mode: async UI first; on-site panel is a stub for hybrid later. */
export type JudgeReviewMode = "async" | "on_site";

export type JudgeCaseDifficulty = "clear" | "borderline" | "hard";

/** Pack linking Diveye FootageAsset + marker subset as review evidence. */
export interface JudgeEvidencePack {
  id: string;
  title: string;
  notes: string;
  mode: JudgeReviewMode;
  footageAssetId: string;
  /** Optional strong link to Performance.diveId. */
  diveId?: string;
  /** Highlighted FootageMarker ids from the linked asset. */
  markerIds: string[];
  tags: JudgeEvidenceTag[];
  federation: "AIDA" | "CMAS";
  discipline: string;
}

/**
 * Anonymized / synthetic training case for white / yellow / red card quizzes.
 * Scored against referenceCard (+ optional tag overlap).
 */
export interface JudgeTrainingCase {
  id: string;
  title: string;
  summary: string;
  discipline: string;
  federation: "AIDA" | "CMAS";
  difficulty: JudgeCaseDifficulty;
  /** Always async for MVP; on_site reserved for hybrid panel. */
  mode: JudgeReviewMode;
  anonymizedAthlete: string;
  scenario: string;
  briefing: string[];
  referenceCard: Card;
  referenceTags: JudgeEvidenceTag[];
  referenceRationale: string;
  evidencePackId: string;
  ruleHints?: string[];
}

export interface FederationJudgesCatalog {
  asOf: string;
  notes?: string;
  materials: Array<{
    id: string;
    title: string;
    body: string;
    federation: "AIDA" | "CMAS" | "BOTH";
  }>;
  evidencePacks: JudgeEvidencePack[];
  trainingCases: JudgeTrainingCase[];
}

/* ------------------------------------------------------------------ */
/* AI coach — private technique feedback (PWF-21, Diveye module 5)     */
/* ------------------------------------------------------------------ */

export type CoachFindingKind = "strength" | "issue" | "drill";

export type CoachReportEngine = "heuristics" | "llm" | "template";

/** Single coaching finding: what improved, what went wrong, or a drill. */
export interface CoachFinding {
  id: string;
  kind: CoachFindingKind;
  title: string;
  detail: string;
  /** Optional FootageMarker / DiveMarker id. */
  markerId?: string;
  atSec?: number;
}

/**
 * Private coaching report for one dive / performance.
 * Visible only to the athlete owner and linked coaches (S5.2).
 */
export interface CoachReport {
  id: string;
  diveId: string;
  performanceId?: string;
  footageAssetId?: string;
  athleteSlug: string;
  createdAt: string;
  createdByUserId: string;
  engine: CoachReportEngine;
  summary: string;
  findings: CoachFinding[];
  /** Mock / marker-derived depth·time snapshot (not medical telemetry). */
  telemetrySnapshot?: {
    maxDepthM?: number;
    diveTimeSec?: number;
    turnAtSec?: number;
    surfaceAtSec?: number;
    protocolAtSec?: number;
  };
  disclaimer: string;
  visibility: "private";
}

/** Coach ↔ athlete assignment (Diveye S5.2 stub). */
export interface CoachAthleteLink {
  id: string;
  coachUserId: string;
  athleteSlug: string;
  status: "active" | "revoked";
  createdAt: string;
  notes?: string;
}

/* ------------------------------------------------------------------ */
/* Coaching marketplace bookings (PWF-23, Diveye S5.3)                 */
/* ------------------------------------------------------------------ */

export type CoachPackageKind = "video_review" | "live_remote" | "block";

export type CoachSlotStatus = "open" | "held" | "booked";

export type CoachingBookingStatus =
  | "paid_simulated"
  | "confirmed"
  | "cancelled";

/** Public marketplace profile linked to a demo coach user. */
export interface CoachProfile {
  id: string;
  slug: string;
  userId: string;
  name: string;
  headline: string;
  bio: string;
  specialties: string[];
  languages: string[];
  location: string;
  /** CSS scene hue for catalog cards (no photo assets in MVP). */
  photoHue: number;
  active: boolean;
}

/** Priced coaching package in EUR. */
export interface CoachPackage {
  id: string;
  coachSlug: string;
  title: string;
  description: string;
  kind: CoachPackageKind;
  durationMin: number;
  priceEur: number;
}

/** Bookable availability window for a coach. */
export interface CoachAvailabilitySlot {
  id: string;
  coachSlug: string;
  startsAt: string;
  endsAt: string;
  status: CoachSlotStatus;
  /** When booked, points at CoachingBooking.id. */
  bookingId?: string;
}

/** Paid coaching session booking (JSON file store). */
export interface CoachingBooking {
  id: string;
  coachSlug: string;
  coachUserId: string;
  athleteUserId: string;
  athleteEmail: string;
  athleteName: string;
  packageId: string;
  packageTitle: string;
  slotId: string;
  startsAt: string;
  endsAt: string;
  priceEur: number;
  /** Diveye platform take rate applied at booking time (config constant). */
  commissionPercent: number;
  diveyeFeeEur: number;
  coachPayoutEur: number;
  status: CoachingBookingStatus;
  payment: {
    provider: "simulated";
    simulated: true;
  };
  createdAt: string;
  notes?: string;
}

export interface CoachingMarketplaceSeed {
  profiles: CoachProfile[];
  packages: CoachPackage[];
  slots: CoachAvailabilitySlot[];
}

/* ------------------------------------------------------------------ */
/* Archive AI index — searchable VOD moments (PWF-22, Diveye S2.2/S2.3) */
/* ------------------------------------------------------------------ */

export type ArchiveIndexEngine = "heuristics" | "llm" | "template";

/**
 * One searchable moment: FootageAsset marker + dive/performance metadata.
 * Deep-link via seekUrl (`/dives/{id}?t={atSec}`).
 */
export interface ArchiveMoment {
  id: string;
  diveId: string;
  footageAssetId: string;
  athleteSlug: string;
  athleteName: string;
  eventId: string;
  eventName: string;
  discipline: string;
  federation: "AIDA" | "CMAS";
  markerId: string;
  markerKind: FootageMarkerKind | string;
  markerLabel: string;
  /** Absolute seconds from clip start — used for `?t=` seek. */
  atSec: number;
  /** Normalized 0–1 timeline position. */
  at: number;
  title: string;
  summary: string;
  tags: string[];
  card?: Card;
  rp?: number;
  ap?: number;
  date?: string;
  /** `/dives/{diveId}?t={atSec}` */
  seekUrl: string;
  engine: ArchiveIndexEngine;
}

/** Persisted searchable archive built by script / API. */
export interface ArchiveIndexFile {
  asOf: string;
  engine: ArchiveIndexEngine;
  notes?: string;
  momentCount: number;
  moments: ArchiveMoment[];
}

export type RankingBoard = "PORTAL" | "AIDA" | "CMAS";
export type RankingScope = "active" | "season" | "all";
export type RankingMetric = "points" | "pct";
export type RankingDisc =
  | "OVERALL"
  | "DEPTH"
  | "POOL"
  | "CWT"
  | "CWTB"
  | "CNF"
  | "FIM"
  | "STA"
  | "DYN"
  | "DYNB"
  | "DNF";

export interface RankingOpts {
  board: RankingBoard;
  sex: Sex;
  disc: RankingDisc;
  scope: RankingScope;
  metric: RankingMetric;
  country?: string;
  includeMinors?: boolean;
}

export interface RankingRow {
  pos: number;
  athlete: Athlete;
  best: Record<string, Performance>;
  total: number;
  pct: number;
  count: number;
}
