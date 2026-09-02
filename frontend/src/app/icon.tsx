import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

const BRAND_INDIGO = "#4338ca";

/**
 * Browser-tab favicon: the funnel/pipeline mark from `BrandMark.tsx`, redrawn at icon
 * scale on an opaque near-black tile for contrast and legibility at 16x16/32x32. Source
 * of truth for the mark geometry stays `BrandMark.tsx`; this route mirrors its path data
 * rather than importing it, since `next/og` renders through Satori, not the DOM.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f1420",
          borderRadius: 6,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M3 4.5h18l-6.75 8.1v6.15l-4.5 2.25v-8.4L3 4.5Z" fill={BRAND_INDIGO} />
        </svg>
      </div>
    ),
    { ...size },
  );
}
