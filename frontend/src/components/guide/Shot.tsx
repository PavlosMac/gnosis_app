import Image from "next/image";
import { shotExists } from "@/lib/guide-shots";

export interface ShotMark {
  /** Left edge, % of the image width */
  x: number;
  /** Top edge, % of the image height */
  y: number;
  /** Ring width, % of the image width */
  w: number;
  /** Ring height, % of the image height */
  h: number;
  label: string;
  /** "ellipse" (default) suits buttons and icons; "rect" (rounded rectangle) suits wide blocks of text */
  shape?: "ellipse" | "rect";
}

export interface ShotProps {
  /** Path under public/, e.g. /guide/making-a-reading/01-spreads.png */
  src: string;
  /** Intrinsic pixel size of the capture (sets the aspect ratio) */
  w: number;
  h: number;
  alt: string;
  marks?: ShotMark[];
  /** Display width cap in px; use for narrow captures so UI elements are not blown up to the panel width */
  maxWidth?: number;
}

const GOLD = "#d4af37";

const Legend = ({ marks }: { marks: ShotMark[] }) =>
  marks.length > 0 ? (
    <ol
      className="text-[#e6d5b8]/85 text-base"
      style={{ fontFamily: "'Crimson Pro', serif", listStyle: "none", padding: 0, margin: "0.75rem 0 0" }}
    >
      {marks.map((m, i) => (
        <li key={`${i}-${m.label}`} style={{ display: "flex", gap: "0.6rem", alignItems: "baseline", marginBottom: "0.35rem" }}>
          <span
            aria-hidden
            style={{
              flex: "none",
              width: "1.4rem",
              height: "1.4rem",
              borderRadius: "50%",
              border: `1px solid ${GOLD}`,
              color: GOLD,
              fontSize: "0.8rem",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {i + 1}
          </span>
          <span>{m.label}</span>
        </li>
      ))}
    </ol>
  ) : null;

/** A captured screenshot with numbered gold rings drawn over it. Rings are percentage-positioned,
    so they scale with the image. Without the PNG a placeholder keeps the chapter readable. */
const Shot = ({ src, w, h, alt, marks = [], maxWidth }: ShotProps) => {
  const present = shotExists(src);
  return (
    <figure style={{ margin: maxWidth ? "1.5rem auto" : "1.5rem 0", maxWidth: maxWidth ? `${maxWidth}px` : undefined }}>
      {present ? (
        <div
          style={{
            position: "relative",
            borderRadius: "0.5rem",
            border: "1px solid rgba(212,175,55,0.3)",
          }}
        >
          <Image src={src} width={w} height={h} alt={alt} sizes="(min-width: 768px) 720px, 100vw" style={{ width: "100%", height: "auto", display: "block", borderRadius: "calc(0.5rem - 1px)" }} />
          {marks.map((m, i) => (
            <span
              key={`${i}-${m.label}`}
              aria-hidden
              style={{
                position: "absolute",
                left: `${m.x}%`,
                top: `${m.y}%`,
                width: `${m.w}%`,
                height: `${m.h}%`,
                borderRadius: m.shape === "rect" ? "12px" : "50%",
                border: `3px solid ${GOLD}`,
                boxShadow: "0 0 0 2px rgba(10,0,21,0.6), 0 0 14px rgba(212,175,55,0.7)",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: "-0.9rem",
                  left: "-0.9rem",
                  width: "1.6rem",
                  height: "1.6rem",
                  borderRadius: "50%",
                  background: GOLD,
                  color: "#0a0015",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {i + 1}
              </span>
            </span>
          ))}
        </div>
      ) : (
        <div
          role="img"
          aria-label={alt}
          style={{
            aspectRatio: `${w} / ${h}`,
            border: "1px dashed rgba(212,175,55,0.4)",
            borderRadius: "0.5rem",
            background: "rgba(26,0,51,0.5)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "1rem",
            color: "rgba(230,213,184,0.6)",
            fontFamily: "'Cinzel', serif",
          }}
        >
          <span style={{ color: GOLD, letterSpacing: "0.1em", fontSize: "0.8rem", textTransform: "uppercase" }}>
            Screenshot pending
          </span>
          <span style={{ marginTop: "0.5rem", fontFamily: "'Crimson Pro', serif", fontSize: "1rem" }}>{alt}</span>
        </div>
      )}
      <Legend marks={marks} />
    </figure>
  );
};

export default Shot;
