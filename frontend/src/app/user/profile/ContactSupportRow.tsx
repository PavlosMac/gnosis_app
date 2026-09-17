"use client";

import { useState } from "react";
import { MailPen } from "lucide-react";
import ContactSupportModal from "./ContactSupportModal";

/** The AccountPanel's "Contact support" row: same visuals as the old
    ProfileLinkRow, but a button opening the support modal instead of a link */
const ContactSupportRow = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="pt-4 border-t border-[#d4af37]/10">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between group"
      >
        <span
          className="text-[#e6d5b8]/60 text-sm tracking-wider uppercase group-hover:text-[#d4af37] transition-colors"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          Contact support
        </span>
        <span
          className="text-[#d4af37]/40 group-hover:text-[#d4af37] transition-colors"
          aria-hidden="true"
        >
          <MailPen size={18} strokeWidth={1.75} />
        </span>
      </button>

      {open && <ContactSupportModal onClose={() => setOpen(false)} />}
    </div>
  );
};

export default ContactSupportRow;
