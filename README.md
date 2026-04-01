# NIGHT OUT RACE CONTROL

A premium, dead-serious dashboard that treats a night out like a race weekend.

## Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS v4
- Motion for React
- Lightweight Charts

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## What is included

- Landing page with hero presentation and load-last-session flow
- Pre-race setup screen with driver inputs and qualifying preview
- Live race control dashboard with:
  - top status bar
  - metrics classification column
  - track map
  - six dominant KPI cards
  - four telemetry charts
  - incident feed
  - strategy notes
  - team radio panel
- Post-race debrief screen
- Local session persistence in `localStorage`
- Deterministic fake-data simulation with correlated inputs

## Notes

- Session data is intentionally fake but internally correlated.
- The simulation is seeded from driver, team, track and session type, so the same setup produces a consistent storyline.
- If you deploy publicly and keep Lightweight Charts in production, review its attribution requirements.
