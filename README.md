# Axis — Daily Task Tracker for Growthians

A daily task tracking system for marketing teams. CEO can monitor submissions, approve leave/logoff requests, and manage the team. Employees track their work hour-by-hour, request leaves, manage personal lists, and override Saturday working days.

**Tech Stack:** React 18 · Vite · Tailwind CSS · Supabase (PostgreSQL + Auth + Realtime)

---

## Features

### For Everyone
- ✅ Split sign-in: separate CEO and Team Member flows
- ✅ Profile editing (name, designation, avatar emoji)
- ✅ Real-time notifications (in-app + browser)
- ✅ Calendar with company holidays + leave display

### For Employees
- ✅ Daily 3-column task sheet (Tasks Worked On / Day's Agenda / Task Pending)
- ✅ Customizable hourly time slots (30-min interval picker)
- ✅ Auto-save while typing, lock on submit
- ✅ Auto-calculate hours worked
- ✅ Weekly hours total (resets Monday)
- ✅ Personal Lists: daily todos + persistent notepad
- ✅ Leave requests with date range + half-day support
- ✅ Auto-credit 1 leave per month from May 2026 (max 12, carries forward)
- ✅ LOP (Loss of Pay) auto-flagged when balance exceeded
- ✅ Early logoff requests
- ✅ Click any Saturday in calendar to override Working/Off

### For CEO
- ✅ Team dashboard with today's submissions live
- ✅ Combined leave + logoff approval queue
- ✅ Drill-down view of any employee's submitted history
- ✅ Team management (deactivate users)
- ✅ Add company holidays
- ✅ See all employees' Saturday overrides on shared calendar
- ✅ First user to sign up automatically becomes CEO

---

## Deployment Guide

This guide assumes you have an existing GitHub repo + Vercel deployment (from a previous version) and want to **update** them with this new code. If you're starting fresh, the steps are the same — just create new GitHub repo and Vercel project at the right places.

### Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier is fine)
- A GitHub account
- A Vercel account (linked to your GitHub)

---

### Step 1: Set Up Supabase (10 minutes)

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. **Open your existing project** (the one your old `axis-app` deploys to)
3. Click **SQL Editor** in the sidebar → **+ New query**
4. Open `supabase/schema.sql` from this codebase
5. **Copy the ENTIRE file** and paste into the SQL Editor
6. Click **Run** (or Ctrl+Enter)
   - This drops all old tables and creates the new schema
   - You should see "Success. No rows returned" at the bottom
7. Go to **Project Settings → API**
8. Copy these two values:
   - `Project URL` (e.g., `https://abcdefgh.supabase.co`)
   - `anon public` key (long string starting with `eyJ...`)
9. Go to **Authentication → URL Configuration**
   - Set **Site URL** to your Vercel URL (e.g., `https://axis-app.vercel.app`)
   - Add the same URL to **Redirect URLs** if not already there

---

### Step 2: Replace Local Code (5 minutes)

In your local `axis-app` folder:

```bash
# Open your existing axis-app folder in your file explorer
# Delete or move OLD files (keep .git folder!)
# Then copy ALL files from this new codebase into the folder
```

**Important:** Don't delete the `.git` folder! That's what keeps your GitHub connection.

After copying, your folder should have:
- `src/` (all the new code)
- `supabase/` (with schema.sql)
- `package.json`, `vite.config.js`, `tailwind.config.js`, etc.
- `.git/` (untouched from before)

---

### Step 3: Configure Environment (2 minutes)

1. In your `axis-app` folder, copy `.env.example` to `.env.local`:

   ```bash
   cp .env.example .env.local
   ```

   On Windows (Notepad): create a new file named `.env.local` in the folder.

2. Open `.env.local` and paste your Supabase values:

   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
   ```

3. Save and close.

---

### Step 4: Install Dependencies & Test Locally (5 minutes)

```bash
npm install
npm run dev
```

This starts the app at `http://localhost:5173`.

**Test checklist:**
- [ ] Landing page shows role selector (CEO / Team Member)
- [ ] Click "CEO" → see CEO sign-in/sign-up
- [ ] Click "Sign up" link → fill in name/email/password → create account
- [ ] You should be logged in as CEO and see the dashboard
- [ ] Sign out works

If it works locally, proceed. If not, check:
- Browser console for errors (F12)
- `.env.local` has correct values (no quotes around values)
- Supabase schema ran successfully
- Restart `npm run dev` after editing `.env.local`

---

### Step 5: Push to GitHub (3 minutes)

```bash
git add .
git commit -m "Update to Axis v1 with full features"
git push origin main
```

(Replace `main` with `master` if your branch is called master.)

If git asks for credentials, log in via the prompt. If asked about merge conflicts, resolve them in your editor first.

---

### Step 6: Vercel Auto-Deploys (3 minutes)

1. Vercel detects the push and starts building automatically
2. Go to [vercel.com/dashboard](https://vercel.com/dashboard) → your project
3. Watch the build under **Deployments**
4. **Important:** Make sure your environment variables are set in Vercel:
   - Go to **Project Settings → Environment Variables**
   - Add (if missing):
     - `VITE_SUPABASE_URL` = your Supabase URL
     - `VITE_SUPABASE_ANON_KEY` = your anon key
   - Apply to: Production, Preview, Development
   - If you added/changed any var, click **Redeploy** on the latest deployment

5. Once deployed, click the URL → you should see the new role selector landing page.

---

### Step 7: Create Your CEO Account (2 minutes)

1. Open your live Vercel URL
2. Click **CEO** card
3. Click **"Sign up →"** at the bottom of the form
4. Fill in your name, email, password (min 6 chars)
5. Click **Create Account**
6. You're now the CEO. The system locks signup so no one else can become CEO.

---

### Step 8: Invite Your Team (5 minutes per member)

For each team member:

1. Go to your Supabase dashboard → **Authentication → Users**
2. Click **"Invite user"** (top right)
3. Enter their email and click Send
4. They receive an invite email with a link to set their password
5. Once they click and set a password, they're auto-added to your `users` table as an Employee
6. They go to your Vercel URL → click **Team Member** → sign in with their email/password

After they sign in:
- They appear on your CEO dashboard
- You can drill into their history once they submit days
- Their default profile says "Team Member" — they can edit it themselves in Profile tab

---

### Step 9: Done! Share the URL With Your Team

Give your team:
- The Vercel URL
- Their email (the one you invited)
- The password they set

Tell them to click **"Team Member"** on the landing page.

---

## Local Development

```bash
npm install         # Install dependencies
npm run dev         # Start dev server at localhost:5173
npm run build       # Build for production
npm run preview     # Preview production build locally
```

---

## Troubleshooting

### "Supabase env vars missing" in console
Your `.env.local` is missing or has wrong values. Check the file exists in the project root (not in src/) and has both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

### Build succeeds but app doesn't work on Vercel
You probably forgot to set environment variables in Vercel. Go to Project Settings → Environment Variables → add both vars → Redeploy.

### "Failed to fetch" or CORS errors
- Check your Supabase URL doesn't have a trailing slash
- Make sure you ran the schema in the right Supabase project
- Verify Site URL is set in Supabase Auth → URL Configuration

### Team member can't sign in
- Did they receive the invite email? (Check spam)
- Did they set a password via the invite link?
- Are they clicking "Team Member" on the landing page?
- Check Supabase → Authentication → Users — is their account confirmed?

### Leaves not auto-crediting
- Auto-credit only runs from May 1, 2026 onwards
- It runs automatically when an employee signs in
- Check the user's `last_credited_month` field in Supabase to see when they were last credited

### Can't sign in as CEO
- Only the FIRST user signup becomes CEO
- If you've signed up but role shows as "employee", manually update in Supabase:
  - Go to Table Editor → users table → find your row
  - Change `role` from `employee` to `ceo` → Save

---

## Project Structure

```
axis-app/
├── supabase/
│   └── schema.sql              # Complete database schema
├── src/
│   ├── lib/
│   │   ├── supabase.js         # Supabase client
│   │   ├── helpers.js          # Date/time/hours helpers
│   │   ├── leaveCredit.js      # Auto-credit RPC caller
│   │   └── avatars.js          # Emoji avatar presets
│   ├── contexts/
│   │   ├── AuthContext.jsx     # Sign in/up/out + role validation
│   │   ├── NotifContext.jsx    # Realtime notifications
│   │   └── ToastContext.jsx    # In-app toasts
│   ├── components/
│   │   ├── Layout.jsx          # Header, nav, notifications
│   │   ├── ui.jsx              # Modal, Button, Input, etc.
│   │   ├── AuthForm.jsx        # Reusable auth form
│   │   ├── DailyTaskGrid.jsx   # Read-only 3-column grid
│   │   └── SlotsManagerModal.jsx
│   ├── pages/
│   │   ├── AuthRoleSelector.jsx
│   │   ├── AuthCEO.jsx
│   │   ├── AuthEmployee.jsx
│   │   ├── EmployeeTodaySheet.jsx
│   │   ├── EmployeeLists.jsx
│   │   ├── EmployeeLeave.jsx
│   │   ├── EmployeeLogoff.jsx
│   │   ├── EmployeeHistory.jsx
│   │   ├── CalendarPage.jsx
│   │   ├── Profile.jsx
│   │   ├── CEODashboard.jsx
│   │   ├── CEOMemberView.jsx
│   │   ├── CEOApprovals.jsx
│   │   └── CEOTeam.jsx
│   ├── App.jsx                 # Router + providers
│   ├── main.jsx                # React entry
│   └── index.css               # Tailwind base
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── index.html
├── .env.example
└── .gitignore
```

---

## License

Private — built for Growthians Marketing.
