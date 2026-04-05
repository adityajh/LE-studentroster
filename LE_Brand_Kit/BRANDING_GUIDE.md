# Let's Enterprise (LE) Brand & UI Kit

This guide serves as the source of truth for designing new Let's Enterprise applications. It extracts the visual identity, Tailwind CSS utilities, typography, and layout philosophies used in the LE Assessment System to ensure a consistent, premium feel across all future products.

---

## 1. Brand Identity & Logos

Always use the official high-resolution branding assets.

*   `assets/Let's-Enterprise-Final-Logo_PNG.png` (Dark logo, for use on light backgrounds like slate-50 or white)
*   `assets/Let's-Enterprise-Final-Logo_LightMode.png` (Light/White logo, for use on dark backgrounds like slate-900)

**Sizing Defaults:**
*   Admin Sidebars: `h-[80px]` (Dark logo)
*   Dashboard Headers: `h-[80px]` to `h-[100px]` (Light logo on dark headers)
*   Action: Do not squeeze or distort the aspect ratio. Use `object-contain`.

---

## 2. Typography

We rely on modern, clean sans-serif typography, leaning heavily on Tailwind's default sans stack (Inter/system-ui) but utilizing distinct weight scales to establish hierarchy.

*   **Primary Font:** System Sans / Inter (`font-sans`)
*   **Headings:** Extremely bold. We use `font-black` (900) and `font-extrabold` (800).
    *   *Example:* `<h1 className="text-4xl font-extrabold text-slate-900 mb-1">`
*   **Subheadings / Functional Text:** `text-[10px] uppercase tracking-widest font-bold`. This "eyebrow" text style is a signature LE look for categorizing data cards (e.g., `PROGRAM FOCUS`, `STUDENT ID`).
*   **Body Text:** `font-medium text-slate-600` or `text-slate-500`. We rarely use completely un-styled normal (`font-normal`) text.

---

## 3. Color Palette (Tailwind Next.js)

The LE aesthetic is defined by dark, rich slates paired with vibrant, semantic accent colors. **Do not use generic gray.** Always use `slate`.

### 3.1 Base Colors (Surfaces & Backgrounds)
*   **App Backgrounds (Light):** `bg-slate-50` (soft off-white) and `bg-white`.
*   **App Backgrounds (App/Admin):** `bg-slate-900` or `bg-slate-950`.
*   **Text (Dark Mode/Headers):** `text-slate-200`, `text-slate-300`, `text-slate-400`.
*   **Text (Light Mode):** `text-slate-900`, `text-slate-700`, `text-slate-500`.
*   **Borders:** `border-slate-200` (light) or `border-slate-700/50` (dark).

### 3.2 Primary Accents (The LE Toolkit)
We do not use a single primary color. Instead, we use a curated set of vibrant Tailwind colors for charting, zones, and highlights:
*   **Indigo:** `indigo-500`, `indigo-600` (Primary action flavor, self-assessment dots).
*   **Emerald:** `emerald-400`, `emerald-500` (Positive, Leading behavior, Strengths).
*   **Amber:** `amber-400`, `amber-500` (Warning, Connecting behavior, Client feedback).
*   **Cyan:** `cyan-400`, `cyan-500` (Neutral/Positive secondary).
*   **Rose/Red:** `rose-500`, `red-400` (Negative, Syncing behavior, Growth Areas).
*   **Fuchsia/Purple:** `fuchsia-500`, `purple-500` (Innovation readiness).

---

## 4. UI Paradigms & Card Layouts

### 4.1 The "Glass / Soft Card"
In both admin panels and dashboards, container cards have defined borders and distinct rounded corners.

**Light Mode Card:**
```jsx
<div className="bg-white border border-slate-200/50 p-6 rounded-2xl relative shadow-sm">
  {/* Content */}
</div>
```

**Dark Mode Admin Card:**
```jsx
<div className="bg-slate-800/80 border border-slate-700 rounded-xl overflow-hidden p-6">
  {/* Content */}
</div>
```

### 4.2 Badges & "Pills"
For data counts or statuses, use soft background pills.
*   *Emerald Example:* `bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded font-medium border border-emerald-500/20`
*   *Amber Example:* `bg-amber-500/10 text-amber-400 px-2 py-1 rounded ...`

### 4.3 Form Inputs
*   Inputs should have distinct borders that highlight on focus.
*   *Example:* `bg-white border-2 border-slate-300 !text-slate-900 !font-bold h-12 focus:border-indigo-600 transition-all rounded-xl`

---

## 5. Charting Colors (Recharts)

When building new charts (Bar, Radar, Scatter), use this exact semantic distribution to maintain meaning across apps:

**The 6 Readiness Domains Scale:**
1.  Commercial: `#f59e0b` (Amber)
2.  Entrepreneurial: `#10b981` (Emerald)
3.  Marketing: `#ec4899` (Pink)
4.  Innovation: `#8b5cf6` (Violet)
5.  Operational: `#3b82f6` (Blue)
6.  Professional: `#14b8a6` (Teal)

**Assessment Types:**
*   Mentor: `#6366f1` (Indigo)
*   Self: `#cbd5e1` (Slate)
*   Client: `#f59e0b` (Amber)

---

## 6. Layout Philosophy

1.  **MaxWidth Containers:** Content should not stretch infinitely. Dashboards use `max-w-[1200px]` or `max-w-[1400px]` centered via `mx-auto`.
2.  **Dense Data, Clean Look:** Use uppercase, wide-spaced small fonts (`text-[10px] tracking-widest`) for table headers or labels to allow the actual data (which should be `text-sm` or `text-lg` and `font-bold`) to stand out.
3.  **Print Optimization:** If an app generates reports, always include `print:` tailwind modifiers.
    *   Hide nav: `print:hidden`
    *   Force breaks: `print:break-inside-avoid`, `print:break-before-page`
    *   Remove backgrounds to save ink: `print:bg-white`, `print:shadow-none`.
