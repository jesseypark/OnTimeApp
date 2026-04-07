# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

**OnTimeApp2** is an Expo (React Native) app that calculates when a user needs to leave to arrive on time. Users enter an origin, destination, event date/time, and prep buffer — the app calls Google Maps Directions API (with traffic), computes a leave time, and schedules push notifications.

### Key files

- `app/(tabs)/index.tsx` — The entire app's core logic lives here: location autocomplete, GPS detection, date/time picking, drive time calculation, and notification scheduling. This is a single large component with all state managed locally via `useState`/`useEffect`.
- `app/(tabs)/explore.tsx` — Static help/documentation screen with collapsible sections.
- `app/_layout.tsx` — Root Stack navigator with theme provider.
- `app/(tabs)/_layout.tsx` — Bottom tab navigator (Home + Explore tabs).
- `constants/theme.ts` — Color palette and platform-specific fonts.

### External APIs

Both APIs are accessed directly from the client using `EXPO_PUBLIC_GOOGLE_MAPS_KEY` (set in `.env`):

- **Google Maps Directions API** — fetches drive time + traffic delay for the origin→destination route.
- **Google Places Autocomplete API** — powers the location input fields with debounced (500ms) suggestions.

### Notifications

Uses `expo-notifications`. The user selects preset offsets (0, 5, 10, 15, 30, 60, 120 min before leave time) or enters a custom offset. Scheduled notification IDs are tracked in state (`scheduledNotifs`) so individual notifications can be cancelled. A `useEffect` listener updates the UI when a notification fires.

### Navigation

Expo Router file-based routing. Two routes: `/` (home) and `/explore`. Modal available at `/modal` but unused in practice.

### State management

No global state library. All state is local to `app/(tabs)/index.tsx`. Key state: `origin`/`destination`/`originCoords`, `eventDate`, `prepTime`, `result` (computed leave time + breakdown), `scheduledNotifs`.

### Platform notes

- `icon-symbol.ios.tsx` — SF Symbols for iOS; `icon-symbol.tsx` — Material Icons fallback for Android/web.
- `hooks/use-color-scheme.web.ts` — Web override for color scheme detection.
- Fonts: SF Pro (iOS system) vs. web fonts, configured in `constants/theme.ts`.
