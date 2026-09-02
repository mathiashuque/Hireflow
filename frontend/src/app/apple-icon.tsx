import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const BRAND_INDIGO = "#4338ca";

/** Apple touch icon: same mark as `icon.tsx`, at Apple's recommended 180x180 with safe padding. */
export default function AppleIcon() {
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
        }}
      >
        <svg width="112" height="112" viewBox="0 0 24 24" fill="none">
          <path d="M3 4.5h18l-6.75 8.1v6.15l-4.5 2.25v-8.4L3 4.5Z" fill={BRAND_INDIGO} />
        </svg>
      </div>
    ),
    { ...size },
  );
}
