/** Clipper works on integers: 1 unit = 1 µm, so mm * CLIPPER_SCALE. */
export const CLIPPER_SCALE = 1000

export type Pt = { X: number; Y: number }
export type Path = Pt[]
