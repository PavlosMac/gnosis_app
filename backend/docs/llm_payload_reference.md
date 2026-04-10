# LLM Payload Reference

Quick reference for everything sent to and received from OpenAI.

---

## Request Input (`InterpretationRequest`)

| Field | Type | Constraints |
|---|---|---|
| `spread_name` | string | 1–100 chars |
| `question` | string \| null | 5–500 chars |
| `cards` | `CardInSpread[]` | 1–10 cards |

Each card in the spread:

| Field | Type | Notes |
|---|---|---|
| `name` | string | Card name (canonical or aliased — see below) |
| `position` | string | E.g. `"Past"`, `"Fire"`, `"Card 1"` |
| `orientation` | `"upright"` \| `"reversed"` | |
| `position_description` | string \| null | E.g. `"Will, drive, and what energises the situation"` |

---

## Card Data Injected per Card (from catalog)

Data is looked up by card name and appended to the user prompt automatically.

### Major Arcana (22 cards)
All fields live under the card object:

| Field | Example |
|---|---|
| `upright.positive[]` | `"Brand new beginnings"`, `"Leaps of faith"` |
| `upright.negative[]` | `"Recklessness"`, `"Poor planning"` (sent as "Challenges") |
| `reversed.negative[]` | `"Fear of change"`, `"Inhibition"` (sent as "Reversed shadow") |
| `reversed.positive[]` | `"Greater spontaneity"`, `"Inhibitions overcome"` (sent as "Reversed growth") |
| `meta.archetype` | `"The Wanderer"` |
| `meta.keywords[]` | `"beginnings"`, `"freedom"`, `"innocence"` |
| `meta.core.element` | `"Air"` |
| `meta.core.modality` | `"Cardinal"` |
| `meta.astrology.sign` | `"Aries"` |
| `meta.astrology.planet[]` | `["Uranus"]` |
| `meta.esoteric.kabbalah` | `"Path 11"` |
| `meta.esoteric.alchemy[]` | `["Albedo", "Primus Agens"]` |
| `meta.numerology.number` | `22` |
| `meta.numerology.reduction` | `4` |
| `meta.numerology.meaning` | `"Mastery through experience..."` |

> `bioenergetic[]` and `meta.esoteric.mythic[]` fields are **not** sent to the LLM.

---

### Minor Arcana (pip cards, 40 cards)
Suit context is prepended, then card meanings:

| Field | Example |
|---|---|
| Suit `name` | `"Suit of Wands"` |
| Suit `element` | `"Fire"` |
| Suit `temporal` | `"Days"` |
| `upright[]` | `"Concentrated energy"`, `"Creativity"` |
| `negative[]` | `"Aggression"`, `"Haste"` (sent as "Challenges") |
| `reversed[]` | `"Wasted effort"`, `"Missed opportunity"` (sent as "Reversed shadow") |
| `reversed_positive[]` | Growth keywords if present (sent as "Reversed growth") |

---

### Court Cards (16 cards)
Same as Minor Arcana (pip) plus extra meta:

| Field | Example |
|---|---|
| `meta.kabbalah` | `"Chokmah in Atziluth"` |
| `meta.elemental` | `"Fire of Fire"` |
| `meta.psyche` | `"Will Directing Will"` |

> `meta.rules`, `meta.throned`, `meta.age_sex` are present in the data but **not** forwarded to the LLM.

---

## Orientation Rules (what gets sent)

| Orientation | Fields included |
|---|---|
| **Upright** | `upright` (positive) + `upright.negative` / `negative` as "Challenges" |
| **Reversed** | `reversed.negative` / `reversed` as "Reversed shadow" + `reversed.positive` / `reversed_positive` as "Reversed growth" |

---

## Card Name Aliases (RWS → Thoth canonical)

Clients may send RWS names; the catalog resolves them silently:

| Client sends | Resolved to |
|---|---|
| `Judgement` | `Judgment` |
| `The World` | `Universe` |
| `X of Pentacles` | `X of Disks` |
| `Page of X` | `Princess (Page) of X` |

---

## Structured Output Schema (`LLMInterpretationResult`)

Sent as `response_format` to OpenAI (JSON schema mode):

```
{
  card_interpretations: [           // one per input card, same order
    {
      card_name: string             // echoed from input
      position: string              // echoed from input
      orientation: "upright"|"reversed"
      interpretation: string        // focused, position-aware interpretation
    }
  ],
  synthesis: string                 // multi-card: integrated narrative
                                    // single-card: practical takeaway / reflective question
}
```

---

## System Prompt Summary

The system prompt instructs the model to:

1. **Role** — Expert tarot reader with Kabbalah and Jungian depth.
2. **Question handling** — Address it directly if given; otherwise general reading shaped by the spread.
3. **Upright cards** — Acknowledge both strengths and shadow side.
4. **Reversed cards** — Not simply negative; balance blocked energy with growth potential guided by the question and neighbouring cards.
5. **Position weight** — Let the position meaning shape interpretation (e.g. a "Fire" position reads differently from a "Water" position).
6. **Per-card format** — Focused on the question, grounded in symbolism, no filler.
7. **Synthesis (multi-card)** — The heart of the reading: integrated insight, not a recap.
8. **Synthesis (single-card)** — Practical takeaway or reflective question, not a restatement.
