# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Before starting work

Always read the `/docs` folder before starting any work:
- `docs/PROJECT_MAP.md` — architecture overview, key files, how things connect
- `docs/DECISIONS.md` — non-obvious design choices and why they were made
- `docs/HANDOFF.md` — current state, what's complete, what's in progress, known issues

## After finishing work

Update the relevant docs file(s) to reflect what changed. If you added a feature, touched a key file, made a design decision, or changed project state — update the docs so the next session starts with an accurate picture.

## Commands

```bash
# Start development server
npx expo start

# Run on specific platform
npx expo start --ios
npx expo start --android
npx expo start --web

# Lint
npx expo lint
```

There is no test suite configured.

## Architecture

**OnTimeApp2** is an Expo (React Native) app that calculates when a user needs to leave to arrive somewhere on time. Users enter an origin, destination, arrival date/time, and prep tasks — the app calls Google Maps Directions API (with traffic), computes a leave time and start-getting-ready time, and schedules push notifications (Android only). Deployed on web via Vercel (`ontime-app-tan.vercel.app`).

### Key files

- `app/index.tsx` — The entire app's core logic: location autocomplete, GPS detection, date/time picking, drive time calculation, and notification scheduling. Single large component, all state local.
- `app/_layout.tsx` — Root Stack navigator with theme provider.
- `app/modal.tsx` — Placeholder modal screen, not linked to anything in the UI.
- `components/DateTimePickerWrapper.tsx` — Re-exports native date picker for iOS/Android.
- `components/DateTimePickerWrapper.web.tsx` — HTML `<input type="date|time">` fallback for web.
- `constants/theme.ts` — Color palette and platform-specific fonts.

### External APIs

Both APIs are accessed directly from the client using `EXPO_PUBLIC_GOOGLE_MAPS_KEY` (set in `.env`):

- **Google Maps Directions API** — fetches drive time + traffic delay for the origin→destination route.
- **Google Places Autocomplete API (v1)** — powers the location input fields with debounced (500ms) suggestions.

### Notifications

Android only via `expo-notifications`. The user selects preset offsets (0, 5, 10, 15, 30, 60, 120 min before leave time) or enters a custom offset. Notifications are based on leave time, not prep start time. Non-Android platforms show a text note. Android notification channel setup is guarded with `Platform.OS === 'android'`.

### Navigation

Expo Router file-based routing. Single route: `/` (home). Modal at `/modal` exists but is not reachable from the UI.

### State management

No global state library. All state is local to `app/index.tsx`. Key state: `origin`/`destination`/`originCoords`, `eventDate`, `prepTasks` (named tasks before leaving), `alongTasks` (extra time after leaving), `bufferEnabled` (toggleable 5 min buffer), `result` (computed leave time + prep start time + breakdown), `scheduledNotifs`.

### Platform notes

- `components/DateTimePickerWrapper.tsx` / `.web.tsx` — platform-split date picker
- `icon-symbol.ios.tsx` — SF Symbols for iOS; `icon-symbol.tsx` — Material Icons fallback for Android/web.
- `hooks/use-color-scheme.web.ts` — Web override for color scheme detection.
- `app.json` `web.output` is `"single-page"` (not `"static"`) to avoid SSR issues with `expo-notifications`.
- Fonts: SF Pro (iOS system) vs. web fonts, configured in `constants/theme.ts`.
