/** Each stratum of the world is this many times smaller than the one above. */
export const ZOOM_STEP = 6;

export type NodeKind =
  | 'root'
  | 'project'
  | 'study'
  | 'mechanism'
  | 'source'
  | 'gallery'
  | 'about'
  | 'contact'
  | 'marginalia';

export interface Stage {
  label: string;
  detail: string;
}

export interface Section {
  h: string;
  p: string;
}

export interface Pair {
  k: string;
  v: string;
}

export interface Shot {
  /** Path under public/, e.g. /clients/name.webp */
  src: string;
  alt: string;
  caption: string;
  /** Spans two grid columns. */
  wide?: boolean;
}

export interface Link {
  label: string;
  value: string;
  href: string;
  /** Links sharing a group render together as one titled column. */
  group?: string;
}

/**
 * Authoring units: `at` is an offset from the parent's centre measured in the
 * PARENT's design pixels, and `size` is the node's own design size. Absolute
 * world coordinates are derived in build.ts - never written by hand.
 */
export interface NodeSpec {
  id: string;
  kind: NodeKind;
  at?: [number, number];
  size?: [number, number];
  /** Caption for the marker the parent draws over this child. */
  portal?: string;
  /** Overrides the kind's default header label on the plate and in the depth trail. */
  label?: string;
  children?: NodeSpec[];

  title?: string;
  sub?: string;
  index?: string;
  year?: string;
  role?: string;
  status?: string;
  stack?: string[];
  lede?: string;
  sections?: Section[];
  metrics?: Pair[];
  facts?: Pair[];
  paras?: string[];
  /** Paragraphs split into pages that the WHO panel turns through in place. */
  pages?: string[][];
  stages?: Stage[];
  notes?: string[];
  links?: Link[];
  shots?: Shot[];
  file?: string;
  lang?: 'ts' | 'py' | 'go';
  code?: string;
  text?: string;
}

/** A spec with its position in the world resolved and its DOM built. */
export interface WorldNode {
  spec: NodeSpec;
  id: string;
  kind: NodeKind;
  depth: number;
  parent: WorldNode | null;
  children: WorldNode[];
  /** World-space centre. */
  wx: number;
  wy: number;
  /** World units per design pixel for this node. */
  s: number;
  dw: number;
  dh: number;
  el: HTMLElement;
  /** Marker the PARENT draws to advertise this node as a dive target. */
  portalEl: HTMLElement | null;
  /** Rendered opacity last frame; drives pointer-events and focus scoring. */
  alpha: number;
  /** 1 while on the viewed branch, eased toward 0 when off it. */
  branch: number;
  mounted: boolean;
  /**
   * Parallax layers inside the plate: as the plate slides across the screen
   * each shifts by its own share of the offset. `at` is the shift last written.
   */
  layers: { el: HTMLElement; k: number; at: number }[];
}
