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

## Web date/time cards open the picker directly via `showPicker()`

To avoid showing a second box below the "Event date" / "Event starts at" card on web, the `<input type="date|time">` is rendered inside the card but visually hidden (1px, opacity 0, pointer-events none). Tapping the card calls `ref.showPicker()` (with a `.click()` fallback for older browsers), which opens the browser's native date/time picker. The card itself continues to display the formatted value. Native platforms keep the existing toggle-to-show inline picker flow.

---

## Platform-split DateTimePicker via `.web.tsx` file extension

The native `@react-native-community/datetimepicker` package has no web implementation. Rather than a runtime `Platform.OS` check with a lazy `require()`, the app uses Expo/Metro's built-in platform extension resolution: `DateTimePickerWrapper.tsx` (native, re-exports the native package) and `DateTimePickerWrapper.web.tsx` (renders HTML `<input>`). This keeps the import clean and lets the bundler tree-shake the native module from the web bundle entirely.

---

## API key in `.env` with `EXPO_PUBLIC_` prefix

`EXPO_PUBLIC_GOOGLE_MAPS_KEY` is used directly in client-side code. The `EXPO_PUBLIC_` prefix means the value is inlined into the JS bundle at build time — it is visible to anyone who inspects the bundle. For a production app, the API key should have HTTP referrer / app restrictions applied in the Google Cloud Console to limit its use to authorized origins.

---

## No second tab (removed in v5)

The commit history shows a second "Explore" tab was removed in v5. `app/modal.tsx` and several components (`hello-wave`, `parallax-scroll-view`, `haptic-tab`, `collapsible`, `external-link`) are scaffolding left over from the Expo template that are no longer used by the main screen. They haven't been deleted, likely to avoid churn, but they're dead code.
