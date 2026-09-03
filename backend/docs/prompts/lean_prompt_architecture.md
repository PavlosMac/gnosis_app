# Lean Prompt Architecture

Design for the next prompt architecture: **no card data sent** — an advanced model reads
from its own knowledge of tarot — and **one woven narrative** instead of per-card
interpretations plus a synthesis.

Status: validated as an experiment on 2026-09-01 via `scripts/lean_prompt_test.py`;
sample readings in `docs/prompts/experiments/`. The current production pipeline is
documented in [`prompt_reference.md`](prompt_reference.md); nothing there is replaced
until this design is wired into `src/llm/`.

---

## 1. Principles

The current architecture injects the drawn cards' full meaning lists and correspondences
into the user prompt and forbids the model its own knowledge ("Use only the material
supplied"). That made sense for a small model; with an advanced model it buys little and
costs a lot — the lists are ~85% of input tokens, and the model already knows the deck
in more depth than the catalog carries.

The lean design inverts every one of those choices:

| | Current | Lean |
|---|---|---|
| Card knowledge | Catalog JSON rendered into the user prompt | Model's own (Rider–Waite deck named in the system prompt, plus numerology and astrology) |
| Output shape | One interpretation per card + synthesis (`LLMInterpretationResult`) | One continuous narrative that weaves every card in (`reading: str`) |
| Lens | 4 lenses × 3 injection points | Dropped — and intent followed (§7): interpretations carry no settings at all |
| System prompt | ~1,300 tokens, 10+ composed blocks | ~330 tokens, one template |
| Model | `gpt-5.4-mini` | `gpt-5.4` |
| Word budget | Client `depth` (0–100), near-flat total split across the spread | Server-owned: config `words_per_card` × cards, no client input |

Kept from the current design: orientation guidance (reversal ≠ negation), the position
three-tier fallback (stated meaning → position name → order dealt), the derived
completion-token cap, structured output via `response_format`. Intent was first kept,
then made optional, then removed entirely (§7) — there is no settings axis left.

Observed in testing: without a lens block the model reaches for Thoth/esoteric
attributions on its own (e.g. The Lovers as "the alchemical card"), so the esoteric
register partially re-emerges unprompted. If register control matters, a lens line can
return as one sentence — the experiment's first iteration had one per lens and they
composed cleanly.

---

## 2. Pipeline

One call per interpretation, same port (`LLMPort`), same error mapping:

```
system  = IDENTITY            master Rider–Waite reader, own knowledge + numerology/astrology
        + QUESTION_ANALYSIS   subject, parties, kind of answer sought;
                              open or absent question → more interpretive freedom
        + ORIENTATION         reversal = blocked / delayed / internalized / shadow
        + POSITION            stated meaning → position name → order dealt
        + NARRATIVE           one flowing reading, every card woven in, arc + tensions
        + LENGTH(total_words) ceiling, not a target

user    = "Question: …" | "No question was asked — let the spread itself set the agenda."
        + "Spread: <name> (<n> cards)"
        + one line per card:  "<i>. <Name> (<orientation>) — <Position>: <position_description>"

response_format = LeanReading { reading: str }
```

No catalog lookup, no `CardNotFoundError` path, no per-card rendering. The card line is
built purely from `CardInSpread` as the frontend sends it.

### System prompt (verbatim, from the experiment)

```
You are a master tarot reader working with the Rider–Waite deck, drawing on your own
deep knowledge of the cards — their imagery, traditional meanings and correspondences.
You may also draw on the allied mystical arts of numerology and astrology where they aid
the interpretation.

First determine what the question asks: its subject, the people involved and how each
relates to the querent, and the kind of answer sought. Let that govern every
interpretive choice. The broader or more open the question — or when none is given — the
more freedom you have to let the spread itself set the agenda.

{INTENT}

Honor each card's orientation. A reversal is not simple negation: read it as the card's
energy blocked, delayed, internalized or in shadow — whichever the question and position
make apt.

Read each card through its position. A stated position meaning governs the card's scope;
where only a position name is given, read the name; where neither, read the cards in the
order dealt.

Write the reading as one continuous, flowing narrative — not card-by-card sections. Move
through the spread naturally, letting each card enter the story where it belongs
(usually the order dealt), naming each card explicitly as it arrives. Every card must be
woven in and do real work in the narrative with roughly a paragraph's weight; draw out
the arc across
positions and the reinforcements and tensions between cards, and land on what it all
resolves to for the question.

Write about {total_words} words — treat that as a ceiling, not a target to exceed.
Address the querent directly. Every sentence must earn its place: no textbook
boilerplate, no hedging, no restating the question.
```

INTENT blocks:

- **predictive** — "This is a predictive reading: name likely developments and outcomes.
  Where a card speaks only of a state or quality, say what that condition tends toward
  rather than manufacturing an event."
- **reflective** — "This is a reflective reading: illuminate what is present, held or
  unresolved in the situation. Do not forecast events."

### User prompt (sample)

```
Question: Should I take the job offer in Lisbon?

Spread: Past, Present, Future (3 cards)
1. The Lovers (upright) — Past: What shaped the situation and is now receding.
2. Five of Pentacles (reversed) — Present: The heart of the matter as it stands now.
3. Queen of Cups (upright) — Future: The direction events take if nothing changes.
```

### Significators variant — DRAFT for review

A significator chart is calculated from birth data, not drawn: a portrait of the
querent, not a situational reading. The standard skeleton loses its QUESTION_ANALYSIS
and INTENT blocks and gains a chart framing and a fixed positions block. ORIENTATION
stays — reversed guidance applies to **all** spreads — recast for a portrait: a
reversal is a facet of character turned inward or unrealized, not passing shadow.
Budget counts **distinct** cards (the Life number can repeat a card that also holds
another position) at **1.5× the standard per-card weight** — each card is a whole facet
of character, not one moment in a situation, so it earns more room (150 words per card
at the default 100).

```
You are a master tarot reader working with the Rider–Waite deck, drawing on your own
deep knowledge of the cards — their imagery, traditional meanings and correspondences —
and on the allied mystical arts of numerology and astrology, which matter especially
here.

You are interpreting a personal significator chart: a numerological and astrological
profile calculated from the querent's birth data. This is not a situational reading and
nothing in it is passing energy or advice — each card is a permanent facet of who the
querent is. Explore the full depth of each card's expression as it shapes character.

Honor each card's orientation. In a portrait a reversal is not simple negation: read it
as that facet of character turned inward, blocked or not yet fully lived — an energy
the querent carries in shadow rather than expresses outwardly.

The positions:
- Day number — the card of the day of birth: the outward personality, how the querent
  presents, their most visible traits.
- Life number — derived from the full birth date: the core life path. Where several
  cards share this position they are one numerological energy reducing through them —
  read them as layers of the same theme, each a different dimension.
- Star sign — the Major Arcanum of the sun sign: deepest drives, core identity, the
  archetype embodied.
- Decanate — a Minor Arcanum bridging the birth date to the everyday expression of the
  star sign, grounding the archetypal themes in lived experience.

A card may appear in more than one position. Read each appearance through its own
position — the repetition itself is meaningful: that energy is doubly written into the
chart. Never repeat an interpretation.

Write the portrait as one continuous, flowing narrative — not card-by-card sections.
Move through the chart naturally, naming each card explicitly as it arrives. Every card
must be woven in with roughly a paragraph's weight; draw out how the facets reinforce
and strain against one another, and land on a cohesive picture of the querent's
character and life themes.

Write about {total_words} words — treat that as a ceiling, not a target to exceed.
Address the querent directly. Every sentence must earn its place: no textbook
boilerplate, no hedging.
```

Sample user prompt (no question line — the chart is the subject):

```
Spread: Significators (4 cards)
1. The Sun (upright) — Star sign
2. Ten of Cups (upright) — Day number
3. The Wheel of Fortune (reversed) — Life number
4. Six of Pentacles (upright) — Decanate
```

### Tree of Life variant — DRAFT for review

Situational like the standard reading — QUESTION_ANALYSIS and ORIENTATION stay (the
zones themselves carry the temporal framing: Chokmah the immediate future, Binah the
past, Malkuth six months ahead) — but the POSITION handling is recast for the Tree.
*Amended 2026-09-02*: the zone meanings are **not** baked into the system prompt after
all — the frontend owns its spread catalog and sends each card's zone and meaning as
`position`/`position_description`, like any spread. The template keeps only the
spread-level **three-pillar structure** (Mercy/Severity/Middle temporal currents),
which no single card line can carry. The draft below predates that amendment; the
current template is in `docs/prompts/prompt_reference.md`.

```
You are a master tarot reader working with the Rider–Waite deck, drawing on your own
deep knowledge of the cards — their imagery, traditional meanings and correspondences.
You may also draw on the allied mystical arts of numerology, astrology and the Kabbalah,
which matter especially here.

First determine what the question asks: its subject, the people involved and how each
relates to the querent, and the kind of answer sought. Let that govern every
interpretive choice. The broader or more open the question — or when none is given — the
more freedom you have to let the spread itself set the agenda.

{INTENT}

Honor each card's orientation. A reversal is not simple negation: read it as the card's
energy blocked, delayed, internalized or in shadow — whichever the question and position
make apt.

This spread maps the situation onto the eleven zones of the Tree of Life. Read each card
through its zone's meaning and through its pillar's temporal current:

- The Pillar of Mercy (right — Chokmah, Chesed, Netzach) is masculine and expansive and
  carries future energies and influences: Chokmah the near future, Chesed the future not
  so near.
- The Pillar of Severity (left — Binah, Geburah, Hod) is feminine and constraining and
  carries the past energies still working on the situation.
- The Middle Pillar (Kether, Tiphareth, Yesod, Malkuth) is the present axis: the descent
  from the situation's spiritual root at Kether to its manifest outcome at Malkuth.

The zones:
- Kether (1) — the fruit of the life so far: the karmic situation, the source
  perspective, the nature of the experience that has led the querent here.
- Chokmah (2) — the complexion of current energies: present involvements, male figures,
  the energy current events demand. Immediate future, one to three weeks.
- Binah (3) — material circumstances: physical comforts, responsibilities, burdens and
  tests; energy from and toward women, the mother; the past.
- Chesed (4) — the future over the next one to three months: opportunities, strengths,
  allies, male figures.
- Geburah (5) — the recent past: obstacles, where energy has been wasted, weaknesses,
  rivals and conflict; warnings.
- Tiphareth (6) — the present situation: the current state of energy and constitution,
  pressing needs and concerns, children, present achievements. Centred in the Tree, it
  reflects neither future nor past — a coming together of extremes.
- Netzach (7) — emotion: creativity, the domestic situation, emotional needs.
- Hod (8) — the external world and the mental life: thinking processes, daily
  goings-on, friends, siblings, informal meetings and contacts.
- Yesod (9) — the subconscious temperament: the dominant psychic complex, what is
  hidden — secret desires, fears, worries, self-image.
- Malkuth (10) — the seed of the next life period, six months ahead: where the querent
  may sabotage themselves, and the homework the coming period sets.
- Daath (11) — the viewpoint of the Higher Intelligence: messages from the Source and
  the Guides; relationships and the partner's life; desires, objectives, future
  expectations, legalities.

A position meaning stated in the spread refines its zone's scope and governs where
given.

Write the reading as one continuous, flowing narrative — not card-by-card sections. Move
through the Tree naturally — down the lightning flash, or pillar by pillar as the
question demands — naming each card explicitly as it arrives. Every card must be woven
in and do real work in the narrative with roughly a paragraph's weight; draw out the
currents between the pillars, the reinforcements and tensions between cards, and land on
what the whole Tree resolves to for the question.

Write about {total_words} words — treat that as a ceiling, not a target to exceed.
Address the querent directly. Every sentence must earn its place: no textbook
boilerplate, no hedging, no restating the question.
```

Sample user prompt — the frontend sends only the zone names; the meanings live in the
system prompt:

```
Question: How do I rebuild my life after the divorce?

Spread: Tree of Life (11 cards)
1. The Star (upright) — Kether
2. Knight of Wands (upright) — Chokmah
3. The Empress (reversed) — Binah
...
10. Nine of Pentacles (upright) — Malkuth
11. Justice (upright) — Daath
```

Selection: like Significators today, the variant is keyed off `spread_name` — the
literal `"Tree of Life"` joins `"Significators"` as the only two names the backend
special-cases.

---

## 3. Budget

The budget is **server-owned** — reading length is a product decision and, with
per-user $ budgets, the dominant cost lever, so no client input sets it. The old client
`depth` setting is dropped from the API (`InterpretationSettings` collapses to
`intent`). One config value sets the paragraph weight; the total scales linearly with
the spread:

```
words_per_card = settings.llm_words_per_card                  # config, default 100
total_words    = round(words_per_card · cards)
cap            = ceil(total_words · 1.6) + 40 + REASONING_HEADROOM[effort]
```

Significators: `cards` is the **distinct** card count, and `words_per_card` is scaled
by `settings.significator_budget_scale` (default 1.5) — a portrait card carries a whole
facet of character and earns more room than one moment in a situation.

The budget is stated once, as a ceiling ("not a target to exceed") — phrased that way
the model lands within ±3% of it; phrased as "roughly N words" it overshot by ~20%.

---

## 4. Measured cost (gpt-5.4, medium effort, 2026-09)

| | 3-card, depth 60 | 10-card Celtic Cross, depth 70 |
|---|---|---|
| Budget / actual words | 330 / 321 | 1,200 / 1,237 |
| Input tokens | 480 | 645 |
| Input, current architecture (est.) | 2,526 | 4,105 |
| Output tokens (of which reasoning) | 723 (329) | 3,403 (1,905) |
| Cost @ $2.50 / $15.00 per 1M | **$0.012** | **$0.053** |

≈ 0.4–0.5¢ per card. Cost is output-dominated (~95%), so the levers are model price,
depth, and reasoning effort — the lean input saves only ~0.5–1¢ per reading versus the
current architecture on the same model. `gpt-5.4-mini` ($0.75/$4.50) would run the same
readings at ~3.3× less; whether the advanced model earns its price is a content
judgment, not a token one. Note the reasoning spend grows with spread size (329 → 1,905
tokens here) — large spreads at `high` effort would eat further into the margin.

---

## 5. Productionizing — what it touches

| Concern | Change |
|---|---|
| `src/llm/prompt_components.py` + `prompt_builder.py` | Superseded by one small builder (system template + card lines + budget) |
| `src/llm/schemas.py` | `LLMInterpretationResult` → single `reading` field; `InterpretationResponse` and the interpretations API/domain lose `card_interpretations[]`; `InterpretationSettings` deleted outright (depth, lens, and finally intent — §7): requests carry no settings — **frontend-visible** |
| `InterpretationSettings.lens` | Unused — drop from the API, or keep and reintroduce as a one-line register block |
| `card_catalog` / `src/lib/cards/*.json` | Out of the interpretation path (no `CardNotFoundError`); still serves the `/cards` write-ups |
| `OPENAI_MODEL` | **Decided: `gpt-5.4`** — the reading quality depends on the model thinking well; ~3.3× mini's output price, bounded by the word-budget ceiling |
| Usage tracking / budget cap | Full design below (§5a) — exact actuals charged in the inbound call: per-interpretation usage ledger + per-user aggregate gated against a $3 default budget |
| Significators / Tree of Life | Spread-keyed system-prompt variants — drafts in §2 (portrait chart; eleven-zone Tree) |
| Tunables → `Settings` | Every set variable lives in `src/core/config.py` (pydantic-settings, `.env`-overridable), not as module constants: `llm_words_per_card` (100), `significator_budget_scale` (1.5), the model price table ($/1M in/out per model), the default per-user $ budget, the production controls `openai_timeout_seconds` (120), `openai_max_concurrent` (10) and `openai_max_retries` (2), plus the existing `openai_model` / `openai_reasoning_effort` / `openai_max_tokens`. Prompt *text* stays in code; numbers go to config |
| `birth_date`, `observer` | Still accepted / defined, still never rendered — decide or delete |
| Tests / docs | Prompt-phrase assertions in `tests/llm/test_prompt_builder.py` and the generated regions of `prompt_reference.md` (`make prompt-doc`) rebuild around the new builder |

## 5a. Usage accounting & budget enforcement

The user is charged **exact actuals, directly in the inbound call**: no estimates, no
cost-profile collection. Two records, each with one job:

1. **The ledger — per-interpretation usage** (audit trail). Stored on the
   interpretation document when the OpenAI call returns:

   ```
   usage: {
     prompt_tokens, completion_tokens, reasoning_tokens,
     model,                       # the resolved model id from the response
     cost_usd,                    # prompt·in_price + completion·out_price, priced at call time
   }
   ```

   Cost is computed from the actual usage split and the config price table
   ($/1M in/out per model) at the moment of the call — never re-derived later, so a
   price-table change doesn't rewrite history. This is the answer to "why did my
   balance drop": every charge on the user traces to one interpretation document.

   The stored `model` is the *resolved* id from the response (e.g. `gpt-5.4-2026-…`),
   so the pricing function matches table keys by prefix; an id matching no key is
   priced at the most expensive table entry with a warning logged — a price-table gap
   must never fail the reading.

2. **The aggregate — per-user spend** (enforced). A `usage` sub-document on the user,
   updated atomically (`$inc`) in the same inbound call, right after the OpenAI
   response:

   ```
   usage: { prompt_tokens, completion_tokens, cost_usd, readings, updated_at }
   ```

   The cap: `Settings.user_budget_usd` (default **3.00**), with an optional per-user
   `budget_usd` override field for later plans/top-ups. At current measured costs $3 is
   ~55 Celtic Crosses or ~250 three-card readings.

**The flow** (in the interpretation command handler / service):

```
1. reserve — worst-case cost for this request (completion cap × out price + prompt
   estimate × in price), $inc'd onto the user aggregate via find_one_and_update
   with filter usage.cost_usd < budget; no match → BudgetExceededError (402)
2. call OpenAI → usage split from the response
3. cost_usd = priced from config table
4. settle — $inc the aggregate by (actual − reserved); persist ledger on the
   interpretation doc
5. on any failure after the reserve — $inc by (−reserved): the user is never
   charged for a reading they didn't receive
6. response carries usage + remaining budget (frontend §6.4)
```

The gate is atomic — check and reserve are one filtered `find_one_and_update`, so
concurrent requests cannot stack overshoot: the cap can be exceeded by at most one
reservation. (A plain threshold check was considered and dropped: it is check-then-act,
so N in-flight requests would all pass it and a scripted user could overshoot the cap
by one reading *per parallel request*.)

Failed calls — timeout, truncation, content filter, unparseable response — release the
reservation. The tokens the provider billed for are absorbed, not charged to the user
(~5¢ worst case per failure at current costs); log the wasted usage wherever the
response is available so the leak stays visible.

Per-spread-type cost-profile documents were considered and dropped for simplicity — if
the frontend later wants "this reading costs about N", derive it on demand from the cap
formula × price table rather than maintaining a collection.

Migrations: user `usage` sub-document + `budget_usd` field. New tunables in
`Settings`: `user_budget_usd` (3.00) joining the price table from the Tunables row
above.

TDD entry points: budget-gate unit tests (allow under, refuse at/over, override beats
default), ledger/aggregate persistence tests at handler level, pricing math from the
config table, and a router test asserting the 402 shape.

## 6. Frontend changes required

The API contract changes in five places; everything else the frontend sends
(`spread_name`, `question`, `cards[]` with `position` / `position_description`,
`orientation`) is unchanged.

1. **Reading page renders one narrative.** The interpretation response loses
   `card_interpretations[]` + `synthesis` and becomes a single `reading` string. The
   per-card accordion/section layout goes; render the narrative as flowing prose
   (paragraph breaks preserved). Per-card UI is still possible: every card is named
   explicitly in the text, so the card names can be matched to highlight, link to the
   card's write-up page, or sync a card image as its paragraph scrolls into view.
2. **Lens picker.** The `lens` setting is no longer used by the prompt. Either remove
   the lens control from the reading settings UI, or keep it hidden/disabled until the
   open question below (lens as a one-line register) is settled. Sending it stays
   harmless while the field remains in the API.
3. **Depth setting removed.** The word budget is server-owned: the depth slider and any
   `estimatedWordsPerCard`-style mirror of the budget formula go away, and `depth` is no
   longer sent. If the UI wants to show an expected reading length, the backend should
   supply it (e.g. a `word_budget` field on the reading or interpretation response)
   rather than the frontend duplicating config values.
4. **Budget states.** With per-user spend tracking comes a new failure mode: the
   interpretation request can be refused when the user's $ budget is exhausted. The
   frontend needs to render that error distinctly (not as a generic failure), and
   ideally show remaining budget / usage — which implies a small usage endpoint or a
   `usage` field on the interpretation response worth including in the backend work.
5. **One-step, intent-free flow** (§7 amendment, superseding the brief
   optional-intent phase). No intent picker, no settings sent at all. Generation is a
   single `POST /readings/{id}/interpretation` (no body) that persists immediately and
   is idempotent — a repeat call returns the stored interpretation free. The preview →
   save round-trip is gone (no `PUT`), and `GET /readings/{id}` carries a singular
   `interpretation: {...} | null` instead of the `interpretations` array.

Card names remain RWS as the frontend already sends them (`Five of Pentacles`,
`The World`, `Page of …`); they now reach the model verbatim, so display names and
prompt names are finally identical — no Thoth alias mismatch to guard against.

## 7. Decided

- **Model**: `gpt-5.4` — quality over the mini price point.
- **Deck**: Rider–Waite, with numerology and astrology as allied arts. Client card names
  are sent verbatim (no Thoth aliasing in the prompt path).
- **Open questions get freedom**: the broader the question (or none), the more the
  spread sets the agenda — stated in the QUESTION_ANALYSIS block. `position_description`
  stays a first-class input either way.
- **Cards named in the narrative**: the prompt requires each card named explicitly as it
  enters, which the test readings honored — this also gives the frontend text anchors
  for per-card UI if wanted.
- **Set variables live in the settings file**: the per-card budget, the significator
  scale, the price table and the per-user budget default are `Settings` fields, tunable
  via `.env` without a deploy — see the Tunables row in §5.
- **Word budget is server-owned**: client `depth` is dropped from the API. With per-user
  $ budgets the reading length is the dominant cost lever, so the server holds it —
  `llm_words_per_card` (default 100) × cards, ×1.5 for significator charts.
- **Reversed guidance in every spread**: the ORIENTATION block appears in all variants,
  significator charts included (recast there as a facet of character turned inward) —
  no spread assumes all-upright cards.
- **Budget enforcement**: $3 default per-user cap (`Settings.user_budget_usd`).
  Exact actuals charged directly in the inbound call via an atomic reserve-then-settle
  gate; failed calls release the reservation — the user is never charged for a reading
  they didn't receive — the two-record design in §5a.
- **Intent removed entirely; one-step idempotent generation** (amended 2026-09-02,
  twice: this decision first read "intent kept unchanged", was briefly "optional and
  client-decided" — `docs/make-intent-optional-and-client-decided.md`, now superseded
  — and landed on full removal the same day). Spread positions already carry whatever
  temporal framing a reading needs; a predictive/reflective toggle was redundant at
  best and contradictory at worst, and with depth and lens already gone it was the
  last remaining setting. So: `ReadingIntent`, `InterpretationSettings`, and every
  `settings` field are deleted from the API, the prompt, and storage. With no
  settings left there is nothing to preview or re-request either, so the two-step
  preview→save flow collapsed into one idempotent `POST /readings/{id}/interpretation`
  that persists immediately — one interpretation per reading (unique `reading_id`
  index, migration 008), a repeat call returns the stored one free.

## 8. Open questions

- **Lens**: gone, or back as one sentence? The model's default register leans esoteric
  on its own. Decides the fate of the frontend lens picker (§6.2).
