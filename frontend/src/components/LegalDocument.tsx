import Link from "next/link";
import { currentVersion, listVersions, loadDocument } from "@/lib/legal-documents";
import { DOCUMENT_TITLES, type LegalDocumentId } from "@/lib/legal-versions";
import { formatReadingDate } from "@/lib/profile-dashboard";

interface LegalDocumentProps {
  id: LegalDocumentId;
  /** Defaults to the current version */
  version?: string;
  /** "page" adds the title and the list of other versions; "embedded" (inside
      a modal that already shows the title) renders the version line and body */
  variant?: "page" | "embedded";
}

const MUTED = { fontFamily: "'Crimson Pro', serif" } as const;

/**
 * One dated version of a legal document, rendered from its MDX file. Server
 * component: client forms receive it as a ready node (register, accept-terms,
 * manage-consent), so the document text never ships as client JS.
 */
const LegalDocument = async ({ id, version, variant = "embedded" }: LegalDocumentProps) => {
  const shown = version ?? currentVersion(id);
  const Body = await loadDocument(id, shown);
  if (!Body) return null;

  const current = currentVersion(id);
  const others = listVersions(id)
    .filter((v) => v !== shown)
    .reverse();

  return (
    <article>
      {variant === "page" && (
        <h1
          className="text-2xl sm:text-3xl text-[#d4af37] tracking-[0.15em] text-center"
          style={{ fontFamily: "'Cinzel', serif", textShadow: "0 0 30px rgba(212,175,55,0.4)" }}
        >
          {DOCUMENT_TITLES[id]}
        </h1>
      )}

      <p
        className={`text-[#e6d5b8]/50 text-sm ${variant === "page" ? "text-center" : ""}`}
        style={{ ...MUTED, marginTop: variant === "page" ? "0.75rem" : 0, marginBottom: "1.5rem" }}
      >
        Version {shown} &middot; effective {formatReadingDate(shown)}
        {shown !== current && (
          <>
            {" "}
            &middot; an earlier version &mdash;{" "}
            <Link
              href={`/legal/${id}`}
              className="text-[#d4af37]/70 hover:text-[#d4af37] underline underline-offset-4"
            >
              see the current one
            </Link>
          </>
        )}
      </p>

      <Body />

      {variant === "page" && others.length > 0 && (
        <div
          className="border-t border-[#d4af37]/10"
          style={{ marginTop: "2rem", paddingTop: "1rem" }}
        >
          <p className="text-[#e6d5b8]/50 text-sm" style={MUTED}>
            Other versions:{" "}
            {others.map((v, i) => (
              <span key={v}>
                {i > 0 && ", "}
                <Link
                  href={`/legal/${id}/${v}`}
                  className="text-[#d4af37]/70 hover:text-[#d4af37] underline underline-offset-4"
                >
                  {v}
                </Link>
              </span>
            ))}
          </p>
        </div>
      )}
    </article>
  );
};

export default LegalDocument;
