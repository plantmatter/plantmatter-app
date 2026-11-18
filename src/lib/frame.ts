// Shape of the detail photo frame: each photo's own shape, between 4:3 landscape and 9:16 portrait.
/** Tallest portrait frame 9:16 and widest landscape frame 4:3, as height ÷ width. */
export const FRAME_TALLEST = 16 / 9;
export const FRAME_WIDEST = 3 / 4;
/** Height ÷ width of the frame for a photo of w × h; unknown sizes get 3:4 portrait (most phone photos). */
export const frameRatio = (w: number, h: number) => (w > 0 && h > 0 ? Math.min(FRAME_TALLEST, Math.max(FRAME_WIDEST, h / w)) : 4 / 3);
