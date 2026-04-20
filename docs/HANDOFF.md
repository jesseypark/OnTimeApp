# Handoff

Current state of the project as of 2026-04-20. Last updated 2026-04-20.

## Session summary (2026-04-20, v14 — extra time, buffer toggle, favicon, UI polish)

- **Extra time card** — new input card "Extra time" with subtitle "Extra time needed after leaving". Handles parking, walking, detours, shuttles — anything between leaving and arriving. Same UI pattern as prep tasks (named items with durations, +/remove/clear). Placeholder: "e.g. Park, Walk, Detours". Included in leave time calculation.
- **Buffer toggle** — 5 min buffer is now a tile in the breakdown row. Tap ✕ to remove it (times recalculate instantly). When removed, tile dims and shows "+ Add" to re-enable.
- **Traffic tile** — now shows +Xm with colored border (green/orange/red). Traffic level words removed — color is sufficient.
- **Traffic refresh** — "Traffic as of X time · Refresh" text below tiles with tappable link.
- **Favicon** — browser tab icon replaced with the OnTime clock icon (matches Android app icon).
- **Prep tasks** — default row now starts empty with placeholder "e.g. Cook, Shower, Change" and empty minutes field.
- **Result card** — "to reach [address]" centered. Refresh button removed from tiles, replaced by inline text link.

---

## Session summary (2026-04-19, v13 — prep tasks, result redesign, web deployment)

- **Prep tasks** — replaced single prep time input with named task list. Users add tasks with individual durations via a + button. Tasks have clear (✕) buttons on both the name field and the row. Total shown when multiple tasks exist.
- **"Arrive by" labels** — renamed "Event date" / "Event starts at" to "Arrive by — date" / "Arrive by — time" for more natural language that works for any trip, not just events.
- **Result card redesign** — "LEAVE BY" is the hero time (drive + traffic + buffer only). "START GETTING READY" shown below in smaller text with hint "X min to get ready before you go".
- **Notifications Android-only** — removed web notification support (unreliable). Non-Android platforms show "Notifications available on the Android app". Android shows "Based on leave time" hint.
- **Web deployment** — deployed to Vercel as `ontime-app` project. Production URL: `ontime-app-tan.vercel.app`.
- **Mobile web fixes** — date/time pickers now use full-area hidden inputs (mobile Safari/Chrome don't support `showPicker()` on tiny elements). GPS detection uses `navigator.geolocation` directly + Maps JS SDK Geocoder (CORS-safe).

---

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

- **Core calculation** — origin/destination input, GPS auto-detect, arrival date/time picking, named prep tasks, extra time tasks, drive time + traffic from Google Maps Directions API. Result shows "Leave by" time (drive + traffic + extra time + optional buffer) and "Start getting ready" time (leave time minus prep). Traffic shown as +Xm with colored border. Tappable refresh link for updated traffic. Buffer removable via tile ✕.
- **Places Autocomplete** — both origin and destination fields use Google Places API v1 with 500ms debounce and inline suggestion lists.
- **Notifications (Android only)** — preset + custom offset selection, scheduling via `expo-notifications`, active notification chips with per-notification cancel. Android channel configured for max importance + bypass DND. Notifications are based on leave time. Non-Android platforms show a text note.
- **Web support** — app deployed on Vercel (`ontime-app-tan.vercel.app`). Date/time pickers use full-area hidden HTML inputs. Directions use Google Maps JS SDK `DirectionsService`. GPS uses `navigator.geolocation` + Maps JS SDK Geocoder.
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
- **Notifications Android-only** — web and iOS show a text note directing users to the Android app. Web notifications were removed due to unreliability (don't survive tab close).
- **Single debounce timer for both input fields** — typing in origin cancels a pending suggestion fetch for destination and vice versa. Unlikely to cause real problems but worth noting.
- **No input validation on prep task minutes** — `parseInt(minutes) || 0` silently defaults to 0 for non-numeric input. No error message shown to the user.
- **`display="calendar"` on date picker** — the native `DateTimePicker` receives `display="calendar"` for the date mode. On Android this renders the calendar view; on iOS `"calendar"` is not a valid display value (valid values are `"default"`, `"spinner"`, `"inline"`, `"compact"`) — iOS silently ignores it and uses the default.
- **No persistence** — all state is in-memory. Closing the app loses origin, destination, event time, and any scheduled notifications (the notifications themselves are scheduled with the OS and will still fire, but the UI chips will be gone on next open).
- **Maps JavaScript API must be enabled** on the same Google Cloud project as the REST key — web Directions calls fail with `ApiNotActivatedMapError` otherwise. Enabled as of 2026-04-14.
- **iOS Safari location permission** — requires both per-site permission ("Allow") AND system-level Settings → Privacy & Security → Location Services → Safari Websites → "While Using the App". Users may need guidance if location fails.
- **International use** — no country restriction in code. Google Maps / Places / Geocoding work globally (with reduced coverage in mainland China, North Korea, and some rural regions). Places Autocomplete returns global results (no `includedRegionCodes` filter). API key should not have country-based referrer restrictions if targeting non-US users. **South Korea**: Google Maps Directions API does not support driving routes within South Korea (government data export restrictions). Users in Korea will get `ZERO_RESULTS` — would need Naver or Kakao Maps integration for Korean coverage.

---

## Environment

- Node: v25.9.0 (detected at runtime)
- Expo SDK: 54
- React Native: 0.81.5
- React: 19.1.0
- EAS project ID: `635f29ad-cc5d-4bf5-ad3e-d2e35e29a48a`
- Dev server: `npx expo start` (default port 8081; use `--port` if occupied)
