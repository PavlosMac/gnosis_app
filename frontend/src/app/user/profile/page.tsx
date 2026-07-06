import { redirect } from "next/navigation";
import Link from "next/link";
import TarotPageLayout from "@/components/TarotPageLayout";
import { getCurrentUser } from "@/lib/session";
import LogoutButton from "@/components/LogoutButton";

const ProfileRow = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <div className="flex items-center justify-between">
    <span
      className="text-[#e6d5b8]/60 text-sm tracking-wider uppercase"
      style={{ fontFamily: "'Cinzel', serif" }}
    >
      {label}
    </span>
    <span
      className="text-[#e6d5b8] text-sm"
      style={{ fontFamily: "'Crimson Pro', serif" }}
    >
      {value}
    </span>
  </div>
);

const ProfilePage = async () => {
  const user = await getCurrentUser();

  if (!user) redirect("/user/login");

  return (
    <TarotPageLayout backButtonHref="/" backButtonLabel="Portal">
      <div className="w-full max-w-lg mx-auto mt-8 sm:mt-16 px-4 sm:px-0">
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
            Your Sanctum
          </h1>
          <div className="flex items-center justify-center gap-3 mt-3">
            <div className="w-12 h-px bg-gradient-to-r from-transparent to-[#d4af37]/40" />
            <span className="text-[#d4af37]/60 text-sm">&#9765;</span>
            <div className="w-12 h-px bg-gradient-to-l from-transparent to-[#d4af37]/40" />
          </div>
        </div>

        {/* Profile card */}
        <div className="rounded-2xl border border-[#d4af37]/20 bg-gradient-to-b from-[#1a0033]/80 to-[#0a0015]/80 backdrop-blur-sm p-5 sm:p-8 space-y-6">
          {/* Identity */}
          <ProfileRow label="Name" value={user.displayName || "Seeker"} />
          <ProfileRow label="Email" value={user.email} />

          {/* Credits */}
          <div className="pt-4 border-t border-[#d4af37]/10">
            <div className="flex items-center justify-between">
              <span
                className="text-[#e6d5b8]/60 text-sm tracking-wider uppercase"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                Readings
              </span>
              <span
                className="text-2xl text-[#d4af37]"
                style={{
                  fontFamily: "'Cinzel', serif",
                  textShadow: "0 0 10px rgba(212,175,55,0.3)",
                }}
              >
                {user.credits}
              </span>
            </div>
          </div>

          {/* Past Readings */}
          <div className="pt-4 border-t border-[#d4af37]/10">
            <Link
              href="/user/readings"
              className="flex items-center justify-between group"
            >
              <span
                className="text-[#e6d5b8]/60 text-sm tracking-wider uppercase group-hover:text-[#d4af37] transition-colors"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                Readings Journal
              </span>
              <span className="text-[#d4af37]/40 group-hover:text-[#d4af37] transition-colors">
                &#8594;
              </span>
            </Link>
          </div>

          {/* Logout */}
          <div className="pt-4 border-t border-[#d4af37]/10">
            <LogoutButton />
          </div>
        </div>

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
