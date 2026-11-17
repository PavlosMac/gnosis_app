# Spread card meanings (click a card in a spread to read its stored meaning)

> **Status: Parts 1–2 done (2026-11-17); parts 3–4 (frontend) not started.** All 78 texts are
> generated and served by the public endpoint. Texts are to be edited after the full build.

## Context

The profile's card of the day opens a dialog with a pre-generated meaning (22 major arcana,
generated once from OpenAI, committed as JSON, seeded into Mongo at startup — see
`major_arcana_meanings` in [`model-references.md`](../reference/database/model-references.md)).
We want the same for cards in a spread: on the reading page and on a saved reading, clicking a
card opens a dialog with a stored general meaning for that card, for all 78 cards.

## Decisions (2026-11-11 to 2026-11-17)

- **One free text per card** (`meaning`): plain prose in two or three short paragraphs, no
  markdown. The same text shows whether the card fell upright or reversed; each text carries
  the card's shadow side.
- **Prompt only**: the call sends the prompt and `Card: <name>.`; no Tsarion source data and
  no Tsarion mention (the model knows little of his per-card readings).
- The endpoint is **public** (visitors can draw spreads; the text is the same for everyone).
- Clickable on the **live reading page and saved reading page**.
- **Significators cards are not clickable** (drawn spreads only).
- Day-card collection, endpoint and text stay untouched (different voice, different fields).

## Prompt

Tested on 16 cards across majors, pips and courts; `gpt-5.4-2026-03-05`, medium effort;
148–201 words each. The recurring "Its shadow lies in…" lead-in is accepted.

```
Sum up the meaning of this tarot card, using knowledge from the Rider Waite system. Do not mention Rider Waite, or any other deck, system or source, in the text. Include the card's difficult or shadow side as well as its positive side. Write it as one flowing piece of prose in two or three short paragraphs, with no subheadings or labels such as 'Upright' or 'Reversed'. Vary how the text opens; do not start with the phrase 'speaks of'. Keep the content short, max 300 words.
```

User message: `Card: <name>.`

## Work in four parts — implement, test, commit each before the next

### Part 1 — Generator script and seeded JSON (backend, offline)

New `backend/scripts/spread_card_meanings.py`, modelled on `scripts/major_arcana_meanings.py`
(same CLI: `--cards`, `--force`, `--model`, `--effort`, `--dry-run`; per-card write,
resume-by-skip, markdown mirror under `scripts/output/spread_card_meanings/`). Unlike the
day-card script it does not upsert into Mongo: the loader of part 2 does that at startup and
with `make card-meanings-load`.

- Plain `client.chat.completions.create` (no structured output): system = the prompt above,
  user = `Card: <name>.`. `WORD_CAP = 300`, used for `max_completion_tokens(WORD_CAP, effort)`
  and for the over-length warning; it must stay equal to the prompt's "max 300 words".
- Raise on empty content or `finish_reason != "stop"`. Warn (do not fail) if the text contains
  "rider"/"waite" or markdown markers (`**`, `#`).
- Card list: the 78 frontend names and deck indices built in the script (22 majors 0..21, then
  Pentacles 22, Wands 36, Cups 50, Swords 64; each suit Ace..Ten, Page, Knight, Queen, King),
  matching `frontend/src/lib/cards.ts` `TAROT_DECK`. No Tsarion source files are read.
- Reuse from the existing script: `slug`, `select_cards`, `merge_entry`, `read_entries`,
  `host_mongo_uri`, `FRONTEND_NAMES` (import them; move to a small shared module only if that
  is awkward).
- Output: `src/lib/cards/spread_card_meanings.json`, shape
  `{"_meta": {...}, "cards": [{number, name, slug, meaning, word_count, model, effort, generated_at}]}`.
- **Seed the JSON with the 16 approved texts in the appendix, verbatim** (not regenerated — a
  rerun would word them differently). `model` = `gpt-5.4-2026-03-05`, `effort` = `medium`,
  `generated_at` = the run date given in the appendix. The Fool..The Hermit are NOT seeded:
  they were tested with an earlier prompt.
- Tests `tests/scripts/test_spread_card_meanings.py`: the 78 names/indices (spot-check suit
  starts and court order against the frontend deck), `select_cards`, `user_message`,
  `to_entry` word count, the warning checks.
- Then stop. The remaining 62 cards are generated only on explicit go-ahead; the script skips
  the 16 already in the file.

### Part 2 — Storage, loader, endpoint (backend)

- `src/database/collections/constants.py`: `SPREAD_CARD_MEANINGS_COLLECTION = "spread_card_meanings"`.
- Migration `017_spread_card_meanings.py`: unique index on `number` (index only, like 016).
- `src/cards/loader.py`: parameterise instead of duplicating — a small frozen spec
  (`path`, `collection`, `card_count`, `required_text_fields`) with two instances (day: 22,
  `name/upright/shadow`; spread: 78, `name/meaning`). `read_meanings`, `upsert_meaning`,
  `load_meanings` take the spec; `lifespan` and `make card-meanings-load` load both. Fewer
  than 78 entries is a warning, as fewer than 22 is today.
- `src/cards/schemas.py`: `SpreadCardMeaningResponse(number, name, meaning)`.
- `src/cards/repository.py`: `SpreadCardMeaningReadRepository.find_by_number`.
- `src/cards/queries/get_spread_card_meaning_by_number.py`: query + handler, `NotFoundError`
  when absent.
- `src/cards/router.py`: `GET /cards/spread/{number}` with `Path(ge=0, le=77)`, **no auth
  dependency**.
- `src/main.py`: register the query, seed both files in `lifespan`.
- Tests: extend `tests/cards/test_loader.py`, `test_router.py` (200, 404, out of range, works
  without a session), `test_startup_seed.py`; new migration test.

### Part 3 — Dialog and action (frontend)

- Move the reusable pieces of `src/app/user/profile/CardMeaningModal.tsx` to
  `src/components/CardMeaningDialog.tsx`: the view (card + body + loading/error) and a
  cache-backed loader, parameterised by fetcher and by the paragraphs to show. The profile
  modal becomes a thin wrapper passing the day-card fetcher, its two paragraphs and its
  subtitle.
- Rendering: `meaning` is plain prose; split on blank lines into `<p>` elements, rendered as
  text. No markdown renderer.
- New server action `getSpreadCardMeaning(index)` in `src/app/reading/actions.ts`:
  Zod-validate 0..77, `publicFetch` to `/api/v1/cards/spread/{index}`, 404 →
  "This card's meaning has not been written yet.". No `getCurrentUser()` — public endpoint.
- `SpreadCardMeaningModal({ card, reversed, position, positionDescription, onClose })`:
  resolves the deck index with `findCardByNameSafe(card.name)` (**never `card.idx`** — the draw
  flow (`ShuffledDeck.tsx`) and `SpreadCards.tsx` overwrite it). Title = card name
  (+ " (Reversed)"), subtitle = position · description, small card shown in its orientation.
  Uses `SanctumModal`.
- Type `SpreadCardMeaningResponse` in `src/types/`.
- Tests mirroring `CardMeaningModal.test.tsx` and `getMajorArcanaMeaning.test.ts`
  (`renderToStaticMarkup`; no DOM env).

### Part 4 — Make spread cards clickable (frontend)

- `src/components/TarotCard.tsx`: optional `onSelect`; when set, render inside a
  `<button type="button" aria-haspopup="dialog" aria-label="About {name}">` as
  `TallyCardView` does. No prop → unchanged `div`.
- Thread an optional `onCardSelect(card, position)` through `Reading.tsx` (default row),
  `KabbalahLayout.tsx`, `RelationshipLayout.tsx`, and `SpreadCards.tsx`. Not
  `SignificatorsLayout` / `SignificatorGroups`.
- Owners of the open-card state: `TarotGame.tsx` (reading phase only, draw and manual modes)
  and the saved-reading client component (`InterpretationSection.tsx`, which renders
  `SpreadCards` before and after the interpretation). `InterpretationModal`'s `SpreadCards`
  stays non-clickable (no dialog over a dialog).
- Extend `Reading.layout.test.tsx` / `SpreadCards.layout.test.tsx`: cards render as buttons
  when a handler is passed, Significators do not.

## Docs (same commits as the code they describe)

- `docs/reference/database/model-references.md`: new `spread_card_meanings` section + index row.
- `backend/CLAUDE.md`: `card-meanings-load` line now covers both files.
- `docs/notes/issues.md`: dated line per part.
- `docs/notes/decisions.md`: short ADR — public endpoint, one free text per card from the
  prompt alone, separate collection from the day card.
- When the last part ships: delete this plan and its line in `docs/README.md`.

## Verification

- `make -C backend test lint typecheck`, `npm --prefix frontend run test` and `lint` per part.
- Part 1: `--dry-run` on one major, one pip, one court to read the messages; confirm the 16
  seeded entries load and are skipped by a dry run. No billed call in this part.
- Parts 2–4 live (`make dev`): `curl localhost:8001/api/v1/cards/spread/11` (Justice) without
  a cookie; logged out on `/reading`, draw Past/Present/Future with reversals, click an upright
  and a reversed card; click a card with no stored text yet (404 copy); Tree of Life and
  Relationship cards open the right card (name lookup); Significators cards do not open; saved
  reading page before and after an interpretation; phone width and Safari.
- The 62 remaining cards are generated only after explicit go-ahead.

## Appendix — the 16 approved texts (seed for `spread_card_meanings.json`)

Verbatim model output from the test runs with the final prompt. Paragraphs are separated by a
blank line. `number` is the frontend deck index.

### 10 · Wheel of Fortune (2026-11-16)

The Wheel of Fortune turns when life is shifting, sometimes suddenly, reminding you that nothing stays fixed for long. It points to change, movement, and the strange timing of fate: the sense that events are unfolding in a larger pattern, even if you cannot yet see the whole design. At its brightest, this card brings opportunity, momentum, and a welcome turn in circumstances. It can mark luck, breakthroughs, and the feeling of being carried forward by forces that are finally working in your favor.

Its shadow lies in the instability that comes with change. The wheel rises, but it also falls, and this card can reflect uncertainty, loss of control, or the frustration of being tossed around by events, habits, or cycles that keep repeating. It warns against gambling everything on luck alone or clinging too tightly when life is clearly moving. The deeper lesson is to meet change with awareness: to recognize patterns, adapt when the tide turns, and trust that difficult phases are also temporary.

### 11 · Justice (2026-11-16)

Justice centers on truth, balance, and the clear understanding that actions have consequences. It points to a time for honesty with yourself and others, for weighing facts carefully, and for making choices that reflect integrity rather than impulse. This card often suggests fairness, accountability, and the possibility of a right outcome, especially when you are willing to act with clarity, restraint, and respect for what is truly deserved.

Its more difficult side appears when judgment becomes cold, rigid, or overly severe. Justice can show up as criticism, imbalance, denial of responsibility, or the discomfort of facing results you would rather avoid. It may also warn against self-righteousness, legal or ethical complications, or trying to force life into neat equations when human emotions are involved. At its best, though, it restores order by asking for courage: tell the truth, own your part, and trust that real balance comes not from avoiding consequences, but from meeting them cleanly and consciously.

### 12 · The Hanged Man (2026-11-16)

The Hanged Man points to a pause that is not pointless, but deeply meaningful. It is the card of surrender, suspension, and seeing life from a different angle. Instead of forcing movement, it asks for trust in stillness: a willing release of control, old assumptions, or the need to have immediate answers. In that quiet in-between space, insight can emerge, and what once seemed blocked may reveal a hidden purpose.

At its best, this card brings acceptance, patience, spiritual perspective, and the wisdom to let go of struggle. It can mark a conscious sacrifice made for growth, healing, or a greater good. Its more difficult side appears when surrender slips into stagnation, martyrdom, avoidance, or passivity. You may feel stuck, delayed, or powerless, especially if you are resisting a necessary change of viewpoint. The lesson here is to discern the difference between fruitful waiting and simply remaining suspended out of fear.

### 13 · Death (2026-11-16)

Death marks an ending that clears the ground for something truer to begin. It is the card of deep transition: old roles, habits, relationships, beliefs, or ways of living may be falling away, not as punishment, but because they have reached their natural limit. However sudden or solemn this process feels, it carries the promise of renewal. What is stripped back now can make room for honesty, liberation, and a new chapter with more life in it.

Its difficult side lies in the fear, grief, and resistance that change can bring. Clinging to what is already over can make this passage harsher, prolonging pain or creating a sense of stagnation and loss. Death can point to an identity crisis, a forced goodbye, or the uncomfortable truth that transformation cannot be avoided. Yet its deeper lesson is that release is part of growth: when you allow what is finished to end, you create the conditions for healing, rebirth, and a future that could not arrive otherwise.

### 14 · Temperance (2026-11-16)

Temperance is the art of finding the right measure. It points to balance, patience, and the quiet power of blending opposites into something harmonious: feeling with reason, action with rest, desire with restraint. This card often suggests healing, steady adjustment, and a calm, centered approach that lets life unfold at a sustainable pace. Rather than dramatic leaps, it favors gentle refinement, cooperation, and trusting that small corrections can create lasting peace.

Its shadow appears when moderation is lost or becomes strained. You may be dealing with excess, extremes, impatience, or a sense that things are slightly “off” because too much is being forced too quickly. It can also show up as overcompromising, watering yourself down, or trying so hard to keep the peace that your real needs are neglected. The deeper lesson is to restore flow: neither rigid control nor chaos, but a living balance that honors both self-discipline and grace.

### 15 · The Devil (2026-11-16)

The Devil points to entanglement: the ways fear, desire, habit, or shame can quietly take control and make a person feel trapped. It often appears when something has too much power—an attachment, obsession, unhealthy relationship, material craving, or a story about oneself that keeps repeating. Its shadow lies in bondage that may be partly self-made: giving authority to what diminishes you, mistaking intensity for love, or staying chained to patterns that drain freedom, dignity, and clear judgment.

Yet this card is not only about darkness; it is also about raw life force. Desire, ambition, sexuality, and instinct are not enemies in themselves—they become destructive only when left unconscious. The deeper gift of The Devil is radical honesty: seeing exactly what has a hold on you and reclaiming your power from it. When faced directly, this energy can become fierce vitality, magnetic presence, humor about one’s own flaws, and the courage to break old chains. It reminds you that what binds you can also be understood, confronted, and ultimately released.

### 16 · The Tower (2026-11-17)

The Tower marks a sudden break in what seemed solid: a shock, revelation, upheaval, or collapse that strips away illusion. It can arrive as an external event or an inner reckoning, but its deeper purpose is to clear what is false, rigid, or no longer alive. However dramatic it feels, this card carries the force of truth, liberation, and necessary change. What falls away may be painful, yet it makes room for honesty, humility, and a more authentic foundation.

Its harder edge is chaos, fear, loss of control, and the sense that life has been split open without warning. Pride can be shattered here; plans fail, defenses crumble, and old certainties may not survive. Resisting the process often increases the turmoil, while denial can prolong the damage. The Tower can point to crisis, conflict, or a wake-up call that cannot be ignored.

Yet within the ruin is renewal. Once the false structure comes down, there is a chance to rebuild with greater clarity, freedom, and strength. This card asks for courage in the face of disruption and trust that what is real will endure. The lesson is not comfort, but transformation: sometimes what feels like disaster is the beginning of release.

### 17 · The Star (2026-11-17)

Opens "After upheaval…", which assumes the Tower came before it; candidate for regeneration.

After upheaval, The Star brings a feeling of calm, openness, and renewed trust in life. It points to healing, hope, and the quiet return of faith in yourself and in what lies ahead. There is a sense of being washed clean emotionally, of finding clarity after confusion, and of reconnecting with what is true, simple, and life-giving. This card encourages honesty, gentleness, and the courage to remain open-hearted, even after disappointment. It often suggests inspiration, spiritual renewal, and the sense that guidance is available if you are willing to be still enough to receive it.

Its shadow side appears when hope becomes passivity or when ideals drift too far from reality. You may long for healing but avoid the practical steps it requires, or place your trust in a distant future while neglecting the present. The Star can also reflect vulnerability, exposure, or the fear that your faith will be broken again. At its best, it is a reminder that real renewal is not naive optimism, but the quiet strength to keep going with sincerity, patience, and trust.

### 18 · The Moon (2026-11-17)

The Moon points to a landscape of uncertainty, where instinct becomes more reliable than logic and not everything is what it first appears to be. It often appears when emotions, dreams, and subtle undercurrents are rising, asking you to listen closely to intuition, symbols, and the quiet knowledge that lives below the surface. There can be deep imagination here, heightened sensitivity, creative vision, and a powerful connection to the unseen parts of yourself.

Its shadow lies in confusion, mixed signals, and the tendency to project fears into the dark. Anxiety, illusion, self-deception, or hidden truths may make the path feel slippery, as if you are moving forward without full clarity. This card can reflect situations where something is being concealed, either by others or by your own reluctance to face what you already sense. The lesson is not to force certainty too soon, but to move carefully, trust your inner compass, and let what is obscured reveal itself in time.

### 50 · Ace of Cups (2026-11-17)

The Ace of Cups carries the feeling of a heart opening. It points to fresh emotional beginnings, love, compassion, healing, and the quiet sense that something within you is ready to overflow. This can be a new relationship, a deepening bond, creative inspiration, spiritual renewal, or simply a return to trust in your own feelings. It often appears when tenderness, intuition, and genuine connection want to lead the way.

Its shadow lies in emotional excess or confusion. Feelings may spill over so strongly that they blur judgment, create dependency, or leave you overwhelmed by longing, fantasy, or vulnerability. What begins as openness can turn into idealizing others, ignoring practical limits, or giving too much without protection. This card invites you to receive fully, but also to let emotion move through clear channels, so that the love, insight, or healing arriving now can nourish you instead of flooding you.

### 38 · Three of Wands (2026-11-17)

The Three of Wands carries the feeling of standing at a threshold, looking out toward wider horizons and sensing that your efforts are beginning to open real possibilities. It points to expansion, foresight, and the confidence to move beyond what is familiar. This card often suggests that plans are taking shape, opportunities are emerging, and you are in a strong position to think long-term rather than settle for immediate results. There is momentum here, but it is guided by vision: knowing what you want, preparing well, and trusting yourself enough to reach farther.

Its more difficult side appears when anticipation turns into restlessness, or when ambition stretches beyond what is practical. You may be waiting for results that are slow to arrive, overestimating how ready the path really is, or focusing so much on the future that you lose contact with the work still needed in the present. It can also hint at frustration when progress depends on other people or outside conditions. At its best, this card encourages bold growth paired with patience; at its worst, it warns against assuming that promise alone is the same as completion.

### 26 · Five of Pentacles (2026-11-17)

The Five of Pentacles points to a season of lack, whether that shows up as financial strain, poor health, loneliness, or the painful feeling of being shut out in the cold while comfort seems to belong to everyone else. Its shadow is discouragement: believing you have been abandoned, focusing so fully on what is missing that hope narrows, and carrying hardship in silence until it becomes heavier than it needs to be.

Yet this card also holds a quieter strength. It reminds you that difficulty is real, but not always permanent, and that help, shelter, or kindness may be closer than you think if you are willing to reach for it. There is humility here, and endurance, and a chance to discover what truly sustains you when appearances, pride, or certainty fall away.

At its best, this card asks for compassion: toward yourself, toward others who are struggling, and toward the vulnerable parts of life that cannot be controlled. It can mark a hard passage, but also the first moment of recovery, when you stop facing loss alone and begin to rebuild from what still remains.

### 73 · Ten of Swords (2026-11-17)

The Ten of Swords marks a painful ending, the moment when something has run its course and can no longer be saved by effort, denial, or willpower alone. It can point to betrayal, harsh truths, exhaustion, defeat, or the feeling of being brought completely to the ground. In its darkest expression, it shows mental anguish, catastrophic thinking, and the sense that too much damage has been done. This card often arrives when a chapter closes in a way that feels final, humbling, or deeply uncomfortable.

Yet within that finality is its strange gift: what is over is truly over, and with that comes release. The worst may already have happened, leaving no need to keep bracing for the blow. It can signal surrender, clarity, and the chance to stop carrying what has become unbearable. There is a bleak honesty here, but also the first opening toward recovery, acceptance, and a new dawn after collapse. When this card appears, it asks for realism, rest, and the courage to let an old story end so life can begin again on truer ground.

### 46 · Page of Wands (2026-11-17)

A spark has just caught. The Page of Wands carries the restless, bright energy of new ideas, fresh enthusiasm, and the urge to explore something simply because it feels alive and promising. This card often points to curiosity, bold self-expression, creative beginnings, good news, or the first stirrings of a path that asks for courage rather than certainty. It is the spirit that says yes to adventure, learns by doing, and trusts inspiration enough to take the first step.

Its challenge lies in how easily that fire can flare up without direction. The same energy that makes this card exciting can also make it impulsive, impatient, naive, or easily distracted by the next interesting thing. Plans may be started with passion and then abandoned when effort, discipline, or follow-through are required. At times it can show overconfidence, dramatics, or a desire for freedom that resists responsibility. At its best, though, the Page of Wands reminds you that every larger journey begins with a willing heart, a little nerve, and the openness to let in something new.

### 76 · Queen of Swords (2026-11-17)

The Queen of Swords carries the energy of clear judgment, sharp perception, and emotional maturity earned through experience. She sees through confusion quickly and values truth over comfort, cutting away what is false, vague, or manipulative. This card often points to independence, honesty, strong boundaries, and the ability to make wise decisions without being ruled by passing feelings. There is intelligence here, but also dignity: a person who has known difficulty and learned how to remain lucid, fair, and self-possessed.

Her shadow side appears when clarity hardens into coldness. The same discernment that protects can become overly critical, suspicious, or unforgiving. She may withdraw into the mind, keeping others at a distance or using truth like a weapon rather than a guide. When this card appears, it can ask for directness and courage, but also remind you that wisdom is strongest when it leaves room for humanity. The lesson is not to abandon feeling, but to let feeling and reason stand together without sentiment clouding what must be seen clearly.

### 35 · King of Pentacles (2026-11-17)

The King of Pentacles embodies steady success, practical wisdom, and the kind of authority that is earned through patience, discipline, and real-world experience. He points to someone who builds slowly and well: a provider, protector, or leader who values security, loyalty, and tangible results. This card suggests abundance that is meant to last, not a fleeting stroke of luck, and it often reflects confidence grounded in competence. It can mark a time to trust proven methods, tend carefully to resources, and take pride in what has been built.

At his best, he is generous, dependable, and deeply reassuring, showing how material comfort can support a full and meaningful life. Yet his shadow side appears when stability hardens into control, possessiveness, or stubborn attachment to status and wealth. He can become overly cautious, resistant to change, or so focused on ownership and appearances that warmth and flexibility are lost. The deeper lesson here is to master the material world without being ruled by it: to enjoy prosperity, but remain grounded, open-hearted, and wise in how power is used.
