import { ImageResponse } from "next/og";

export const socialImageSize = { width: 1200, height: 630 };
export const socialImageContentType = "image/png";
export const socialImageAlt = "Hireflow — a focused hiring pipeline tracker";

const BRAND_INDIGO = "#4338ca";

/**
 * Shared, language-neutral Open Graph/Twitter card. Renders the funnel mark, the
 * Hireflow wordmark, and a short product proposition — no runtime/tenant data, generous
 * safe margins so common preview crops don't clip content.
 */
export function renderSocialCard(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 96px",
          background: "#0f1420",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
            <path d="M3 4.5h18l-6.75 8.1v6.15l-4.5 2.25v-8.4L3 4.5Z" fill={BRAND_INDIGO} />
          </svg>
          <span style={{ fontSize: 56, fontWeight: 700, color: "#ffffff" }}>Hireflow</span>
        </div>
        <p
          style={{
            marginTop: 40,
            maxWidth: 900,
            fontSize: 32,
            lineHeight: 1.4,
            color: "#eef0fd",
          }}
        >
          A focused, secure hiring tracker: job openings, candidate pipelines, and hiring
          decisions in one workspace per team.
        </p>
      </div>
    ),
    { ...socialImageSize },
  );
}
