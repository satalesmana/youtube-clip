/** Normalized focal point within a frame; (0,0) is top-left, (1,1) is bottom-right. */
export interface FocalPoint {
  x: number;
  y: number;
}

/** A pixel-space crop rectangle in the source video's coordinate system. */
export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}
