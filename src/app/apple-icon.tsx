import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        gap: 15,
        paddingBottom: 20,
      }}
    >
      <div
        style={{
          width: 35,
          height: "42%",
          borderRadius: 10,
          background: "#78ad68",
        }}
      />
      <div
        style={{
          width: 35,
          height: "62%",
          borderRadius: 10,
          background: "#d74e4e",
        }}
      />
      <div
        style={{
          width: 35,
          height: "82%",
          borderRadius: 10,
          background: "#5e9ed6",
        }}
      />
    </div>,
    size,
  );
}
