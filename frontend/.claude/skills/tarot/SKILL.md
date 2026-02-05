---
name: tarot
description: Create mystical, medieval-themed interfaces with Egyptian and Tarot aesthetics. Use for fortune-telling apps, spiritual content, mystical dashboards, or any interface requiring an atmospheric, otherworldly feel. Features starfield backgrounds, golden hieroglyphs, ornate borders, and ethereal animations.
---

# Mystical Tarot Design System

This skill guides the creation of mystical, medieval-themed interfaces inspired by Tarot symbolism and ancient Egyptian astronomy. Use this for spiritual applications, fortune-telling interfaces, mystical content, or any project requiring an atmospheric, otherworldly aesthetic.

## Design Philosophy

**Core Concept**: Transport users into a fortune teller's parlor or ancient temple - a space where the mystical and material worlds meet.

**Aesthetic Goals**:
- Evoke wonder and mystery
- Create immersive atmospheric depth
- Balance ornamentation with usability
- Honor historical symbolism authentically

**Emotional Tone**: Reverent, mystical, timeless, spiritual, contemplative

## Typography

### Font Pairing
**Primary Display Font**: Cinzel (medieval serif)
- Use for: Headers, titles, buttons, important labels
- Weights: 400 (regular), 600 (semibold), 700 (bold)
- Load from Google Fonts: `Cinzel:wght@400;600;700`

**Body Font**: Crimson Pro (elegant serif)
- Use for: Body text, descriptions, labels, subtitles
- Weights: 300 (light), 400 (regular), 600 (semibold)
- Italic for mystical flavor text
- Load from Google Fonts: `Crimson+Pro:ital,wght@0,300;0,400;0,600;1,400`

### Typography Guidelines
```css
/* Headers */
font-family: 'Cinzel', serif;
font-weight: 700;
letter-spacing: 0.15em;
text-shadow: 0 0 20px rgba(212,175,55,0.5);

/* Subheadings */
font-family: 'Cinzel', serif;
font-weight: 600;
letter-spacing: 0.1em;

/* Body text */
font-family: 'Crimson Pro', serif;
font-weight: 400;
letter-spacing: 0.05em;

/* Mystical flavor text */
font-family: 'Crimson Pro', serif;
font-style: italic;
font-weight: 400;
```

## Color Palette

### Core Colors
```css
/* Deep purples - Primary backgrounds */
--mystical-deep-purple: #1a0033;
--mystical-medium-purple: #2d1b4e;
--mystical-light-purple: #4a2d7a;

/* Gold - Sacred accent */
--mystical-gold: #d4af37;
--mystical-gold-light: #e6d5b8;
--mystical-gold-dark: #b8942f;

/* Mystic accents */
--mystical-violet: #8a2be2;

/* Text colors */
--text-primary: #e6d5b8;        /* Parchment */
--text-secondary: rgba(230,213,184,0.8);
--text-tertiary: rgba(230,213,184,0.6);
```

### Color Usage
- **Backgrounds**: Layer gradients from deep purple to medium purple
- **Borders**: Gold with 30-60% opacity
- **Text**: Parchment (#e6d5b8) for primary, faded for secondary
- **Accents**: Pure gold (#d4af37) for emphasis, calls-to-action
- **Glows**: Gold with radial gradients and blur

### Gradient Patterns
```css
/* Standard background */
background: linear-gradient(135deg, 
  rgba(26,0,51,0.95) 0%, 
  rgba(45,27,78,0.95) 100%);

/* Starfield background */
background: linear-gradient(to bottom, 
  #0a0015, 
  #1a0033, 
  #2d1b4e);

/* Button gradients */
background: linear-gradient(135deg, 
  #d4af37, 
  #b8942f);
```

## Atmospheric Backgrounds

### Starfield Effect
Always include animated starfield for immersive atmosphere:

```jsx
{/* Starfield container */}
<div className="fixed inset-0 bg-gradient-to-b from-[#0a0015] via-[#1a0033] to-[#2d1b4e]">
  {/* Animated stars */}
  <div className="absolute inset-0 opacity-60">
    {[...Array(100)].map((_, i) => (
      <div
        key={i}
        className="absolute w-1 h-1 bg-white rounded-full animate-twinkle"
        style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 3}s`,
          animationDuration: `${2 + Math.random() * 2}s`,
        }}
      />
    ))}
  </div>
  
  {/* Constellation overlays */}
  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_20%,rgba(212,175,55,0.15),transparent_50%)]" />
  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_70%_60%,rgba(138,43,226,0.15),transparent_50%)]" />
  
  {/* Vignette */}
  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.7)_100%)]" />
</div>
```

### Layering Technique
1. Base gradient (purple shades)
2. Twinkling stars (animated)
3. Constellation overlays (radial gradients)
4. Vignette (darkened edges)
5. Content layer (relative z-index)

## Ornamental Elements

### Ornate Corners
Add decorative corners to primary containers:

```jsx
{/* Corner decorations */}
<div className="absolute top-0 left-0 w-24 h-24 border-t-2 border-l-2 border-[#d4af37]/50 rounded-tl-xl" />
<div className="absolute top-0 right-0 w-24 h-24 border-t-2 border-r-2 border-[#d4af37]/50 rounded-tr-xl" />
<div className="absolute bottom-0 left-0 w-24 h-24 border-b-2 border-l-2 border-[#d4af37]/50 rounded-bl-xl" />
<div className="absolute bottom-0 right-0 w-24 h-24 border-b-2 border-r-2 border-[#d4af37]/50 rounded-br-xl" />
```

### Mystical Symbols
**Ankh** (Egyptian symbol of life):
```jsx
<svg viewBox="0 0 40 64" className="w-10 h-16">
  {/* Loop */}
  <circle cx="20" cy="14" r="10" 
          stroke="rgba(212,175,55,0.7)" 
          strokeWidth="2.5" 
          fill="none"/>
  {/* Vertical line */}
  <line x1="20" y1="24" x2="20" y2="60" 
        stroke="rgba(212,175,55,0.7)" 
        strokeWidth="3"/>
  {/* Horizontal crossbar */}
  <line x1="6" y1="32" x2="34" y2="32" 
        stroke="rgba(212,175,55,0.7)" 
        strokeWidth="3"/>
</svg>
```

**Corner Stars**:
```jsx
<div className="absolute top-2 left-2 text-[#d4af37]/40 text-xs">✦</div>
<div className="absolute top-2 right-2 text-[#d4af37]/40 text-xs">✦</div>
<div className="absolute bottom-2 left-2 text-[#d4af37]/40 text-xs">✦</div>
<div className="absolute bottom-2 right-2 text-[#d4af37]/40 text-xs">✦</div>
```

**Decorative Dividers**:
```jsx
<div className="flex items-center justify-center gap-4">
  <div className="w-12 h-0.5 bg-gradient-to-r from-transparent to-[#d4af37]/50" />
  <span className="text-[#d4af37] text-xl">✦</span>
  <div className="w-12 h-0.5 bg-gradient-to-l from-transparent to-[#d4af37]/50" />
</div>
```

## Motion & Animation

### Essential Animations

**Star Twinkling**:
```css
@keyframes twinkle {
  0%, 100% { opacity: 0.2; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.2); }
}
```

**Floating Elements**:
```css
@keyframes cardFloat {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-5px); }
}

/* Apply with staggered delays */
animation: cardFloat 3s ease-in-out infinite;
animation-delay: ${index * 0.05}s;
```

**3D Card Reveals**:
```css
@keyframes revealCard {
  from {
    opacity: 0;
    transform: scale(0.5) rotateY(90deg);
  }
  to {
    opacity: 1;
    transform: scale(1) rotateY(0deg);
  }
}

/* Stagger with delay */
animation: revealCard 0.8s ease-out backwards;
animation-delay: ${index * 0.3}s;
```

**Fade In**:
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### Hover States
```css
/* Cards and interactive elements */
.mystical-card:hover {
  transform: scale(1.1) translateY(-5px);
  border-color: #d4af37;
  box-shadow: 0 0 20px rgba(212,175,55,0.6);
}

/* Buttons */
.mystical-button:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 30px rgba(212,175,55,0.5);
}

.mystical-button:active {
  transform: scale(0.95);
}
```

### Glow Effects
```css
/* Static glow */
box-shadow: 0 0 20px rgba(212,175,55,0.4);

/* Pulsing glow */
@keyframes glow {
  0%, 100% { box-shadow: 0 0 5px rgba(212,175,55,0.3); }
  50% { box-shadow: 0 0 20px rgba(212,175,55,0.6), 
                    0 0 30px rgba(212,175,55,0.3); }
}

/* Text glow */
text-shadow: 0 0 20px rgba(212,175,55,0.5);
```

## Component Patterns

### Primary Container
```jsx
<div className="relative w-full max-w-6xl mx-auto overflow-hidden rounded-xl 
                border-2 border-[#d4af37]/30 shadow-2xl"
     style={{
       background: 'linear-gradient(135deg, rgba(26,0,51,0.95), rgba(45,27,78,0.95))',
       backdropFilter: 'blur(10px)',
     }}>
  
  {/* Ornate corners */}
  {/* ... corner decorations ... */}
  
  {/* Mystical glow */}
  <div className="absolute inset-0 opacity-30 pointer-events-none"
       style={{
         background: 'radial-gradient(circle at 50% 50%, rgba(212,175,55,0.15), transparent 70%)'
       }} />
  
  {/* Content */}
  <div className="relative z-10 p-6 sm:p-12">
    {/* Your content */}
  </div>
</div>
```

### Buttons
```jsx
<button
  className="px-10 py-4 bg-gradient-to-br from-[#d4af37] to-[#b8942f] 
             text-[#1a0033] rounded-lg shadow-lg hover:shadow-[#d4af37]/50 
             transition-all duration-300 font-bold text-lg
             hover:scale-105 active:scale-95 border border-[#d4af37]/50"
  style={{ 
    fontFamily: "'Cinzel', serif", 
    letterSpacing: '0.1em' 
  }}
>
  ✦ Button Text ✦
</button>
```

### Cards with Ornate Borders
```jsx
<div className="relative w-40 h-64 group">
  {/* Glow effect */}
  <div className="absolute -inset-1 bg-gradient-to-r from-[#d4af37] to-[#8a2be2] 
                  rounded-lg opacity-0 group-hover:opacity-50 blur transition-opacity duration-500" />
  
  {/* Card */}
  <div className="relative w-full h-full rounded-lg border-2 border-[#d4af37] 
                  shadow-2xl overflow-hidden"
       style={{
         background: 'linear-gradient(135deg, rgba(26,0,51,0.3), rgba(45,27,78,0.3))',
         backdropFilter: 'blur(5px)'
       }}>
    
    {/* Inner border */}
    <div className="absolute inset-2 border border-[#d4af37]/40 rounded-md" />
    
    {/* Content */}
    <div className="relative w-full h-full p-3">
      {/* Your content */}
    </div>
  </div>
</div>
```

## Best Practices

### Do's
✓ Layer multiple gradients for depth
✓ Use gold sparingly for maximum impact
✓ Animate with purpose - twinkling, floating, revealing
✓ Include ornate details in corners and borders
✓ Use backdrop blur for translucent containers
✓ Add text shadows on gold text for glow effect
✓ Stagger animations for dramatic reveals
✓ Include corner stars on bordered elements
✓ Use Cinzel for all headings and buttons
✓ Keep symbols authentic (ankh, stars, geometric patterns)

### Don'ts
✗ Don't use bright, saturated colors
✗ Don't overcrowd with symbols (less is more)
✗ Don't use modern sans-serif fonts
✗ Don't create flat, solid backgrounds
✗ Don't skip the starfield - it's essential
✗ Don't use harsh transitions (always ease-out/in-out)
✗ Don't forget mobile responsive sizing
✗ Don't overuse animations (purposeful only)
✗ Don't use standard box-shadows (use glows instead)
✗ Don't ignore ornamental corners on primary containers

## Responsive Considerations

```css
/* Mobile adjustments */
@media (max-width: 768px) {
  /* Reduce font sizes */
  .title { font-size: 2rem; }
  
  /* Smaller ornate corners */
  .corner { width: 3rem; height: 3rem; }
  
  /* Reduce star count for performance */
  /* Use 50 stars instead of 100 */
  
  /* Simplify some animations */
  .card-back { animation: none; }
  .card-back:hover { animation: cardFloat 3s ease-in-out infinite; }
}
```

## Performance Tips

1. **Limit animated stars**: 100 max on desktop, 50 on mobile
2. **Use CSS animations**: Prefer CSS over JavaScript
3. **Optimize gradients**: Limit to 2-3 per element
4. **Lazy load**: Load non-critical animations on interaction
5. **GPU acceleration**: Use `transform: translateZ(0)` on animated elements

## Implementation Checklist

For any mystical Tarot-themed interface:

- [ ] Starfield background with twinkling stars
- [ ] Purple-to-blue base gradient
- [ ] Cinzel font for all headings
- [ ] Crimson Pro for body text
- [ ] Gold color (#d4af37) for accents
- [ ] Ornate corners on primary containers
- [ ] Mystical symbols (ankh, stars, or sacred geometry)
- [ ] Floating animations on interactive elements
- [ ] Glow effects on hover states
- [ ] 3D transform reveals for dramatic moments
- [ ] Vignette effect on background
- [ ] Translucent containers with backdrop blur
- [ ] Decorative dividers with stars
- [ ] Text shadows on gold text

## Example Code: Complete Card Component

```jsx
export default function MysticalCard({ content }) {
  return (
    <div className="relative group">
      {/* Hover glow */}
      <div className="absolute -inset-1 bg-gradient-to-r from-[#d4af37] to-[#8a2be2] 
                      rounded-lg opacity-0 group-hover:opacity-50 blur transition-opacity duration-500" />
      
      {/* Card body */}
      <div className="relative w-40 h-64 bg-gradient-to-br from-[#1a0033] to-[#2d1b4e]
                      rounded-lg border-2 border-[#d4af37]/60 shadow-xl overflow-hidden
                      transition-all duration-300 group-hover:scale-110 group-hover:border-[#d4af37]"
           style={{ animation: 'cardFloat 3s ease-in-out infinite' }}>
        
        {/* Border decoration */}
        <div className="absolute top-0 left-0 right-0 h-1 
                        bg-gradient-to-r from-transparent via-[#d4af37]/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-1 
                        bg-gradient-to-r from-transparent via-[#d4af37]/30 to-transparent" />
        
        {/* Corner stars */}
        <div className="absolute top-2 left-2 text-[#d4af37]/40 text-xs">✦</div>
        <div className="absolute top-2 right-2 text-[#d4af37]/40 text-xs">✦</div>
        <div className="absolute bottom-2 left-2 text-[#d4af37]/40 text-xs">✦</div>
        <div className="absolute bottom-2 right-2 text-[#d4af37]/40 text-xs">✦</div>
        
        {/* Ankh symbol */}
        <div className="absolute inset-0 flex items-center justify-center opacity-60">
          <svg className="w-10 h-16" viewBox="0 0 40 64">
            <circle cx="20" cy="14" r="10" stroke="rgba(212,175,55,0.7)" strokeWidth="2.5" fill="none"/>
            <line x1="20" y1="24" x2="20" y2="60" stroke="rgba(212,175,55,0.7)" strokeWidth="3"/>
            <line x1="6" y1="32" x2="34" y2="32" stroke="rgba(212,175,55,0.7)" strokeWidth="3"/>
          </svg>
        </div>
        
        {/* Content */}
        <div className="relative z-10 p-4">
          {content}
        </div>
      </div>
      
      <style jsx>{`
        @keyframes cardFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
}
```

---

**Remember**: This aesthetic is about creating atmosphere and immersion. Every element should contribute to the mystical, timeless feeling. When in doubt, add subtle depth through layering, use gold sparingly for emphasis, and let animations tell a story.