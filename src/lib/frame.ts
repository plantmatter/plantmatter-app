// Shape of the detail photo frame: each photo's own shape, between 16:9 landscape and 3:4 portrait.
/** Tallest portrait frame 3:4 and widest landscape frame 16:9, as height ÷ width. */
export const FRAME_TALLEST = 4 / 3;
export const FRAME_WIDEST = 9 / 16;
/** Height ÷ width of the frame for a photo of w × h; unknown sizes get 3:4 portrait (most phone photos). */
export const frameRatio = (w: number, h: number) => (w > 0 && h > 0 ? Math.min(FRAME_TALLEST, Math.max(FRAME_WIDEST, h / w)) : 4 / 3);
