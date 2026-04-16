# Handoff

Current state of the project as of 2026-04-15. Last updated 2026-04-15.

## Session summary (2026-04-15, v12 — Play Store fixes)

- **EAS env secret configured** — `EXPO_PUBLIC_GOOGLE_MAPS_KEY` added to EAS production environment via `eas env:create`. Play Store builds were missing the API key (`.env` is local-only), causing autocomplete to silently fail.
- **Past event time validation** — `calculateLeaveTime` now checks if `eventDate` is in the past and shows an error instead of sending an invalid `departure_time` to the Directions API (which returns `INVALID_REQUEST`).
- **Improved API error messages** — autocomplete errors now surface HTTP status and detail message. Directions errors now include the raw API status (e.g. `ZERO_RESULTS`, `INVALID_REQUEST`) so users and testers can report meaningful diagnostics.
- **New production build** — `eas build --platform android --profile production`, versionCode 4. AAB artifact at `https://expo.dev/artifacts/eas/nVcnWDu1QtPVB7svBfb4Xn.aab`.
- Committed + pushed as `fix: add past event time validation and improve API error messages`.

---

## Session summary (2026-04-15, v11)

- Fixed web CORS failure on "Calculate Leave Time" by loading the Google Maps JS SDK and using `DirectionsService.route()` on web. Native keeps the REST call via axios.
- Event date / time cards on web now open the browser's native picker directly (`showPicker()` on a hidden `<input>`) instead of showing a second box below the card.
- Added web notification support using `Notification` API + `setTimeout` (expo-notifications throws on web). Cancel clears the timeout by id.
- Added a 10s timeout on web Directions so the spinner can't hang when the Maps JS API is disabled.
- Bumped `version` to `1.0.1` and added `android.versionCode: 2` in `app.json` (Play Console rejects duplicate version codes).
- Enabled **Maps JavaScript API** on the Google Cloud project for `EXPO_PUBLIC_GOOGLE_MAPS_KEY` (required for web).
- Built a new AAB via `eas build --platform android --profile production` for closed testing (all countries).
- Committed + pushed as `v11 - web CORS fix, web notifications, direct date/time picker`.

---

## What's complete and working

- **Core calculation** — origin/destination input, GPS auto-detect, event date/time picking, prep time, drive time + traffic from Google Maps Directions API, leave time result with breakdown (Drive / Traffic / Prep / Buffer tiles).
- **Places Autocomplete** — both origin and destination fields use Google Places API v1 with 500ms debounce and inline suggestion lists.
- **Notifications** — preset + custom offset selection, scheduling via `expo-notifications` on native and via `Notification` API + `setTimeout` on web, active notification chips with per-notification cancel. Android channel configured for max importance + bypass DND.
- **Web support** — app runs in the browser. Date/time pickers on web use hidden HTML `<input>` elements triggered via `showPicker()` when the card is tapped (no second display box). Directions on web use the Google Maps JS SDK `DirectionsService` (REST Directions API is CORS-blocked from browsers). Android-only notification channel code is platform-guarded.
- **App icon + splash** — custom clock icon and warm beige (`#f5f0e8`) splash, both light and dark variants configured.
- **EAS project configured** — `projectId` in `app.json`, Android package `com.jesseypark.ontimeapp`.
- **App store assets** — `feature-graphic.png` and `icon-512.png` present in `assets/images/`.
- **Docs** — `/docs` folder created with `PROJECT_MAP.md`, `DECISIONS.md`, and `HANDOFF.md`. `CLAUDE.md` updated to reference them.
- **Git history clean** — all commits have proper version labels through v10. Pushed to `jesseypark/OnTimeApp` on GitHub.

---

## What looks in progress or incomplete

- **`app/modal.tsx`** — contains placeholder text ("This is a modal") and is not linked to any button or navigation action in the UI. Either needs content or should be deleted.

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

- **API key exposure** — `EXPO_PUBLIC_GOOGLE_MAPS_KEY` is inlined into the JS bundle and visible to anyone who inspects it. The key should have HTTP referrer or app restrictions in Google Cloud Console if this app is public. Key is currently unrestricted in Google Cloud Console.
- **Notification scheduling on web** — `expo-notifications` web support is partial. Scheduling via `TIME_INTERVAL` trigger uses browser Notifications API but behavior varies by browser. No fallback or user messaging if it fails silently.
- **Single debounce timer for both input fields** — typing in origin cancels a pending suggestion fetch for destination and vice versa. Unlikely to cause real problems but worth noting.
- **No input validation on prep time** — `parseInt(prepTime) || 0` silently defaults to 0 for non-numeric input. No error message shown to the user.
- **`display="calendar"` on date picker** — the native `DateTimePicker` receives `display="calendar"` for the date mode. On Android this renders the calendar view; on iOS `"calendar"` is not a valid display value (valid values are `"default"`, `"spinner"`, `"inline"`, `"compact"`) — iOS silently ignores it and uses the default.
- **No persistence** — all state is in-memory. Closing the app loses origin, destination, event time, and any scheduled notifications (the notifications themselves are scheduled with the OS and will still fire, but the UI chips will be gone on next open).
- **Web notifications don't survive reload** — web scheduling uses `setTimeout` + the browser `Notification` API. If the user closes or reloads the tab, pending notifications are lost.
- **Maps JavaScript API must be enabled** on the same Google Cloud project as the REST key — web Directions calls fail with `ApiNotActivatedMapError` otherwise. Enabled as of 2026-04-14.
- **International use** — no country restriction in code. Google Maps / Places / Geocoding work globally (with reduced coverage in mainland China, North Korea, and some rural regions). Places Autocomplete returns global results (no `includedRegionCodes` filter). API key should not have country-based referrer restrictions if targeting non-US users. **South Korea**: Google Maps Directions API does not support driving routes within South Korea (government data export restrictions). Users in Korea will get `ZERO_RESULTS` — would need Naver or Kakao Maps integration for Korean coverage.

---

## Environment

- Node: v25.9.0 (detected at runtime)
- Expo SDK: 54
- React Native: 0.81.5
- React: 19.1.0
- EAS project ID: `635f29ad-cc5d-4bf5-ad3e-d2e35e29a48a`
- Dev server: `npx expo start` (default port 8081; use `--port` if occupied)
