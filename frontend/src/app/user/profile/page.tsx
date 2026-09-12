import { redirect } from "next/navigation";
import TarotPageLayout from "@/components/TarotPageLayout";
import OrnateFrame from "@/components/OrnateFrame";
import { getCurrentUser } from "@/lib/session";
import { getDashboard } from "./actions";
import AccountPanel from "./AccountPanel";
import ReadingsPanel from "./ReadingsPanel";
import type { ReadingsSummary } from "./ReadingsPanel";

const ProfilePage = async () => {
  // getCurrentUser is request-cached, so the guard inside getDashboard reuses it
  const [user, dash] = await Promise.all([getCurrentUser(), getDashboard()]);

  if (!user) redirect("/user/login");

  const budget = dash.ok
    ? { remainingUsd: dash.data.remainingBudgetUsd, budgetUsd: dash.data.budgetUsd }
    : null;

  const summary: ReadingsSummary | null = dash.ok
    ? {
        total: dash.data.totalReadings,
        lastReading: dash.data.lastReading,
        tags: dash.data.userTags,
      }
    : null;

  return (
    <TarotPageLayout backButtonHref="/" backButtonLabel="Portal" scrollable>
      <div className="w-full max-w-4xl mx-auto mt-8 sm:mt-16 px-4 sm:px-0">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="text-4xl text-[#d4af37]/80">&#9737;</span>
          <h1
            className="text-3xl text-[#d4af37] tracking-[0.2em] mt-4"
            style={{
              fontFamily: "'Cinzel', serif",
              textShadow: "0 0 30px rgba(212,175,55,0.4)",
            }}
          >
            The Sanctum
          </h1>
          <div className="flex items-center justify-center gap-3 mt-3">
            <div className="w-12 h-px bg-gradient-to-r from-transparent to-[#d4af37]/40" />
            <span className="text-[#d4af37]/60 text-sm">&#9765;</span>
            <div className="w-12 h-px bg-gradient-to-l from-transparent to-[#d4af37]/40" />
          </div>
        </div>

        {/* Dashboard card */}
        <div className="relative overflow-hidden rounded-2xl border border-[#d4af37]/20 bg-gradient-to-b from-[#1a0033]/80 to-[#0a0015]/80 backdrop-blur-sm">
          <OrnateFrame size="sm" />
          <div className="relative grid grid-cols-1 md:grid-cols-2">
            {/* Vertical divider (≥ md) */}
            <div
              className="sanctum-divider absolute pointer-events-none"
              aria-hidden="true"
              style={{
                left: "50%",
                top: "2rem",
                bottom: "2rem",
                width: 1,
                background:
                  "linear-gradient(to bottom, transparent, rgba(212,175,55,0.35), transparent)",
              }}
            />

            <AccountPanel
              displayName={user.displayName}
              email={user.email}
              budget={budget}
            />

            {/* Horizontal divider (< md) */}
            <div
              className="sanctum-divider--mobile"
              aria-hidden="true"
              style={{
                height: 1,
                margin: "0 1.25rem",
                background:
                  "linear-gradient(to right, transparent, rgba(212,175,55,0.35), transparent)",
              }}
            />

            <ReadingsPanel summary={summary} />
          </div>
        </div>

        {!dash.ok && (
          <p
            className="text-center text-[#e6d5b8]/30 text-xs mt-4"
            style={{ fontFamily: "'Crimson Pro', serif" }}
          >
            {dash.error}
          </p>
        )}

        {/* Footer decoration */}
        <div className="mt-12 text-center">
          <div className="flex items-center justify-center gap-3">
            <span className="text-[#d4af37]/40">&#10022;</span>
            <span className="text-[#d4af37]/30">&#10022;</span>
            <span className="text-[#d4af37]/40">&#9765;</span>
            <span className="text-[#d4af37]/30">&#10022;</span>
            <span className="text-[#d4af37]/40">&#10022;</span>
          </div>
        </div>
      </div>
    </TarotPageLayout>
  );
};

export default ProfilePage;
