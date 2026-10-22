# Guide screenshot checklist

Working list for capturing the screenshots of the `/guide` chapters. Everything needed to add them is on this page; you do not need a Claude session. How the guide is built is in [`user-guide.md`](user-guide.md).

**12 screenshots, 6 captured (your-profile, making-a-reading and saving-a-reading, 2026-10-22), 6 to go.** Tick a box when the PNG is in place.

Until a PNG exists the chapter shows a dashed "Screenshot pending" box plus the numbered legend, so you can add them in any order.

## Capture table

Save each file at the path shown. Folder = chapter. Details and ring labels are in the sections below.

| ☐ | Save as (under `frontend/public/guide/`) | Size | Page | What to capture |
|---|---|---|---|---|
| ☑ | `your-profile/01-profile.png` | 1806 × 1160 | `/user/profile` | Signed in, with a few saved readings and tags so the Readings Journal panel and the Focused tags are filled. Whole page, both panels. |
| ☑ | `making-a-reading/01-setup.png` | 2302 × 1664 | `/reading` | Setup screen with **Three Card** selected (this makes the question box appear). Whole page. |
| ☑ | `making-a-reading/02-deck.png` | 1618 × 1168 | `/reading` | Press Begin, then capture the 78 face-down cards with the "Select N card(s)" prompt, before choosing any. |
| ☑ | `making-a-reading/03-reading.png` | 1566 × 1634 | `/reading` | A finished reading, signed in, so the bookmark (top right) is visible. Add a question on the setup screen first so it shows. |
| ☑ | `saving-a-reading/01-save-icon.png` | 1342 × 980 | `/reading` | Crop only the top of a finished reading, enough to show the bookmark icon at the top right. Short image. |
| ☑ | `saving-a-reading/02-tags.png` | 1718 × 1234 | `/user/readings/[id]` | A saved reading with two or three tags and the **+** pressed, so the "Add a tag…" box is open. |
| ☐ | `oracle-interpretation/01-button.png` | 1280 × 800 | `/reading` | Right after saving a reading: the **Oracle Interpretation** button under the cards. **Do not press it**: on this page it starts a billed request at once. |
| ☐ | `oracle-interpretation/02-confirm.png` | 1280 × 800 | `/user/readings/[id]` | A saved reading with no interpretation. Press **Oracle Interpretation** and capture the "Ready to consult the Oracle for this reading?" window. **Do not press Consult the Oracle.** Close the window afterwards. |
| ☐ | `oracle-interpretation/03-interpretation.png` | 1280 × 1000 | `/user/readings/[id]` | A reading that already has an interpretation: cards at the top, interpretation text below. Do not generate a new one just for this. |
| ☐ | `finding-readings/01-list.png` | 1280 × 1000 | `/user/readings` | More than 10 readings, so Next/Previous and "Per page" show. Filter panel closed. |
| ☐ | `finding-readings/02-filter-panel.png` | 1280 × 800 | `/user/readings` | Same page with **Filter Readings** open. Optionally pick a spread so the pills show. |
| ☐ | `contacting-support/02-modal.png` | 1280 × 800 | `/user/profile/settings` | Press **Contact support**; capture the empty "Seek Counsel" window. Do not send. |

## How to capture

1. Run the app: `make dev` (see [`key-facts.md`](../../notes/key-facts.md)), and sign in as the dev user ([`dev-users.md`](../database/dev-users.md)).
2. Make some data first. Saving readings is free; only interpretations are billed. You need:
   - more than 10 saved readings (so the list has pages), with a few tags on some
   - one reading that already has an interpretation (use an existing one; do not generate one just for a screenshot)
3. Set the browser window to **1280 pixels wide** (desktop width). Height is up to you; the size in brackets after each file name is a guide. Use a desktop browser, not a phone view.
4. Capture the page **raw**: no circles, arrows or text. The site draws the rings itself.
5. Save as **PNG**, named exactly as in each entry's "Save as" line, under `frontend/public/guide/<chapter>/` (create the chapter folder if it is missing).
6. Reload the chapter page, e.g. `http://localhost:3000/guide/making-a-reading`. The placeholder is replaced by your image.
7. Check each numbered ring sits on the thing named in the legend. If not, adjust that mark in `frontend/src/content/guide/<chapter>.mdx`:
   ```
   { x: 28, y: 20, w: 44, h: 12, label: "Choose Your Reading: pick a spread" }
   ```
   `x` and `y` are the ring's top-left corner, `w` and `h` its size, all as a **percentage of the image** (0 to 100). The ring is an ellipse; add `shape: "rect"` to the mark for a rounded rectangle, which fits wide things like a card or a row of text better. Save the file and reload.
8. The `w` and `h` pixel numbers on the `<Shot>` should match your image. If your height differs a little, nothing breaks, but update them if you can.

**Replacing a PNG you already added:** the site caches resized copies of every image, for a year, keyed by the file name and not the contents. After overwriting a file, the page can keep showing the old picture at some sizes (it depends on window width and browser). In development, stop the dev server, delete `frontend/.next/dev/cache/images`, start it again and hard-reload the browser (Cmd+Shift+R). In production, give the new file a new name (for example `01-profile-v2.png`) and update `src` in the MDX, because browsers and the server both hold the old one.

The rings for the captured shots are placed from the real images; the rest are still guesses made without the images, so expect to adjust them.

Never press a button that sends something real while capturing: interpretation requests are billed, and support messages and deletions are real.


## Your Profile

Page: `/guide/your-profile` (source `frontend/src/content/guide/your-profile.mdx`)

- [x] **`01-profile.png`** (1806 × 1160)
  - Save as: `frontend/public/guide/your-profile/01-profile.png`
  - Page: `/user/profile`
  - Capture: Signed in, with a few saved readings and tags so the Readings Journal panel and the Focused tags are filled. Whole page, both panels.
  - Rings to place:
    1. Your name and email
    2. Remaining Readings: the chalice shows how much interpretation allowance is left
    3. Account settings: contact support, reset your password or delete your account
    4. How many readings you have saved
    5. Your last reading. Select it to open it
    6. Tags you use most. Select one to see those readings
    7. Start a new reading or open all readings

## Making a Reading

Page: `/guide/making-a-reading` (source `frontend/src/content/guide/making-a-reading.mdx`)

- [x] **`01-setup.png`** (2302 × 1664)
  - Save as: `frontend/public/guide/making-a-reading/01-setup.png`
  - Page: `/reading`
  - Capture: Setup screen with **Three Card** selected (this makes the question box appear). Whole page.
  - Rings to place:
    1. Choose Your Reading: pick a spread
    2. Spread Layout: preview the positions
    3. Upright Only or With Reversals
    4. Your question (some spreads)
    5. Begin Your Journey
- [x] **`02-deck.png`** (1618 × 1168)
  - Save as: `frontend/public/guide/making-a-reading/02-deck.png`
  - Page: `/reading`
  - Capture: Press Begin, then capture the 78 face-down cards with the "Select N card(s)" prompt, before choosing any.
  - Rings to place:
    1. How many cards to choose
    2. Select cards one at a time
- [x] **`03-reading.png`** (1566 × 1634)
  - Save as: `frontend/public/guide/making-a-reading/03-reading.png`
  - Page: `/reading`
  - Capture: A finished reading, signed in, so the bookmark (top right) is visible. Add a question on the setup screen first so it shows.
  - Rings to place:
    1. Your question, if you asked one
    2. Your cards, each in its position
    3. Save reading
    4. New Reading starts again

## Saving a Reading

Page: `/guide/saving-a-reading` (source `frontend/src/content/guide/saving-a-reading.mdx`)

- [x] **`01-save-icon.png`** (1342 × 980)
  - Save as: `frontend/public/guide/saving-a-reading/01-save-icon.png`
  - Page: `/reading`
  - Capture: Crop only the top of a finished reading, enough to show the bookmark icon at the top right. Short image.
  - Rings to place:
    1. Save reading
- [x] **`02-tags.png`** (1718 × 1234)
  - Save as: `frontend/public/guide/saving-a-reading/02-tags.png`
  - Page: `/user/readings/[id]`
  - Capture: A saved reading with two or three tags and the **+** pressed, so the "Add a tag…" box is open.
  - Rings to place:
    1. Your existing tags
    2. Type a tag, then confirm with the tick or cancel with the cross

## The Oracle's Interpretation

Page: `/guide/oracle-interpretation` (source `frontend/src/content/guide/oracle-interpretation.mdx`)

- [ ] **`01-button.png`** (1280 × 800)
  - Save as: `frontend/public/guide/oracle-interpretation/01-button.png`
  - Page: `/reading`
  - Capture: Right after saving a reading: the **Oracle Interpretation** button under the cards. **Do not press it**: on this page it starts a billed request at once.
  - Rings to place:
    1. Oracle Interpretation
- [ ] **`02-confirm.png`** (1280 × 800)
  - Save as: `frontend/public/guide/oracle-interpretation/02-confirm.png`
  - Page: `/user/readings/[id]`
  - Capture: A saved reading with no interpretation. Press **Oracle Interpretation** and capture the "Ready to consult the Oracle for this reading?" window. **Do not press Consult the Oracle.** Close the window afterwards.
  - Rings to place:
    1. Confirmation message
    2. Consult the Oracle
- [ ] **`03-interpretation.png`** (1280 × 1000)
  - Save as: `frontend/public/guide/oracle-interpretation/03-interpretation.png`
  - Page: `/user/readings/[id]`
  - Capture: A reading that already has an interpretation: cards at the top, interpretation text below. Do not generate a new one just for this.
  - Rings to place:
    1. Your cards
    2. The Oracle's interpretation

## Finding Your Readings

Page: `/guide/finding-readings` (source `frontend/src/content/guide/finding-readings.mdx`)

- [ ] **`01-list.png`** (1280 × 1000)
  - Save as: `frontend/public/guide/finding-readings/01-list.png`
  - Page: `/user/readings`
  - Capture: More than 10 readings, so Next/Previous and "Per page" show. Filter panel closed.
  - Rings to place:
    1. How many readings you have
    2. Filter Readings opens the filter panel
    3. Newest first or Oldest first
    4. A reading: select it to open it
    5. Previous page, next page
- [ ] **`02-filter-panel.png`** (1280 × 800)
  - Save as: `frontend/public/guide/finding-readings/02-filter-panel.png`
  - Page: `/user/readings`
  - Capture: Same page with **Filter Readings** open. Optionally pick a spread so the pills show.
  - Rings to place:
    1. Spread Type: Any Spread, or pick one
    2. Tags: type to search, select to add
    3. Birth Date, for the Significators spread only
    4. Apply, or Clear to remove all filters

## Contacting Support

Page: `/guide/contacting-support` (source `frontend/src/content/guide/contacting-support.mdx`)

- [ ] **`02-modal.png`** (1280 × 800)
  - Save as: `frontend/public/guide/contacting-support/02-modal.png`
  - Page: `/user/profile/settings`
  - Capture: Press **Contact support**; capture the empty "Seek Counsel" window. Do not send.
  - Rings to place:
    1. Subject: at least 3 characters
    2. Message: at least 10 characters
    3. Send
