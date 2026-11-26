export type Sex = "M" | "F";
export type Federation = "AIDA" | "CMAS" | "PORTAL";
export type Card = "W" | "Y" | "R";
export type AthleteStatus = "active" | "inactive" | "minor";
export type EventStatus = "live" | "upcoming" | "past";
export type ResultStatus = "provisional" | "official" | "unofficial";

/** Licence funnel tiers (sample → social → master → commercial). */
export type LicenseTier = "sample" | "social" | "master" | "commercial";

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

export interface ClaimRequest {
  id: string;
  athleteName: string;
  athleteSlug?: string;
  email: string;
  federationId?: string;
  guardian: boolean;
  status: "pending" | "needs_info" | "approved" | "rejected";
  createdAt: string;
  notes?: string;
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

export interface CartItem {
  productId: string;
  title: string;
  description: string;
  price: number;
  scene: { h: number; x: string; d: number };
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
  mockAccountAthleteSlug?: string;
  claimsInbox?: string;
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
