import { TarotCardData } from "../models";

export const TAROT_DECK: TarotCardData[] = [
  // Major Arcana
  { idx: 0, name: "The Fool", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-T-00.webp", meaning: "New beginnings, innocence", reversedMeaning: "Recklessness, risk-taking" },
  { idx: 1, name: "The Magician", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-T-01.webp", meaning: "Manifestation, resourcefulness", reversedMeaning: "Manipulation, poor planning" },
  { idx: 2, name: "The High Priestess", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-T-02.webp", meaning: "Intuition, unconscious", reversedMeaning: "Secrets, disconnected from intuition" },
  { idx: 3, name: "The Empress", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-T-03.webp", meaning: "Fertility, beauty, nature", reversedMeaning: "Dependence, creative block" },
  { idx: 4, name: "The Emperor", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-T-04.webp", meaning: "Authority, structure", reversedMeaning: "Domination, rigidity" },
  { idx: 5, name: "The Hierophant", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-T-05.webp", meaning: "Tradition, conformity", reversedMeaning: "Rebellion, unconventionality" },
  { idx: 6, name: "The Lovers", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-T-06.webp", meaning: "Love, harmony", reversedMeaning: "Imbalance, misalignment" },
  { idx: 7, name: "The Chariot", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-T-07.webp", meaning: "Control, willpower", reversedMeaning: "Aggression, lack of direction" },
  { idx: 8, name: "Strength", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-T-08.webp", meaning: "Courage, persuasion", reversedMeaning: "Self-doubt, weakness" },
  { idx: 9, name: "The Hermit", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-T-09.webp", meaning: "Soul-searching, solitude", reversedMeaning: "Isolation, withdrawal" },
  { idx: 10, name: "Wheel of Fortune", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-T-10.webp", meaning: "Luck, karma, cycles", reversedMeaning: "Bad luck, resistance to change" },
  { idx: 11, name: "Justice", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-T-11.webp", meaning: "Truth, fairness", reversedMeaning: "Dishonesty, unfairness" },
  { idx: 12, name: "The Hanged Man", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-T-12.webp", meaning: "Pause, surrender", reversedMeaning: "Delays, resistance" },
  { idx: 13, name: "Death", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-T-13.webp", meaning: "Endings, transformation", reversedMeaning: "Fear of change, stagnation" },
  { idx: 14, name: "Temperance", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-T-14.webp", meaning: "Balance, patience", reversedMeaning: "Imbalance, excess" },
  { idx: 15, name: "The Devil", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-T-15.webp", meaning: "Addiction, materialism", reversedMeaning: "Freedom, release" },
  { idx: 16, name: "The Tower", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-T-16.webp", meaning: "Sudden change, upheaval", reversedMeaning: "Avoidance of disaster" },
  { idx: 17, name: "The Star", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-T-17.webp", meaning: "Hope, renewal", reversedMeaning: "Despair, lack of faith" },
  { idx: 18, name: "The Moon", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-T-18.webp", meaning: "Illusion, fear", reversedMeaning: "Release of fear, confusion" },
  { idx: 19, name: "The Sun", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-T-19.webp", meaning: "Joy, success", reversedMeaning: "Negativity, depression" },
  { idx: 20, name: "Judgement", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-T-20.webp", meaning: "Rebirth, inner calling", reversedMeaning: "Self-doubt, refusal" },
  { idx: 21, name: "The World", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-T-21.webp", meaning: "Completion, accomplishment", reversedMeaning: "Shortcuts, delays" },
  // Pentacles suit
  { idx: 22, name: "Ace of Pentacles", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-P-0A.webp", meaning: "New financial or career opportunity, manifestation, abundance", reversedMeaning: "Lost opportunity, lack of planning and foresight" },
  { idx: 23, name: "Two of Pentacles", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-P-02.webp", meaning: "Balance, adaptability, time management", reversedMeaning: "Overwhelmed, disorganization" },
  { idx: 24, name: "Three of Pentacles", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-P-03.webp", meaning: "Teamwork, collaboration, learning", reversedMeaning: "Disharmony, misalignment, working alone" },
  { idx: 25, name: "Four of Pentacles", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-P-04.webp", meaning: "Saving money, security, conservatism", reversedMeaning: "Greed, materialism, self-protection" },
  { idx: 26, name: "Five of Pentacles", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-P-05.webp", meaning: "Financial loss, poverty, isolation", reversedMeaning: "Recovery from loss, spiritual poverty" },
  { idx: 27, name: "Six of Pentacles", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-P-06.webp", meaning: "Giving, receiving, sharing wealth", reversedMeaning: "Debt, selfishness, one-sided charity" },
  { idx: 28, name: "Seven of Pentacles", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-P-07.webp", meaning: "Long-term view, perseverance, investment", reversedMeaning: "Lack of long-term vision, limited success" },
  { idx: 29, name: "Eight of Pentacles", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-P-08.webp", meaning: "Apprenticeship, repetitive tasks, mastery", reversedMeaning: "Perfectionism, uninspired, no passion" },
  { idx: 30, name: "Nine of Pentacles", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-P-09.webp", meaning: "Abundance, luxury, self-sufficiency", reversedMeaning: "Overindulgence, financial setbacks" },
  { idx: 31, name: "Ten of Pentacles", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-P-10.webp", meaning: "Wealth, inheritance, family, establishment", reversedMeaning: "Financial failure, loneliness, loss" },
  { idx: 32, name: "Page of Pentacles", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-P-J1.webp", meaning: "Manifestation, financial opportunity, skill development", reversedMeaning: "Lack of progress, procrastination" },
  { idx: 33, name: "Knight of Pentacles", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-P-J2.webp", meaning: "Hard work, productivity, routine", reversedMeaning: "Laziness, boredom, feeling stuck" },
  { idx: 34, name: "Queen of Pentacles", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-P-QU.webp", meaning: "Practicality, creature comforts, financial security", reversedMeaning: "Self-centeredness, jealousy, smothering" },
  { idx: 35, name: "King of Pentacles", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-P-KI.webp", meaning: "Wealth, business, leadership, security", reversedMeaning: "Greed, indulgence, sensuality" },
  // Wands suit
  { idx: 36, name: "Ace of Wands", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-W-0A.webp", meaning: "Inspiration, new opportunities, growth", reversedMeaning: "Delays, lack of motivation" },
  { idx: 37, name: "Two of Wands", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-W-02.webp", meaning: "Planning, making decisions, leaving comfort", reversedMeaning: "Fear of change, playing safe" },
  { idx: 38, name: "Three of Wands", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-W-03.webp", meaning: "Expansion, foresight, overseas opportunities", reversedMeaning: "Delays, obstacles, frustration" },
  { idx: 39, name: "Four of Wands", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-W-04.webp", meaning: "Celebration, harmony, home, community", reversedMeaning: "Conflict with family, instability" },
  { idx: 40, name: "Five of Wands", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-W-05.webp", meaning: "Competition, conflict, rivalry", reversedMeaning: "Avoiding conflict, compromise" },
  { idx: 41, name: "Six of Wands", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-W-06.webp", meaning: "Victory, success, public recognition", reversedMeaning: "Ego, lack of recognition, fall from grace" },
  { idx: 42, name: "Seven of Wands", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-W-07.webp", meaning: "Challenge, competition, perseverance", reversedMeaning: "Giving up, overwhelmed" },
  { idx: 43, name: "Eight of Wands", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-W-08.webp", meaning: "Speed, action, movement, swift change", reversedMeaning: "Delays, frustration, holding off" },
  { idx: 44, name: "Nine of Wands", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-W-09.webp", meaning: "Resilience, courage, persistence", reversedMeaning: "Exhaustion, fatigue, questioning motives" },
  { idx: 45, name: "Ten of Wands", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-W-10.webp", meaning: "Burden, responsibility, hard work", reversedMeaning: "Burnout, stress, letting go" },
  { idx: 46, name: "Page of Wands", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-W-J1.webp", meaning: "Inspiration, discovery, free spirit", reversedMeaning: "Setbacks to new ideas, pessimism" },
  { idx: 47, name: "Knight of Wands", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-W-J2.webp", meaning: "Energy, passion, inspired action", reversedMeaning: "Impulsiveness, haste, scattered energy" },
  { idx: 48, name: "Queen of Wands", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-W-QU.webp", meaning: "Courage, confidence, independence", reversedMeaning: "Selfishness, jealousy, insecurity" },
  { idx: 49, name: "King of Wands", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-W-KI.webp", meaning: "Natural leader, vision, entrepreneur", reversedMeaning: "Impulsiveness, haste, ruthless" },
  // Cups suit
  { idx: 50, name: "Ace of Cups", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-C-0A.webp", meaning: "Love, new relationships, compassion", reversedMeaning: "Emotional loss, blocked creativity" },
  { idx: 51, name: "Two of Cups", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-C-02.webp", meaning: "Unified love, partnership, attraction", reversedMeaning: "Break-up, imbalance, lack of harmony" },
  { idx: 52, name: "Three of Cups", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-C-03.webp", meaning: "Celebration, friendship, creativity", reversedMeaning: "Overindulgence, gossip, isolation" },
  { idx: 53, name: "Four of Cups", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-C-04.webp", meaning: "Meditation, contemplation, apathy", reversedMeaning: "Boredom, missed opportunity" },
  { idx: 54, name: "Five of Cups", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-C-05.webp", meaning: "Regret, failure, disappointment", reversedMeaning: "Acceptance, moving on, finding peace" },
  { idx: 55, name: "Six of Cups", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-C-06.webp", meaning: "Reunion, nostalgia, childhood memories", reversedMeaning: "Stuck in the past, naivety" },
  { idx: 56, name: "Seven of Cups", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-C-07.webp", meaning: "Opportunities, choices, wishful thinking", reversedMeaning: "Lack of purpose, diversion, confusion" },
  { idx: 57, name: "Eight of Cups", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-C-08.webp", meaning: "Disappointment, withdrawal, abandonment", reversedMeaning: "Fear of change, stagnation" },
  { idx: 58, name: "Nine of Cups", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-C-09.webp", meaning: "Contentment, satisfaction, gratitude", reversedMeaning: "Lack of inner joy, dissatisfaction" },
  { idx: 59, name: "Ten of Cups", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-C-10.webp", meaning: "Harmony, marriage, happiness, alignment", reversedMeaning: "Misalignment of values, broken home" },
  { idx: 60, name: "Page of Cups", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-C-J1.webp", meaning: "Creative opportunities, curiosity, possibility", reversedMeaning: "Emotional immaturity, insecurity" },
  { idx: 61, name: "Knight of Cups", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-C-J2.webp", meaning: "Romance, charm, imagination", reversedMeaning: "Unrealistic, jealousy, moodiness" },
  { idx: 62, name: "Queen of Cups", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-C-QU.webp", meaning: "Compassionate, caring, emotionally stable", reversedMeaning: "Insecurity, dependence, martyrdom" },
  { idx: 63, name: "King of Cups", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-C-KI.webp", meaning: "Emotionally balanced, diplomatic, generous", reversedMeaning: "Moodiness, volatility, manipulation" },
  // Swords suit
  { idx: 64, name: "Ace of Swords", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-S-0A.webp", meaning: "Breakthrough, clarity, sharp mind", reversedMeaning: "Confusion, brutality, chaos" },
  { idx: 65, name: "Two of Swords", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-S-02.webp", meaning: "Difficult decisions, weighing up options", reversedMeaning: "Indecision, confusion, information overload" },
  { idx: 66, name: "Three of Swords", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-S-03.webp", meaning: "Heartbreak, emotional pain, sorrow", reversedMeaning: "Recovery, forgiveness, moving on" },
  { idx: 67, name: "Four of Swords", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-S-04.webp", meaning: "Rest, restoration, contemplation", reversedMeaning: "Restlessness, burnout, stress" },
  { idx: 68, name: "Five of Swords", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-S-05.webp", meaning: "Conflict, disagreements, defeat", reversedMeaning: "Reconciliation, making amends" },
  { idx: 69, name: "Six of Swords", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-S-06.webp", meaning: "Transition, change, rite of passage", reversedMeaning: "Resistance to change, unfinished business" },
  { idx: 70, name: "Seven of Swords", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-S-07.webp", meaning: "Deception, trickery, tactics", reversedMeaning: "Coming clean, rethinking approach" },
  { idx: 71, name: "Eight of Swords", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-S-08.webp", meaning: "Imprisonment, entrapment, self-victimization", reversedMeaning: "Freedom, release, finding solutions" },
  { idx: 72, name: "Nine of Swords", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-S-09.webp", meaning: "Anxiety, worry, fear, depression", reversedMeaning: "Inner turmoil, deep fears released" },
  { idx: 73, name: "Ten of Swords", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-S-10.webp", meaning: "Ruin, failure, betrayal", reversedMeaning: "Survival, recovery, regeneration" },
  { idx: 74, name: "Page of Swords", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-S-J1.webp", meaning: "New ideas, curiosity, thirst for knowledge", reversedMeaning: "Deception, manipulation, all talk" },
  { idx: 75, name: "Knight of Swords", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-S-J2.webp", meaning: "Ambitious, action-oriented, driven", reversedMeaning: "No direction, disregard for consequences" },
  { idx: 76, name: "Queen of Swords", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-S-QU.webp", meaning: "Complexity, perceptiveness, clear mindedness", reversedMeaning: "Cold-hearted, cruel, bitterness" },
  { idx: 77, name: "King of Swords", imageUrl: "https://steve-p.org/cards/small/sm_RWSa-S-KI.webp", meaning: "Intellectual, authority, truth", reversedMeaning: "Manipulative, cruel, weakness" },
];

// Card category mapping
export const TAROT_MAP = {
  majorArcana: TAROT_DECK.filter(card => card.idx >= 0 && card.idx <= 21),
  minorArcana: TAROT_DECK.filter(card => {
    // Numbered cards (Ace through Ten) from each suit
    const pentaclesNumbered = card.idx >= 22 && card.idx <= 31;
    const wandsNumbered = card.idx >= 36 && card.idx <= 45;
    const cupsNumbered = card.idx >= 50 && card.idx <= 59;
    const swordsNumbered = card.idx >= 64 && card.idx <= 73;
    return pentaclesNumbered || wandsNumbered || cupsNumbered || swordsNumbered;
  }),
  courtCards: TAROT_DECK.filter(card => {
    // Page, Knight, Queen, King from each suit
    const pentaclesCourt = card.idx >= 32 && card.idx <= 35;
    const wandsCourt = card.idx >= 46 && card.idx <= 49;
    const cupsCourt = card.idx >= 60 && card.idx <= 63;
    const swordsCourt = card.idx >= 74 && card.idx <= 77;
    return pentaclesCourt || wandsCourt || cupsCourt || swordsCourt;
  }),
};
