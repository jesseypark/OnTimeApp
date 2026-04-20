# Decisions

Non-obvious design choices inferred from the codebase, with reasoning where it's clear.

---

## Everything in one component

All state and logic lives in `app/index.tsx` as a single large component with no sub-components. No context, no custom hooks, no state library. This is a deliberate simplicity choice for a small single-screen app — splitting would add indirection with no real benefit at this scale.

---

## Notifications handler defined at module scope (outside component)

`Notifications.setNotificationHandler(...)` is called at the top of the file, outside the React component. The comment in the code explains why: the handler only controls how notifications look/sound and cannot reference React state. The listener that *updates* state lives inside the component in a `useEffect`. This two-part pattern (handler outside, listener inside) is the correct pattern for `expo-notifications`.

---

## Single `debounceTimer` ref for both origin and destination

`fetchSuggestions` is a shared function that takes a `setSuggestions` argument. Both origin and destination autocomplete calls share the same `debounceTimer` ref. This means typing in one field cancels a pending fetch in the other. Acceptable trade-off for a simple app — the user is unlikely to type in both fields simultaneously.

---

## Always-debounced Places API (no immediate fetch)

The Places Autocomplete call fires 500ms after the last keystroke and only for inputs ≥ 3 characters. This is a standard pattern to avoid spamming the API on every keypress.

---

## GPS detection reverse-geocodes to an address string

When the user taps the GPS button, the app stores both the raw `{ latitude, longitude }` in `originCoords` and the human-readable address string in `origin`. When calling the Directions API, it prefers coordinates (more accurate) over the address string. The address is shown in the text field for UX clarity.

---

## Fixed 5-minute buffer always added

`totalMinutes = driveMinutes + prep + 5`. The extra 5 minutes is a hardcoded buffer built into the calculation. It's not configurable by the user and not separately labeled in the formula — it does appear as its own "Buffer" tile in the results breakdown UI.

---

## `departure_time` passed to Directions API

The Directions API call passes `departure_time: Math.floor(eventDate.getTime() / 1000)`. This is what enables `duration_in_traffic` — without a departure time the API can't return traffic-adjusted durations. The app falls back to `leg.duration.value` (no-traffic estimate) if `duration_in_traffic` is absent.

---

## `traffic_model: 'best_guess'`

Of the three options (`optimistic`, `pessimistic`, `best_guess`), `best_guess` is the most balanced and is what Google recommends for ETA calculations. Consistent with the app's "never be late" goal without being excessively conservative.

---

## Notification triggers use `TIME_INTERVAL` not absolute date

Notifications are scheduled using `SchedulableTriggerInputTypes.TIME_INTERVAL` (seconds until trigger) rather than a date-based trigger. This is because the time interval is computed fresh at schedule time, so it avoids any timezone complications. Works on iOS, Android, and has partial support on web.

---

## Android notification channel recreated on every schedule

The Android notification channel is deleted and re-created on every call to `scheduleAllNotifications`. This ensures the channel settings (max importance, bypass DND) are always fresh and not stale from a previous install or OS change. Minor performance cost, avoids channel misconfiguration bugs.

---

## `web.output: "single-page"` instead of `"static"`

`expo-notifications` imports `localStorage` at module load time, which throws during server-side rendering. Switching from `"static"` to `"single-page"` disables SSR entirely and renders the app client-side only. Appropriate since this app has no SEO requirements and uses browser APIs throughout.

---

## Web notifications use the browser Notification API + setTimeout

`expo-notifications`' `scheduleNotificationAsync` throws on web ("not available on web"). On web, `scheduleAllNotifications` requests permission via `Notification.requestPermission()` and schedules each reminder with `setTimeout` — the callback fires `new Notification(title, {body})`. Timeout IDs are stored in a ref keyed by a generated `web-*` id so cancel works the same way in the UI. Caveat: timeouts don't survive page reload and won't fire if the tab is closed — acceptable for the current web build.

---

## Web uses Google Maps JS SDK for Directions (not the REST API)

The REST Directions endpoint (`maps.googleapis.com/maps/api/directions/json`) does not send CORS headers, so browser calls fail with "blocked by CORS policy." On web, `fetchDirections` dynamically loads `maps.googleapis.com/maps/api/js` and uses `DirectionsService.route()` instead, which is CORS-safe. Native platforms continue to use the REST endpoint via axios. The Maps JavaScript API must be enabled on the Google Cloud project for the same `EXPO_PUBLIC_GOOGLE_MAPS_KEY`.

---

## Web date/time cards use full-area hidden inputs

The `<input type="date|time">` is rendered inside each card as a full-area overlay (100% width/height, opacity 0). On desktop, `showPicker()` is called programmatically. On mobile, tapping anywhere on the card directly hits the invisible input, which opens the native browser picker. The previous approach (1px hidden input with `showPicker()`) didn't work on mobile Safari/Chrome because `showPicker()` requires a user gesture on the element itself.

---

## Platform-split DateTimePicker via `.web.tsx` file extension

The native `@react-native-community/datetimepicker` package has no web implementation. Rather than a runtime `Platform.OS` check with a lazy `require()`, the app uses Expo/Metro's built-in platform extension resolution: `DateTimePickerWrapper.tsx` (native, re-exports the native package) and `DateTimePickerWrapper.web.tsx` (renders HTML `<input>`). This keeps the import clean and lets the bundler tree-shake the native module from the web bundle entirely.

---

## API key in `.env` with `EXPO_PUBLIC_` prefix

`EXPO_PUBLIC_GOOGLE_MAPS_KEY` is used directly in client-side code. The `EXPO_PUBLIC_` prefix means the value is inlined into the JS bundle at build time — it is visible to anyone who inspects the bundle. For a production app, the API key should have HTTP referrer / app restrictions applied in the Google Cloud Console to limit its use to authorized origins.

---

## EAS environment variables for production builds

The `.env` file is local-only (gitignored) and not available during EAS cloud builds. `EXPO_PUBLIC_GOOGLE_MAPS_KEY` is set via `eas env:create --environment production` so it's injected at build time. This keeps the key out of version control while ensuring production builds have it.

---

## Past event time validation before API call

The Directions API returns `INVALID_REQUEST` when `departure_time` is in the past. Since `eventDate` defaults to `new Date()`, even a short delay filling in the form can push it into the past. The app validates this client-side before making the API call, giving a clear error message instead of a cryptic API failure.

---

## No second tab (removed in v5)

The commit history shows a second "Explore" tab was removed in v5. `app/modal.tsx` and several components (`hello-wave`, `parallax-scroll-view`, `haptic-tab`, `collapsible`, `external-link`) are scaffolding left over from the Expo template that are no longer used by the main screen. They haven't been deleted, likely to avoid churn, but they're dead code.

---

## Prep tasks as named list instead of single number

Users add named prep tasks (e.g. "Shower", "Pack lunch") with individual durations. This replaces the single "prep time in minutes" input. The total is summed automatically. Prep time is subtracted from leave time to produce a "start getting ready" time — leave time itself only accounts for drive + traffic + buffer.

---

## Leave time vs start getting ready — separate concepts

Leave time = arrival time minus drive, traffic, and 5min buffer. Start getting ready = leave time minus total prep. Notifications are based on leave time, not prep start. This separation lets users see both "when to start tasks" and "when to walk out the door" clearly.

---

## Traffic level indicator (good/moderate/bad)

Traffic severity is derived from the ratio of traffic delay to base drive time: < 20% = good (green), 20–50% = moderate (orange), > 50% = heavy (red). The result card shows the level with color coding and "as of [time]" so users know when the data was pulled. A refresh button lets users recalculate without re-entering inputs.

---

## Notifications limited to Android

Web notifications were unreliable (don't survive tab close, inconsistent browser support). iOS doesn't support `expo-notifications` without a native build. Notifications are now Android-only, with a text note on other platforms: "Notifications available on the Android app."

---

## Web GPS uses navigator.geolocation directly

`expo-location` wraps `navigator.geolocation` on web but adds overhead and inconsistent error handling. Using the browser API directly with explicit `enableHighAccuracy`, timeout, and error code handling gives better results. Reverse geocoding on web uses the Maps JS SDK `Geocoder` (CORS-safe) instead of the REST Geocoding API.

---

## Web deployment on Vercel

The app is deployed as a static site on Vercel from the `dist/` folder produced by `npx expo export --platform web`. The Vercel project is named `ontime-app` and the production URL is `ontime-app-tan.vercel.app`. A `vercel.json` with rewrites handles client-side routing.

---

## "Extra time" as a separate input from prep tasks

Prep tasks happen before leaving (cook, shower, change). Extra time happens after leaving but before arriving (parking, walking, shuttle, detours). They affect the calculation differently: prep is subtracted from leave time to get "start getting ready" time, while extra time is added to drive time to push leave time earlier. Keeping them separate makes the mental model clear.

---

## Buffer as a removable tile instead of a toggle switch

The 5 min buffer is shown as a breakdown tile with a ✕ to remove it. When removed, leave time and start getting ready time recalculate instantly without an API call (just shifts by 5 minutes). The tile dims and shows "+ Add" to re-enable. This keeps the buffer visible in the breakdown and lets power users who don't want padding remove it.

---

## Traffic tile: thicker border, color label, flash on bad

The traffic tile has a 2px colored border (green/orange/red) and shows "Good"/"Ok"/"Bad" text below in matching color. When traffic is "Bad", the entire tile pulses using `Animated.loop` (opacity oscillates 1→0.3→1 over 1.2s). This draws attention to severe traffic without being disruptive for normal conditions.

---

## Combined "When" input (date + time in one card)

Date and time are a single card labeled "📅 When" showing "Apr 20, 2026 at 3:00 PM". On web, a full-area hidden `<input type="datetime-local">` opens the native picker. On native, tapping opens the date picker, which auto-chains to the time picker after 300ms. This reduces card count and matches how users think about "when" — a single moment, not separate date and time.
