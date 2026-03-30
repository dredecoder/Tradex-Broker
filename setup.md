# TradeEx — Full Project Architecture

## Overview
TradeEx is a US-focused investment broker platform built with HTML/CSS/JS, Supabase, GitHub, and Vercel.
Theme: Navy Blue + Red, Light & Dark mode. Icons: Lucide. Charts: TradingView.

---

## Color System

```css
/* LIGHT MODE */
--primary:       #0A2342;   /* Deep Navy Blue */
--primary-light: #1B4F8A;   /* Mid Navy */
--accent:        #B22234;   /* American Red */
--accent-light:  #E8364A;   /* Bright Red */
--bg:            #F4F6FA;   /* Off-white background */
--surface:       #FFFFFF;   /* Card surface */
--text:          #0A2342;   /* Primary text */
--text-muted:    #6B7B99;   /* Muted text */
--border:        #D0D9EA;   /* Border */
--success:       #1A7F4B;   /* Green */
--warning:       #D4820A;   /* Amber */

/* DARK MODE */
--primary:       #0E3460;   /* Dark Navy */
--primary-light: #1B4F8A;
--accent:        #E8364A;
--bg:            #060E1F;   /* Very dark navy */
--surface:       #0D1B2E;   /* Dark card */
--text:          #EDF2FF;
--text-muted:    #7A90B5;
--border:        #1A2E4A;
```

---

## Folder Structure

```
tradex/
│
├── index.html                  # Landing page
├── login.html                  # Login page
├── register.html               # Registration page
│
├── dashboard/
│   └── index.html              # Main user dashboard
│
├── deposit/
│   └── index.html              # Deposit funds page
│
├── withdraw/
│   └── index.html              # Withdrawal request page
│
├── portfolio/
│   └── index.html              # Portfolio & investments
│
├── transactions/
│   └── index.html              # Transaction history
│
├── plans/
│   └── index.html              # Investment plans
│
├── profile/
│   └── index.html              # User profile & settings
│
├── admin/
│   ├── index.html              # Admin dashboard
│   ├── users.html              # Manage users
│   ├── transactions.html       # Approve/reject transactions
│   ├── plans.html              # Manage investment plans
│   └── settings.html           # Platform settings
│
├── assets/
│   ├── css/
│   │   ├── main.css            # Global styles, variables, reset
│   │   ├── theme.css           # Light/dark theme toggle
│   │   ├── components.css      # Buttons, cards, inputs, badges
│   │   └── layout.css          # Sidebar, navbar, grid
│   │
│   ├── js/
│   │   ├── supabase.js         # Supabase client init
│   │   ├── auth.js             # Login, register, logout, session
│   │   ├── dashboard.js        # Dashboard data & charts
│   │   ├── deposit.js          # Deposit logic
│   │   ├── withdraw.js         # Withdrawal logic
│   │   ├── portfolio.js        # Portfolio & plan data
│   │   ├── transactions.js     # Transaction history
│   │   ├── profile.js          # Profile CRUD
│   │   ├── plans.js            # Investment plans display
│   │   ├── admin.js            # Admin panel logic
│   │   ├── theme.js            # Light/dark mode toggle
│   │   └── utils.js            # Shared helpers (format $, dates etc)
│   │
│   └── img/
│       ├── logo.svg            # TradeEx logo
│       └── favicon.ico
│
├── .env                        # Supabase keys (never commit)
├── vercel.json                 # Vercel routing config
└── README.md
```

---

## Supabase Database Schema

### `profiles` table
| Column | Type | Notes |
|---|---|---|
| id | uuid | FK → auth.users |
| full_name | text | |
| email | text | |
| phone | text | |
| country | text | |
| avatar_url | text | |
| kyc_status | enum | pending / verified / rejected |
| two_fa_enabled | boolean | |
| created_at | timestamp | |

### `wallets` table
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → profiles |
| balance | numeric | USD balance |
| bonus | numeric | Bonus balance |
| total_invested | numeric | |
| total_profit | numeric | |
| updated_at | timestamp | |

### `investment_plans` table
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | e.g. Basic, Pro, Elite |
| min_amount | numeric | |
| max_amount | numeric | |
| roi_percent | numeric | e.g. 10 |
| duration_days | int | e.g. 7 |
| is_active | boolean | |

### `investments` table
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → profiles |
| plan_id | uuid | FK → investment_plans |
| amount | numeric | |
| profit | numeric | |
| start_date | timestamp | |
| end_date | timestamp | |
| status | enum | active / completed / cancelled |

### `transactions` table
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → profiles |
| type | enum | deposit / withdrawal / profit / bonus |
| amount | numeric | |
| status | enum | pending / approved / rejected |
| method | text | BTC / USDT / Bank |
| proof_url | text | Upload receipt |
| note | text | Admin note |
| created_at | timestamp | |

### `notifications` table
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | |
| message | text | |
| is_read | boolean | |
| created_at | timestamp | |

---

## Authentication Flow (Supabase Auth)

```
Register → Email Verify → Profile Created (trigger) → Wallet Created (trigger) → Dashboard
Login → Session Check → Route to Dashboard or Admin
```

- Supabase Row Level Security (RLS) on all tables
- Admin role set via `profiles.role` column (user / admin)
- Protected routes: JS checks session on every page load

---

## Pages Breakdown

| Page | Auth Required | Role |
|---|---|---|
| index.html (Landing) | No | Public |
| login.html | No | Public |
| register.html | No | Public |
| dashboard/ | Yes | User |
| deposit/ | Yes | User |
| withdraw/ | Yes | User |
| portfolio/ | Yes | User |
| transactions/ | Yes | User |
| plans/ | Yes | User |
| profile/ | Yes | User |
| admin/* | Yes | Admin only |

---

## Deployment Stack

| Tool | Purpose |
|---|---|
| GitHub | Version control, source of truth |
| Vercel | Auto-deploy from GitHub, hosting |
| Supabase | Auth + Database + Storage + RLS |
| TradingView | Embedded market charts (free widget) |
| Lucide Icons | UI icons via CDN |

### Vercel Config (`vercel.json`)
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/$1" }
  ]
}
```

---

## Build Order (Step-by-Step)

| Step | Task |
|---|---|
| 1 | Global CSS (variables, reset, components, layout) |
| 2 | Landing page (index.html) |
| 3 | Login & Register pages |
| 4 | Supabase setup (tables, RLS, auth triggers) |
| 5 | Dashboard page |
| 6 | Deposit page |
| 7 | Withdrawal page |
| 8 | Investment Plans page |
| 9 | Portfolio page |
| 10 | Transaction History page |
| 11 | Profile & Settings page |
| 12 | Admin Panel (all pages) |
| 13 | Notifications system |
| 14 | Light/Dark theme toggle |
| 15 | Deploy to Vercel + GitHub |

---

## Security Checklist

- [ ] Supabase RLS enabled on all tables
- [ ] Admin role check on every admin page load
- [ ] No API keys in frontend code (use Supabase anon key only)
- [ ] Input sanitization on all forms
- [ ] 2FA support via Supabase
- [ ] HTTPS enforced via Vercel
- [ ] File upload validation (KYC docs, deposit proofs)

---

## Notes
- All monetary values stored in USD (numeric, 2 decimal places)
- Investment profit calculated server-side via Supabase Edge Functions or cron
- TradingView widget embedded via iframe (free, no API key needed)
- Theme preference saved to localStorage
