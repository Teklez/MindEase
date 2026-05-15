import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

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
          background: "hsl(150, 18%, 38%)",
          borderRadius: 6,
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="hsl(40, 25%, 97%)"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 21c0-7 4-12 9-13-1 9-5 13-9 13Z" />
          <path d="M12 21c0-5-3-9-8-10 1 7 4 10 8 10Z" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
