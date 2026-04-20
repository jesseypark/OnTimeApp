# Project Map

## What this app does

OnTime calculates when you need to leave to arrive somewhere on time. You provide an origin, destination, arrival date/time, and prep tasks. The app calls Google Maps with real-time traffic, computes your leave time and when to start getting ready, and lets you schedule push notifications (Android).

## Tech stack

- **Expo SDK 54** / **React Native 0.81** — cross-platform (iOS, Android, Web)
- **Expo Router 6** — file-based routing
- **react-native-web** — web rendering layer
- **axios** — HTTP client for Google API calls
- **expo-notifications** — local push notifications
- **expo-location** — GPS for auto-detecting origin

## File tree (non-node_modules)

```
app/
  index.tsx               ← entire app UI + logic (single component)
  _layout.tsx             ← root Stack navigator, theme provider
  modal.tsx               ← placeholder, unreachable from UI

components/
  DateTimePickerWrapper.tsx       ← re-exports @react-native-community/datetimepicker (native)
  DateTimePickerWrapper.web.tsx   ← HTML <input type="date|time"> (web)
  themed-text.tsx                 ← Text with light/dark color from theme
  themed-view.tsx                 ← View with light/dark background from theme
  external-link.tsx               ← opens URLs in in-app browser on native, new tab on web
  haptic-tab.tsx                  ← tab bar button with iOS haptic feedback
  ui/
    icon-symbol.tsx               ← MaterialIcons fallback (Android/web)
    icon-symbol.ios.tsx           ← SF Symbols native (iOS)
    collapsible.tsx               ← expandable section component

constants/
  theme.ts                ← Colors (light/dark) + Fonts (platform-specific stacks)

hooks/
  use-color-scheme.ts     ← re-exports RN useColorScheme (native)
  use-color-scheme.web.ts ← hydration-safe wrapper for web SSR
  use-theme-color.ts      ← resolves a color key against the current theme

assets/images/            ← app icon, splash, adaptive icon, favicon, feature graphic

app.json                  ← Expo config: bundle IDs, splash, web output mode
.env                      ← EXPO_PUBLIC_GOOGLE_MAPS_KEY (not committed to git)
tsconfig.json             ← strict mode, @/* path alias maps to project root
```

## Data flow

```
User input
  → origin / destination text
      → Places Autocomplete API (debounced 500ms)
      → suggestion list → user selects → sets origin/destination
  → eventDate (date + time combined in one Date object)
  → prepTasks (array of { id, name, minutes } — named tasks with durations)

Calculate button
  → Directions API (origin, destination, departure_time, traffic_model=best_guess)
  → leaveDate = eventDate - (driveMinutes + 5min buffer)
  → prepStartDate = leaveDate - totalPrepMinutes
  → trafficLevel = good/moderate/bad based on traffic ratio vs base drive time
  → result state: { leaveTime, leaveDate, prepStartTime, prepStartDate, drive,
      traffic, trafficLevel, calculatedAt, prep, destination, origin }

Refresh button (shown in result card)
  → re-runs calculateLeaveTime with same inputs to get updated traffic

Set Notifications button (Android only, shown after result)
  → user picks presets + optional custom minutes
  → notifications are based on leave time (not prep start time)
  → scheduleNotificationAsync with TIME_INTERVAL trigger per selection
  → scheduledNotifs state tracks { id, label, minutesBefore, triggerTime }
  → individual notifs cancellable via chip UI
```

## External API details

| API | Method | Key header |
|-----|--------|-----------|
| Google Maps Directions | GET `maps.googleapis.com/maps/api/directions/json` | `key` query param |
| Google Places Autocomplete v1 | POST `places.googleapis.com/v1/places:autocomplete` | `X-Goog-Api-Key` header |
| Google Geocoding (reverse, native) | GET `maps.googleapis.com/maps/api/geocode/json` | `key` query param |
| Google Geocoding (reverse, web) | `google.maps.Geocoder` via Maps JS SDK | loaded via script tag |

All use the same `EXPO_PUBLIC_GOOGLE_MAPS_KEY`.

## Platform differences

| Feature | iOS | Android | Web |
|---------|-----|---------|-----|
| Date picker | Native calendar (`display="calendar"`) | Native calendar | HTML `<input type="date">` |
| Time picker | Native spinner (`display="spinner"`) | Native spinner | HTML `<input type="time">` |
| Notifications | Full support | Full support (custom channel) | Not available (message shown) |
| GPS | `expo-location` | `expo-location` | `navigator.geolocation` + Maps JS SDK Geocoder |
| Icons | SF Symbols | MaterialIcons | MaterialIcons |
