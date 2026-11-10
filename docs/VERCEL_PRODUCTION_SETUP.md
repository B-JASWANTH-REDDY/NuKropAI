# NuKropAI — Vercel Production Setup & Operations Guide
## Sovereign Web Dashboard, Client Security, DPDP Privacy, SEO, and Performance Hardening

This guide provides the exact configuration, environment variable inventory, security headers, routing specifications, and operational procedures for deploying the **NuKropAI Web Control Center** on [Vercel](https://vercel.com).

Repository: `B-JASWANTH-REDDY/NuKropAI`  
Directory: `web/`  
Feature Branch: `feature/production-hardening-market-data-supabase`  
Pull Request: [#1](https://github.com/B-JASWANTH-REDDY/NuKropAI/pull/1)

---

## 1. Verified Vercel Project & Build Configuration

When creating or configuring the project in the [Vercel Dashboard](https://vercel.com/dashboard):

| Setting | Exact Value | Notes |
|---|---|---|
| **Framework Preset** | `Vite` | Vercel automatically detects Vite from `package.json` |
| **Root Directory** | `web` | NuKropAI is a monorepo; set Root Directory to `web` |
| **Build Command** | `npm run build` | Executes `node sync-apk.js && tsc && vite build` |
| **Output Directory** | `dist` | Generated HTML, CSS, JavaScript chunks, and synchronized release APK |
| **Install Command** | `npm install` | Uses `package-lock.json` |
| **Node.js Version** | `18.x` or `20.x` | Set in Vercel Project Settings -> General |

---

## 2. Environment Variable Inventory & Client-Side Security

> ⚠️ **CRITICAL SECURITY LAW**: Any variable prefixed with `VITE_` is baked directly into client-side JavaScript bundles downloaded by public web browsers. **NEVER** place Supabase `service_role` keys, database passwords, government API tokens, or server signing secrets in Vercel frontend environment variables.

### Complete Environment Inventory

| Variable Name | Required? | Consumed By | Where to Configure | Client-Safe? | Purpose |
|---|---|---|---|---|---|
| `VITE_SUPABASE_URL` | **Yes** | Web Client (`MandiWeb.tsx`) | Vercel (Production & Preview) | ✅ **YES** | Supabase Project Gateway (e.g. `https://xyz.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | **Yes** | Web Client (`MandiWeb.tsx`) | Vercel (Production & Preview) | ✅ **YES** | Public anonymous JWT key (enforced by Supabase RLS) |
| `VITE_API_BASE_URL` | **Yes** | Web Client (`MandiWeb.tsx`, `ScannerWeb.tsx`) | Vercel (Production & Preview) | ✅ **YES** | URL of backend API host (e.g. `https://api.nukrop.ai` or `/api/v1`) |
| `VITE_API_URL` | Optional | Web Client (`client.ts`) | Vercel (Production & Preview) | ✅ **YES** | Root API origin for authenticated requests |
| `SUPABASE_SERVICE_ROLE_KEY` | **NO (FORBIDDEN ON VERCEL)** | Backend API / Mandi Worker | Host platform / GitHub Secrets only | ❌ **SERVER ONLY** | Bypasses all RLS. Must **NEVER** be on Vercel web frontend |
| `DATABASE_URL` | **NO (FORBIDDEN ON VERCEL)** | Backend Fastify / Mandi Worker | Host platform / GitHub Secrets only | ❌ **SERVER ONLY** | Direct PostgreSQL connection string |
| `DATA_GOV_IN_API_KEY` | **NO (FORBIDDEN ON VERCEL)** | Python Mandi Pipeline Sync | Backend / GitHub Actions Secrets | ❌ **SERVER ONLY** | Official data.gov.in Agmarknet API key |
| `GROQ_API_KEY` | **NO (FORBIDDEN ON VERCEL)** | Backend AI Vision Controller | Backend secret store only | ❌ **SERVER ONLY** | Multimodal Vision AI inference key |

### Environment Scope Separation

- **Vercel Production**: Configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_BASE_URL` pointing to production services.
- **Vercel Preview**: Configure the same variables, either pointing to staging or production read-only endpoints.
- **Backend Host (Render / Railway)**: Houses `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DATA_GOV_IN_API_KEY`, and `GROQ_API_KEY`.
- **GitHub Actions Secrets**: Houses `DATA_GOV_IN_API_KEY` and `DB_CONNECTION_STRING` for the twice-daily automated Agmarknet scheduler.

---

## 3. Security Headers & Content Security Policy (`vercel.json`)

NuKropAI enforces strict enterprise security headers via `web/vercel.json`:

```json
{
  "cleanUrls": true,
  "rewrites": [
    { "source": "/robots.txt", "destination": "/robots.txt" },
    { "source": "/sitemap.xml", "destination": "/sitemap.xml" },
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/NuKropAI(.*).apk",
      "headers": [
        { "key": "Content-Type", "value": "application/vnd.android.package-archive" },
        { "key": "Cache-Control", "value": "public, max-age=3600, must-revalidate" }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(self), microphone=(self), geolocation=(self)" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' http://localhost:* https://*.supabase.co wss://*.supabase.co https://api.data.gov.in; frame-ancestors 'none';"
        }
      ]
    }
  ]
}
```

### Protection Summary:
- **Clickjacking Protection**: `X-Frame-Options: DENY` and `frame-ancestors 'none'`.
- **MIME Sniffing Prevention**: `X-Content-Type-Options: nosniff`.
- **HSTS**: `Strict-Transport-Security` enforces HTTPS for 2 years with preloading.
- **CSP**: Restricts script execution to origin; allows Google Fonts, Supabase connections, and blob/image previews.
- **APK Caching**: Long-term immutable caching on hashed assets (`/assets/*`), but 1-hour revalidation on APK releases (`/NuKropAI*.apk`) so updates propagate promptly.

---

## 4. Privacy, Consent & DPDP Act 2023 Compliance

### 1. Indian Digital Personal Data Protection Act (DPDP Act 2023) Alignment
NuKropAI operates under a sovereign **Data Minimization Principle**:
- **Offline First**: Edge neural models run crop leaf diagnosis locally on mobile devices without transmitting foliar images to the cloud unless explicitly requested.
- **No Third-Party Ad Trackers**: Zero tracking pixels, commercial advertising cookies, or behavioral beacons.
- **Farmer Autonomy**: Geolocation is queried only on-demand to identify the nearest APMC yard. It is never tracked continuously in the background.

### 2. Browser Storage Disclosures

| Storage Key | Storage Mechanism | Type | Purpose |
|---|---|---|---|
| `nk_consent` | `localStorage` | Essential | Stores user consent choice (`essential` or `all`) and timestamp |
| `nk_token` | `localStorage` | Essential | Stores authenticated Supabase session JWT (only if farmer logs in) |
| `nk_refresh_token` | `localStorage` | Essential | Used for silent session refresh |
| `nk_lang` | `localStorage` | Functional | Stores vernacular dialect preference (Telugu, Hindi, Tamil, etc.) |
| `nk_mandi_*` | `localStorage` | Functional | Caches verified APMC rate queries for instant Stale-While-Revalidate |

### 3. User Consent Controls
- **Non-Deceptive Cookie Banner (`CookieConsent.tsx`)**: Appears on initial load with equally weighted buttons: **"Accept All"**, **"Essential Only"**, and **"Preferences"**.
- **Withdrawal of Consent**: Users can click **"Cookie Preferences"** in the footer at any time to modify or revoke consent.
- **Legal Overlays (`LegalModal.tsx`)**: Dedicated modal views for **Privacy Policy**, **Terms of Service**, and **Cookie & Storage Policy**. Accessible via footer links and the Command Menu (`Ctrl+K`).
- **Notice on Refund Policy**: NuKropAI is 100% free and open-access for smallholders. It does not sell subscriptions or physical goods. The Terms of Service and footer explicitly disclose that monetary refund policies are not applicable.

---

## 5. SEO, Social Previews & Discoverability

The production web build includes comprehensive search engine optimization:
1. **Semantic Hierarchy**: Single `<h1>` tag with structured `<h2>` and `<h3>` landmarks.
2. **Metadata**:
   - Title: `NuKropAI — Sovereign Agrarian Operating System & APMC Mandi Intelligence`
   - Description: Comprehensive summary highlighting offline AI vision diagnostics and verified Agmarknet rates.
   - Canonical URL: `<link rel="canonical" href="https://nukrop.vercel.app/" />`
3. **Open Graph & Twitter Cards**:
   - `og:title`, `og:description`, `og:image`, `og:url` configured for rich social cards on WhatsApp, Facebook, LinkedIn, and Twitter/X.
4. **Search Crawler Directives**:
   - `robots.txt`: Located at `web/public/robots.txt`, allowing universal indexing while disallowing `/api/`.
   - `sitemap.xml`: Located at `web/public/sitemap.xml`, indexing all key platform anchors (`#features`, `#mandi`, `#scanner`, `#architecture`, `#languages`, `#faq`).
5. **Favicon & Apple Touch Icons**: SVG agrarian emoji (`🌾`) rendering crisply on all DPI screens.

---

## 6. Advanced UI Interactions & Performance

### 1. Command Menu (`CommandMenu.tsx`)
- **Keybindings**: Triggered by `Cmd+K` (macOS), `Ctrl+K` (Windows/Linux), or clicking the search pill in the navbar.
- **Keyboard Navigation**: Up/Down arrow keys highlight actions; `Enter` activates; `Escape` closes.
- **Focus Management**: Traps focus inside the dialog while open, and returns focus to the invoking element on close.
- **Legitimate NuKropAI Actions**: Direct access to APK downloads, Mandi search shortcuts (Agra APMC Potato/Wheat, Nashik Onion, Warangal Cotton), AI scanner, Legal policies, and infrastructure status.

### 2. Skeleton Loaders (`Skeleton.tsx`)
- **Zero Layout Shifts**: Skeletons match the exact bounding boxes and layout of loaded Mandi cards and AI diagnosis summaries.
- **Shimmer Animation**: Linear gradient shimmer running at 1.8s.
- **Reduced Motion Support**: Automatically disables animation and applies static translucent backgrounds when `@media (prefers-reduced-motion: reduce)` is active.

### 3. Accessible Toast Notifications (`Toast.tsx`)
- **Roles & ARIA**: Wrapped in an accessible live region (`aria-live="polite"`, `role="status"`).
- **Notification Types**: Success (green), Error (red), Info (lime accent).
- **Undo Action**: Supports reversible operations with visible countdown and manual dismissal.

### 4. Tabular Figures & Touch Target Compliance
- **Tabular Figures**: Rates, currency values (`₹1,650`), percentage stats, and timestamps use `font-variant-numeric: tabular-nums` (`.tabular-nums`) to prevent jitter during live updates.
- **Touch Targets**: All buttons, links, and inputs enforce a minimum height of `44px` with `box-sizing: border-box`.
- **Notch Support**: Implements `safe-area-top` and `safe-area-bottom` utilities utilizing `env(safe-area-inset-*)`.

---

## 7. Step-by-Step Vercel Deployment Guide

### First-Time Deployment:
1. Log in to [Vercel](https://vercel.com) with your GitHub account (`B-JASWANTH-REDDY`).
2. Click **Add New...** -> **Project**.
3. Import the `B-JASWANTH-REDDY/NuKropAI` repository.
4. In **Project Settings**:
   - Set **Root Directory** to `web`.
   - Framework will automatically default to `Vite`.
5. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL`: Your Supabase project URL (`https://<project-ref>.supabase.co`).
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase public anonymous key.
   - `VITE_API_BASE_URL`: Your backend API URL (e.g., `https://api.nukrop.ai` or your deployed backend host).
6. Click **Deploy**. Vercel will install dependencies, run `sync-apk.js`, compile TypeScript via `tsc`, and build the production bundle via `vite build`.

### Custom Domain Configuration:
1. In Vercel Project Settings -> **Domains**:
2. Add your custom domain (e.g., `nukrop.ai` or `app.nukrop.ai`).
3. Configure DNS records at your domain registrar:
   - **Apex domain (`nukrop.ai`)**: `A` record pointing to `76.76.21.21`
   - **Subdomain (`app.nukrop.ai`)**: `CNAME` record pointing to `cname.vercel-dns.com`
4. Vercel automatically provisions and renews a free Let's Encrypt SSL certificate within 60 seconds.

---

## 8. Owner Action Checklist

### OWNER MUST DO:
1. **Import Project to Vercel**: Connect `B-JASWANTH-REDDY/NuKropAI` in the Vercel dashboard with Root Directory set to `web`.
2. **Add Client Environment Variables**: Input `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_BASE_URL` in Vercel settings.
3. **Configure Custom Domain & DNS**: Map registrar DNS CNAME/A records to Vercel if using a custom domain.
4. **Update Support / Grievance Email**: If desired, customize `grievance@nukrop.ai` in `LegalModal.tsx` to the owner's preferred operational email.
5. **Google Search Console**: Once the production domain is live, submit `https://<your-domain>/sitemap.xml` in Google Search Console.

### IMPLEMENTED & TESTED:
- [x] Web TypeScript compilation (`tsc`) and production Vite build passing with 0 errors.
- [x] Command Menu (`CommandMenu.tsx`) supporting Cmd+K, Arrow navigation, Escape, and focus management.
- [x] Accessible Toast notification system (`Toast.tsx`) with live regions and auto-dismiss.
- [x] Shimmer skeleton loaders (`Skeleton.tsx`) matching exact card dimensions without layout shifts.
- [x] Stale-While-Revalidate caching pattern in `MandiWeb.tsx` with honest provenance.
- [x] File type & 5MB size validation in `ScannerWeb.tsx` with ICAR pathology structure.
- [x] Legal modals (`LegalModal.tsx`) for DPDP Privacy Policy, Terms of Service, and Cookie disclosures.
- [x] Non-deceptive cookie consent banner (`CookieConsent.tsx`) with preference settings.
- [x] SEO enhancements: OpenGraph, Twitter Cards, `robots.txt`, `sitemap.xml`, and canonical tags.
- [x] `vercel.json` strict security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, and immutable asset caching.
- [x] Tabular numerals (`tabular-nums`), heading balance, and 44px touch targets.
- [x] Production APK synchronization (`sync-apk.js`) preserving genuine Android release artifacts.
