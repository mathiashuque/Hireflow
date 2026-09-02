import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

const BRAND_INDIGO = "#4338ca";

/** 512x512 manifest icon — same mark, referenced by `manifest.ts` as `/icon2`. */
export default function Icon512() {
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
        <svg width="320" height="320" viewBox="0 0 24 24" fill="none">
          <path d="M3 4.5h18l-6.75 8.1v6.15l-4.5 2.25v-8.4L3 4.5Z" fill={BRAND_INDIGO} />
        </svg>
      </div>
    ),
    { ...size },
  );
}
