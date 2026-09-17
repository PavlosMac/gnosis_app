# Self-Hosting Email — Investigation & Guide

## The question

Can we run our own email (send + receive, on our own domain) cheaply and simply on a
Raspberry Pi at home, using Miguel Grinberg's guide
(https://blog.miguelgrinberg.com/post/how-to-host-your-own-email-server) as the blueprint?

**Short answer: no.** The Pi-at-home route is cheap in money but expensive in your time and
carries real risk of mail silently disappearing. Since the domain is already on Cloudflare
(used for tunneling) and there's an existing Gmail account, **Cloudflare Email Routing +
Gmail** is the actual simplest/cheapest option — $0/year, no new services. Details and
reasoning below, plus setup steps for the paid and self-hosted alternatives we considered.

## What we found

1. **Grinberg's guide doesn't build what we need.** It only sets up *outbound* sending
   (Postfix + DKIM signing in a Docker container). For *receiving* mail, the guide itself
   just uses a third-party forwarding service — it never sets up a real inbox (IMAP). So
   even followed exactly, it wouldn't give us a mailbox we can read from.

2. **Bahnhof blocks outbound port 25 on home connections.** This contradicts what we assumed
   going in. Three independent user reports (Swedish forums) show people hitting delivery
   errors trying to send directly from home. The documented workaround: relay outgoing mail
   through Bahnhof's own server (`mailout.privat.bahnhof.se`, port 587/465, your Bahnhof
   login), capped at ~1000 emails/day. Inbound port 25 is *not* blocked, so receiving mail at
   home works fine — sending is the blocked half.

3. **Even a perfect setup can get silently blacklisted by Gmail/Outlook.** Multiple
   long-term self-hosters (one with 23 years of experience, perfect SPF/DKIM/DMARC/reverse-DNS,
   a 10/10 mail-tester.com score) still got blocked or had mail silently discarded. This isn't
   a config mistake — big providers are just harsher on small/unknown senders and
   residential IP ranges. One Bahnhof user running this exact kind of setup scored only 3/10
   on mail-tester and had mail landing in recipients' spam folders.

4. **The usual "easy" self-host option won't run on a Pi at all.** Mail-in-a-Box (the most
   common turnkey Postfix+Dovecot bundle) requires an unmodified 64-bit Ubuntu machine — no
   containers, no ARM. A Pi is ruled out for that path; you'd be hand-rolling Postfix +
   Dovecot + spam filtering yourself, or using a VPS instead.

5. **A reverse-DNS (PTR) record matters for deliverability**, and it's unclear whether
   Bahnhof provides one for home connections — their public-IP order page (MAC-address based)
   doesn't mention it. This would need to be confirmed with Bahnhof support before relying on
   a home connection for anything receiving-side.

## Recommendation

**Use Cloudflare Email Routing (free) + your existing Gmail account.** The domain's DNS is
already on Cloudflare for the tunnel, so this is a toggle in a dashboard already in use —
no new provider, no server, $0/year.

- **Receiving:** Cloudflare Email Routing forwards `you@yourdomain.com` straight into your
  Gmail inbox. Cloudflare manages the MX/SPF records itself since it already controls the
  domain's DNS.
- **Sending:** Gmail's "Send mail as" feature lets you compose/reply as
  `you@yourdomain.com`, sent through Gmail's own servers (good deliverability, since you're
  riding on Gmail's sending reputation, not a fresh IP).
- **Trade-off:** recipients' Gmail clients may show a small "via gmail.com" next to your
  name. Cosmetic only — doesn't affect delivery or spam filtering.

### Setup steps (Cloudflare + Gmail)
1. Cloudflare dashboard → your domain → **Email** → **Email Routing** → Enable.
2. Add a routing rule: `you@yourdomain.com` → forward to your Gmail address.
3. In Gmail: Settings → Accounts and Import → "Send mail as" → add `you@yourdomain.com`,
   verify via the confirmation email (arrives through the forwarding rule you just made).
4. Send a test email to https://www.mail-tester.com from the new address to confirm a clean
   score.

No server, no Pi, no ongoing maintenance, no cost.

### If you want the "via gmail.com" label gone
That requires full domain-aligned DKIM, which free Gmail doesn't offer. Two paid options,
in increasing order of control:
- **Google Workspace** (~$7/month) — full custom-domain Gmail, no label, still zero
  maintenance.
- **A cheap hosted mailbox** (e.g. Purelymail, Migadu — roughly $10-15/year) — your own
  domain, no label, still zero maintenance, but a second inbox to check instead of using
  Gmail directly.

## Alternative: self-host on a small VPS (if you want the control)

If you want to run your own server for the learning experience or control, do it on a
cheap VPS with a static IP (Hetzner, DigitalOcean, etc.) instead of the Pi — Grinberg's own
guide recommends this for the same reason: residential IPs don't come with a static
address or a clean deliverability history.

1. Rent a small VPS with a static IP from a "mail-friendly" provider (check they don't
   block port 25, or file a support ticket to unblock it).
2. Point your domain's MX record at the VPS.
3. Ask the provider to set a matching PTR (reverse DNS) record for the VPS IP.
4. Install Mailcow (dockerized Postfix + Dovecot + Rspamd + SOGo) — this gives full
   send + receive + a web UI + spam filtering in one bundle, unlike Grinberg's guide.
5. Set up SPF, DKIM, and a staged DMARC rollout (`p=none` → `p=quarantine` → `p=reject`).
6. Check the VPS IP isn't already on a blocklist (Spamhaus, Barracuda, Microsoft SNDS)
   before going live.
7. Test with mail-tester.com, and keep monitoring — this needs periodic attention
   (security patches, blocklist checks) indefinitely.

## Alternative: hybrid — Pi for sending, forwarding for receiving

This is the closest match to what Grinberg's guide actually builds, adapted for Bahnhof.
Cheapest self-hosted option, but weakest deliverability control — treat it as a fallback,
not the main recommendation.

1. Run Postfix on the Pi (the `boky/postfix` Docker image Grinberg uses, which bundles
   OpenDKIM).
2. Configure Postfix to relay outbound mail through Bahnhof's SMTP server rather than
   sending directly (works around the port-25 block):
   ```
   relayhost = [mailout.privat.bahnhof.se]:587
   smtp_sasl_auth_enable = yes
   ```
   (Bahnhof account credentials go in `sasl_passwd`.) Note the ~1000 emails/day cap.
3. Set up SPF, DKIM, and DMARC records for outbound authentication.
4. For receiving, don't self-host it — use your domain registrar's forwarding, or forward
   to a hosted mailbox/Gmail, same as Grinberg's own setup.
5. Test outbound deliverability with mail-tester.com regularly, since small/residential
   senders are the most likely to get flagged.

## Sources
- https://blog.miguelgrinberg.com/post/how-to-host-your-own-email-server
- https://cfenollosa.com/blog/after-self-hosting-my-email-for-twenty-three-years-i-have-thrown-in-the-towel-the-oligopoly-has-won.html
- https://andreas.heigl.org/2024/07/09/outlook-com-and-self-hosted-email-servers/
- https://mailinabox.email/
- SweClockers forum threads on Bahnhof + self-hosted mail (port 25 block, relay workaround)
- Flashback forum thread on ISP port 25 blocking
