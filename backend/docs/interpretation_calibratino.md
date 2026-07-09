# Tarot Reading Calibration UI Specification

## Overview

The reading experience is controlled by **three user-facing settings**:

1. **Reading Style** – determines *how* the cards are interpreted.
2. **Reading Depth** – determines *how much* detail is included.
3. **Tone** – determines *how the interpretation is written.*

The user should never see internal concepts like "esoteric weight" or "symbolic layer." Those remain implementation details used by the prompt builder.

---

# 1. Reading Style

**Component:** Segmented Control / Radio Cards

**Default:** Reflective

---

## Practical

**Description**

Grounded guidance focused on real-world situations, psychology, decisions, relationships, and personal growth.

### Internal Mapping

```json
{
  "literal": 1.0,
  "psychological": 0.8,
  "symbolic": 0.2,
  "esoteric": 0.0
}
```

### Primary Sources

- Upright meanings
- Reversed meanings
- Keywords

### Secondary Sources

- Archetypes

### Rarely Uses

- Astrology
- Numerology

### Never Uses

- Kabbalah
- Alchemy
- Mythology
- Sigils

---

## Reflective (Default)

**Description**

Balances practical advice with symbolic insight and psychological interpretation.

### Internal Mapping

```json
{
  "literal": 0.8,
  "psychological": 1.0,
  "symbolic": 0.5,
  "esoteric": 0.2
}
```

### Primary Sources

- Keywords
- Upright/Reversed meanings
- Archetypes

### Supporting Sources

- Elements
- Astrology (when relevant)
- Numerology (occasionally)

---

## Spiritual

**Description**

Focuses on intuition, symbolism, synchronicity, and deeper personal meaning.

### Internal Mapping

```json
{
  "literal": 0.5,
  "psychological": 0.9,
  "symbolic": 0.8,
  "esoteric": 0.6
}
```

### Frequently Uses

- Elements
- Astrology
- Numerology
- Archetypes

### Occasionally Uses

- Kabbalah
- Alchemy
- Mythology

---

## Esoteric

**Description**

Fully embraces the symbolic traditions of Tarot, including occult correspondences.

### Internal Mapping

```json
{
  "literal": 0.3,
  "psychological": 0.7,
  "symbolic": 1.0,
  "esoteric": 1.0
}
```

### Uses

- All metadata naturally
- Kabbalah
- Alchemy
- Mythology
- Sigils
- Astrology
- Numerology

---

# 2. Reading Depth

**Component:** Slider

```
Brief ───────────────────────── Comprehensive
```

**Default:** 60%

---

## Brief (0–25)

- ~150–250 words
- One primary theme
- Minimal symbolism
- Quick actionable guidance

---

## Standard (26–50)

- ~250–400 words
- Two or three themes
- Moderate symbolic interpretation

---

## Detailed (51–75)

- ~400–700 words
- Rich interpretation
- Strong synthesis
- Cross-connections between cards

---

## Comprehensive (76–100)

- ~700–1200 words
- Extensive synthesis
- Deep symbolic exploration
- Uses supporting correspondences when relevant

---

# 3. Tone

**Component:** Slider

```
Gentle ───────────────────────── Direct
```

**Default:** Balanced

---

## Gentle (0–33)

Uses language like:

> Consider...

> You may be experiencing...

> This card invites you to...

Characteristics

- Compassionate
- Exploratory
- Open-ended
- Avoids certainty

---

## Balanced (34–66)

Uses language like:

> This suggests...

> A recurring theme is...

> It appears that...

Characteristics

- Confident
- Thoughtful
- Neutral

---

## Direct (67–100)

Uses language like:

> This card points toward...

> You're avoiding...

> The challenge is...

Characteristics

- Concise
- Clear
- Assertive

Still avoids presenting interpretations as objective fact.

---

# API

The frontend sends:

```json
{
  "style": "reflective",
  "depth": 65,
  "tone": 50
}
```

The backend converts this into:

```json
{
  "weights": {
    "literal": 0.8,
    "psychological": 1.0,
    "symbolic": 0.5,
    "esoteric": 0.2
  },
  "depth": "detailed",
  "tone": "balanced"
}
```

---

# Prompt Rules

The prompt builder should append instructions similar to:

```
Interpret the cards using the selected Reading Style.

Prioritize higher-weighted interpretation layers.

Do not mention every symbolic correspondence simply because it exists.

Only include symbolic or esoteric references when they naturally strengthen the reading.

Avoid listing correspondences.

Instead, weave symbolism naturally into the interpretation.

Ground every conclusion in the cards drawn and their spread positions.

Present metaphysical concepts as interpretive perspectives rather than objective facts.
```

---

# Default Configuration

| Setting | Default |
|----------|---------|
| Reading Style | Reflective |
| Reading Depth | Detailed (60%) |
| Tone | Balanced |

---

# Design Principles

The reading should:

- Feel coherent rather than encyclopedic.
- Prioritize interpretation over information.
- Never enumerate metadata for its own sake.
- Use symbolism only when it adds meaning.
- Keep the cards—not the correspondences—as the focus of the reading.

The metadata exists to deepen the interpretation, not to become the interpretation.