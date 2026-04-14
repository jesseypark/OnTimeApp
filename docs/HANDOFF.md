# Handoff

Current state of the project as of 2026-04-14.

---

## What's complete and working

- **Core calculation** — origin/destination input, GPS auto-detect, event date/time picking, prep time, drive time + traffic from Google Maps Directions API, leave time result with breakdown (Drive / Traffic / Prep / Buffer tiles).
- **Places Autocomplete** — both origin and destination fields use Google Places API v1 with 500ms debounce and inline suggestion lists.
- **Notifications** — preset + custom offset selection, scheduling via `expo-notifications`, active notification chips with per-notification cancel. Android channel configured for max importance + bypass DND.
- **Web support** — app runs in the browser. Date/time pickers use HTML `<input>` elements on web via `DateTimePickerWrapper.web.tsx`. Android-only notification channel code is platform-guarded.
- **App icon + splash** — custom clock icon and warm beige (`#f5f0e8`) splash, both light and dark variants configured.
- **EAS project configured** — `projectId` in `app.json`, Android package `com.jesseypark.ontimeapp`.
- **App store assets** — `feature-graphic.png` and `icon-512.png` present in `assets/images/`.

---

## What looks in progress or incomplete

- **`app/modal.tsx`** — contains placeholder text ("This is a modal") and is not linked to any button or navigation action in the UI. Either needs content or should be deleted.
- **Latest commit message** — `vX - XXXXXXusability improvements...` has placeholder `XXXXXX` text, suggesting the version/release process was interrupted mid-commit.

---

## Dead code / cleanup candidates

These are all leftover from the Expo default template and are not used anywhere in the actual app:

- `components/hello-wave.tsx`
- `components/parallax-scroll-view.tsx`
- `components/haptic-tab.tsx`
- `components/external-link.tsx`
- `components/ui/collapsible.tsx`
- `app/modal.tsx` (also unused at runtime)
- `assets/images/partial-react-logo.png`, `react-logo.png`, `react-logo@2x.png`, `react-logo@3x.png`
- `canvas` package in `package.json` — a Node.js canvas implementation, not imported anywhere in the app

---

## Known issues / things to watch

- **API key exposure** — `EXPO_PUBLIC_GOOGLE_MAPS_KEY` is inlined into the JS bundle and visible to anyone who inspects it. The key should have HTTP referrer or app restrictions in Google Cloud Console if this app is public.
- **Notification scheduling on web** — `expo-notifications` web support is partial. Scheduling via `TIME_INTERVAL` trigger uses browser Notifications API but behavior varies by browser. No fallback or user messaging if it fails silently.
- **Single debounce timer for both input fields** — typing in origin cancels a pending suggestion fetch for destination and vice versa. Unlikely to cause real problems but worth noting.
- **No input validation on prep time** — `parseInt(prepTime) || 0` silently defaults to 0 for non-numeric input. No error message shown to the user.
- **`display="calendar"` on date picker** — the native `DateTimePicker` receives `display="calendar"` for the date mode. On Android this renders the calendar view; on iOS `"calendar"` is not a valid display value (valid values are `"default"`, `"spinner"`, `"inline"`, `"compact"`) — iOS silently ignores it and uses the default.
- **No persistence** — all state is in-memory. Closing the app loses origin, destination, event time, and any scheduled notifications (the notifications themselves are scheduled with the OS and will still fire, but the UI chips will be gone on next open).

---

## Environment

- Node: v25.9.0 (detected at runtime)
- Expo SDK: 54
- React Native: 0.81.5
- React: 19.1.0
- EAS project ID: `635f29ad-cc5d-4bf5-ad3e-d2e35e29a48a`
- Dev server: `npx expo start` (default port 8081; use `--port` if occupied)
