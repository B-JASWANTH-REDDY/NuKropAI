# NuKropAI — Phase 13 Design System & UI/UX Tokens

**Project:** NuKropAI Sovereign Agrarian Operating System  
**Audience:** Mobile Engineers, Web Engineers, UI/UX Pair Designers  
**Specification Level:** Production-Grade Agricultural Design Tokens  
**Date:** November 2026  

---

## 1. Visual Philosophy & Agricultural Technology Identity

NuKropAI's design language merges the organic warmth of Indian agriculture with precision fintech clarity. It prioritizes legibility in direct sunlight on low-cost IPS LCD smartphone screens while maintaining an Apple/Airbnb-grade finish.

Key Tenets:
1. **High Sunlight Contrast**: Pure `#FFFFFF` and `#F8FAF8` surfaces paired with dark `#0F172A` headings and `#15803D` organic emerald accents.
2. **Generous Touch Targets**: All interactive elements satisfy minimum 44×44 dp physical touch targets.
3. **No Content Popping**: Shimmer skeleton loaders pre-occupy the exact geometry of incoming network content.
4. **Multilingual Typography**: Font metrics tuned for complex Indian scripts (Telugu, Devanagari, Tamil) without line clipping.

---

## 2. Global Design Tokens

### 2.1 Color Tokens
```css
:root {
  /* Primary Agrarian Palette */
  --nk-primary-dark: #1B5E20;       /* Deep Forest Green (Brand / Headers) */
  --nk-primary: #15803D;            /* Emerald Green (Primary Action) */
  --nk-primary-light: #16A34A;      /* Fresh Sprout (Secondary Action) */
  --nk-primary-surface: #F0FDF4;    /* Light Emerald Tint */
  --nk-primary-border: #86EFAC;     /* Crisp Accent Border */

  /* Neutral Backgrounds & Cards */
  --nk-bg-app: #F8FAF8;             /* App Background */
  --nk-surface-card: #FFFFFF;       /* Bento Surface Card */
  --nk-border-subtle: #E2ECE2;      /* Organic Divider */
  --nk-border-default: #E2E8F0;     /* Slate Card Border */

  /* Typography Colors */
  --nk-text-heading: #0F172A;       /* Slate 900 (High-Contrast Headlines) */
  --nk-text-body: #334155;          /* Slate 700 (Body Text) */
  --nk-text-muted: #64748B;         /* Slate 500 (Captions & Timestamps) */
  --nk-text-brand: #1B5E20;         /* Primary Brand Heading */

  /* Semantic Feedback */
  --nk-amber: #D97706;              /* Amber Alert / Warning */
  --nk-amber-bg: #FEF3C7;           /* Amber Background */
  --nk-red: #DC2626;                /* Critical / Outbreak */
  --nk-red-bg: #FEF2F2;             /* Critical Alert Tint */
  --nk-blue: #2563EB;               /* Logistic / Drone Hub */
  --nk-blue-bg: #EFF6FF;            /* Logistic Background */

  /* Shimmer Gradients */
  --nk-shimmer-base: #F1F5F9;
  --nk-shimmer-highlight: #E2E8F0;
}
```

### 2.2 Typography Scale (`Plus Jakarta Sans`)
| Token | Font Size | Line Height | Weight | Usage |
| :--- | :--- | :--- | :--- | :--- |
| `font-hero` | 32px | 38px | 900 | Financial Totals, KCC Limits |
| `font-title-lg`| 24px | 28px | 900 | Dashboard Greeting, Brand Title |
| `font-title-md`| 18px | 22px | 900 | View Titles, Modal Headers |
| `font-body-lg` | 15px | 20px | 700 | Primary Card Titles, Mandi Rates |
| `font-body` | 13px | 18px | 600 | General Content, Advice Descriptions |
| `font-caption` | 11px | 15px | 700 | Badges, Secondary Meta, Units |
| `font-micro` | 9.5px | 13px | 800 | Status Chips, Version Pills |

### 2.3 Elevation & Shadows
- **Card Subtle**: `box-shadow: 0 1px 3px rgba(15,23,42,0.04);`
- **Card Interactive**: `box-shadow: 0 3px 12px rgba(0,0,0,0.03);`
- **Elevated Bento**: `box-shadow: 0 8px 30px rgba(22,163,74,0.12);`
- **Floating Modals & Docks**: `box-shadow: 0 20px 48px -8px rgba(0,0,0,0.22);`

### 2.4 Corner Radii
- `radius-sm`: `6px` (Status badges, tags)
- `radius-md`: `12px` (Buttons, inputs, sub-cards)
- `radius-lg`: `16px` (Standard bento cards, crop badges)
- `radius-xl`: `20px` (Feature containers, modals)
- `radius-pill`: `999px` (Filter chips, action pills, circular buttons)
- `radius-chassis`: `36px` to `48px` (Mobile frame chassis)

---

## 3. Standardized Components

### 3.1 Primary Buttons
- **Solid Action Button**: Background `linear-gradient(135deg, #15803D 0%, #16A34A 100%)`, color `#FFFFFF`, border `none`, padding `12px 20px`, radius `14px`, weight `900`. Active state scales down `0.96` with transition `0.15s ease`.
- **Secondary Ghost Button**: Background `#FFFFFF`, color `#15803D`, border `1.5px solid #86EFAC`, padding `10px 18px`, radius `14px`.

### 3.2 Shimmer Skeleton Loaders
```css
.skeleton-shimmer {
  background: linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%) !important;
  background-size: 200% 100% !important;
  animation: nkShimmer 1.5s infinite !important;
}

@keyframes nkShimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-shimmer {
    animation: none !important;
    background: #E2E8F0 !important;
  }
}
```

### 3.3 Empty & Stale Data States
- **Stale Cache Indicator**:
  `<span class="stale-cache-pill">📦 Cached APMC Snapshot · Today 06:00 IST</span>`
- **Empty Filter State**: Clean icon (📍 / 🌾), bold localized message, and helpful action buttons (e.g., "Clear Filters", "Auto-Detect Location").
