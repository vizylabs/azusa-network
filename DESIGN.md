# Design System: The Azusa Network (`azusanetwork.com`)

## 1. Visual Theme & Atmosphere
**Design Thesis:** *Editorial Covenant & Revival Heritage.*
Most ministry and network websites fall into one of two traps: dated church-template builder pages (like the current GoDaddy placeholder on `azusanetwork.com`) or generic Silicon Valley SaaS templates with glowing gradients, three-card feature rows, and fabricated metrics.

Instead, **The Azusa Network** draws directly from the tactile print heritage of its physical brochure and the historic weight of the 1906 Azusa Street revival movement paired with modern apostolic leadership under Dr. Scott Reece. The interface reads like an **architectural monograph and leadership journal** — anchored by deep Prussian/Covenant Navy (`#123152`), Warm Revival Ochre (`#C49E52`), and Warm Parchment (`#EFECE4`), with vertical structural columns inspired by the physical brochure's asymmetric ribbon layout.

- **Density:** 5/10 (Editorial & Relational — generous breathing room balanced with structured membership tiers, credentialing tracks, and regional gathering schedules)
- **Variance:** 7/10 (Asymmetric vertical column ribbons, split-screen editorial hero, ledger-style membership comparison rather than generic SaaS pricing cards)
- **Motion:** 4/10 (Restrained, dignified CSS transitions — subtle cubic-bezier reveals and tactile button states; zero gimmicky floating badges or neon glows)

---

## 2. Color Palette & Roles
Derived directly from the official Azusa Network print brochure and calibrated for WCAG AA/AAA contrast:

- **Covenant Navy** (`#112E4F`) — Primary structural background for hero, navigation, and deep editorial sections
- **Midnight Sanctuary** (`#0B1F36`) — Deepest grounding tone for footer, modal backdrops, and active ledger borders
- **Warm Parchment** (`#F4F1E8`) — Primary light reading surface for long-form editorial, leadership covenant, and application flows
- **Alabaster Stone** (`#EAE5D7`) — Secondary surface for subtle container separation and asymmetrical offset blocks (matching the upper-right block of the brochure)
- **Revival Ochre** (`#C49E52`) — Singular signature accent (from the brochure's central vertical column); used for the Apostle Scott Reece quote ribbon, primary CTAs, and active tier indicators
- **Burnished Gold** (`#A68138`) — Hover/active state for Revival Ochre elements and subtle borders
- **Charcoal Scripture** (`#18222F`) — Primary ink on Warm Parchment surfaces
- **Muted Slate** (`#526071`) — Secondary prose and metadata on light surfaces
- **Parchment Mist** (`#DCE3EC`) — Body text on Covenant Navy surfaces

---

## 3. Typography Rules
Following `frontend-design` and `taste-design` rules, we pair an authoritative, high-character editorial serif (mirroring the italic serif quote on the brochure) with a crisp geometric sans-serif (mirroring the tracked sans-serif headings on the brochure) and a precision monospace for covenant dues, dates, and reference numbers:

- **Editorial Display & Pull Quotes:** `'Cormorant Garamond'`, Georgia, serif — Used for editorial headlines, Apostle Scott Reece's foundational quote, and covenant statements. Italic weights (`500i`, `600i`) echo the exact print brochure typography.
- **UI, Structural Headings & Body:** `'Plus Jakarta Sans'`, -apple-system, sans-serif — Clean, humanist geometric sans-serif with strong uppercase structural presence for section headers (`OUR CORE VALUES`, `YOU DON'T HAVE TO RUN ALONE`) and effortless legibility at `1rem`–`1.0625rem` (`65ch` max line length).
- **Ledger & Metadata Mono:** `'JetBrains Mono'`, monospace — Used strictly for membership dues, billing cadences, event dates, and ordination cohort codes.

**Typographic Anti-Patterns Enforced:**
- Never highlight a single random word in a headline with a gradient or italic color change.
- Never use `Inter` or generic system defaults.
- Never stack meaningless uppercase eyebrows above every single heading.

---

## 4. Layout & Structural Architecture
1. **Asymmetric Brochure-Ribbon Hero:**
   Instead of a centered SaaS hero, the hero adapts the physical brochure's iconic 3-zone vertical composition into a live architectural grid:
   - Left column: Brand manifesto, primary headline (*"You Don't Have to Run Alone"*), and direct covenant membership entry.
   - Center vertical ribbon (in Revival Ochre `#C49E52` with notched editorial geometry): Apostle Scott Reece's signature quote and the watermarked Azusa Flame emblem.
   - Right column: Live network pulse — upcoming regional gatherings, apostolic mentoring cohorts, and direct access to the Member Portal.
2. **Core Values as an Architectural Ledger (Not 3 Equal SaaS Cards):**
   Presents **Relational Mentoring**, **Spiritual Accountability**, and **Effective Leadership** in an asymmetric editorial split with large structural dividers and concrete ministry outcomes (covering, self-governance, church planting, and leadership equipping).
3. **Network Subscriptions & Covenant Partnership Tiers:**
   Designed as a dignified **Ministry Partnership & Subscription System** (Monthly / Annual toggle with 15% annual stewardship savings, plus custom church tithe/partnership options):
   - **Individual Leader / Emerging Minister Tier ($29/mo)** — For pastors, ministry directors, and marketplace leaders seeking relational mentoring, monthly apostolic roundtables, and resource library access.
   - **Ordained & Credentialed Minister Tier ($59/mo)** — Full ministerial credentials, ecclesiastical covering, 1-on-1 apostolic mentorship cohorts, annual gathering pass, and crisis care support.
   - **Affiliated Church & Ministry Network Tier ($149/mo)** — Complete church/ministry affiliation while honoring local self-governance; includes staff leadership training, apostolic presbytery visits, church planting resources, and full media/equipping library for the leadership team.
4. **Interactive Subscription & Application Checkout Flow + Member Portal Preview:**
   - Interactive tier selection, monthly/annual billing cadence switcher, interactive multi-step Covenant Application & Subscription modal (with Stripe-style card/ACH preview and instant confirmation), plus an interactive **Leader & Member Portal view** showing live mentoring roundtables, credentialing status, and downloadable ministry resources.

---

## 5. Anti-Patterns (Strictly Banned)
- No AI purple/blue neon gradients or glowing buttons.
- No emojis anywhere in the UI — custom architectural SVG iconography and the authentic Azusa Flame mark only.
- No fake SaaS metrics ("99.9% Uptime", "10x Ministry Growth").
- No 3-equal-rounded-cards boilerplate with identical drop shadows.
