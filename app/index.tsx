import DateTimePicker from '@/components/DateTimePickerWrapper';
import axios from 'axios';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Easing, FlatList, KeyboardAvoidingView, Modal, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY;

let mapsApiPromise: Promise<any> | null = null;
function loadMapsApi(): Promise<any> {
  if (mapsApiPromise) return mapsApiPromise;
  mapsApiPromise = new Promise((resolve, reject) => {
    const w = window as any;
    if (w.google?.maps) return resolve(w.google);
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=routes`;
    script.async = true;
    script.onload = () => resolve(w.google);
    script.onerror = () => reject(new Error('Failed to load Google Maps JS'));
    document.head.appendChild(script);
  });
  return mapsApiPromise;
}

async function fetchDirections({ origin, originCoords, destination, departureTime }: any) {
  if (Platform.OS === 'web') {
    const google = await loadMapsApi();
    const svc = new google.maps.DirectionsService();
    const originVal = originCoords
      ? { lat: originCoords.latitude, lng: originCoords.longitude }
      : origin;
    try {
      const routePromise = svc.route({
        origin: originVal,
        destination,
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(departureTime * 1000),
          trafficModel: google.maps.TrafficModel.BEST_GUESS,
        },
      });
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Directions request timed out')), 10000)
      );
      const result: any = await Promise.race([routePromise, timeout]);
      const leg = result.routes[0].legs[0];
      return {
        status: 'OK',
        leg: {
          duration: { value: leg.duration.value },
          duration_in_traffic: leg.duration_in_traffic ? { value: leg.duration_in_traffic.value } : undefined,
          start_address: leg.start_address,
          end_address: leg.end_address,
        },
      };
    } catch (e: any) {
      return { status: e?.code || 'ERROR' };
    }
  }
  const originParam = originCoords
    ? `${originCoords.latitude},${originCoords.longitude}`
    : origin;
  const response = await axios.get(
    'https://maps.googleapis.com/maps/api/directions/json',
    {
      params: {
        origin: originParam,
        destination,
        departure_time: departureTime,
        traffic_model: 'best_guess',
        key: GOOGLE_API_KEY,
      },
    }
  );
  if (response.data.status !== 'OK') return { status: response.data.status };
  return { status: 'OK', leg: response.data.routes[0].legs[0] };
}

// 1. THE GLOBAL HANDLER
// This sits outside the component and ONLY dictates how the notification looks/sounds.
// No state variables (like setScheduledNotifs) can go in here!
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const PRESET_OPTIONS = [
  { label: 'At leave time',     minutesBefore: 0   },
  { label: '5 minutes before',  minutesBefore: 5   },
  { label: '10 minutes before', minutesBefore: 10  },
  { label: '15 minutes before', minutesBefore: 15  },
  { label: '30 minutes before', minutesBefore: 30  },
  { label: '1 hour before',     minutesBefore: 60  },
  { label: '2 hours before',    minutesBefore: 120 },
];

export default function HomeScreen() {
  const [origin, setOrigin] = useState('');
  const [originCoords, setOriginCoords] = useState(null);
  const [destination, setDestination] = useState('');
  const [eventDate, setEventDate] = useState(new Date());
  const [prepTasks, setPrepTasks] = useState([{ id: '1', name: '', minutes: '' }]);
  const [alongTasks, setAlongTasks] = useState([{ id: '1', name: '', minutes: '' }]);
  const [bufferEnabled, setBufferEnabled] = useState(true);
  const [result, setResult] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [error, setError] = useState('');
  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [selectedPresets, setSelectedPresets] = useState([]);
  const [customMinutes, setCustomMinutes] = useState('');
  const [customAlarmPreview, setCustomAlarmPreview] = useState('');
  const [scheduledNotifs, setScheduledNotifs] = useState([]);

  const debounceTimer = useRef(null);
  const scrollViewRef = useRef(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const webTimeouts = useRef<Record<string, any>>({});
  const trafficFlash = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (result?.trafficLevel === 'bad') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(trafficFlash, { toValue: 0.3, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          Animated.timing(trafficFlash, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      trafficFlash.setValue(1);
    }
  }, [result?.trafficLevel]);

  const webDateTimeValue = (() => {
    const y = eventDate.getFullYear();
    const m = String(eventDate.getMonth() + 1).padStart(2, '0');
    const d = String(eventDate.getDate()).padStart(2, '0');
    const h = String(eventDate.getHours()).padStart(2, '0');
    const mn = String(eventDate.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${h}:${mn}`;
  })();

  const openWebDateTimePicker = () => {
    const el = dateInputRef.current as any;
    if (el?.showPicker) el.showPicker();
    else el?.click();
  };

  // 2. THE STATE UPDATER
  // This listens for fired notifications while the app is open and removes them from the UI list.
  // Because it is inside the component, it has full access to setScheduledNotifs.
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      const firedId = notification.request.identifier;
      setScheduledNotifs(prev => prev.filter(n => n.id !== firedId));
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!customMinutes || !result) {
      setCustomAlarmPreview('');
      return;
    }
    const timer = setTimeout(() => {
      const mins = parseInt(customMinutes);
      if (isNaN(mins) || mins < 0) { setCustomAlarmPreview(''); return; }
      const alarmTime = new Date(result.leaveDate.getTime() - mins * 60000);
      setCustomAlarmPreview(`Alarm will go off at ${formatTime(alarmTime)}`);
    }, 1000);
    return () => clearTimeout(timer);
  }, [customMinutes, result]);

  function formatDate(date) {
    return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  }

  function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  async function detectLocation() {
    setLocationLoading(true);
    setError('');
    try {
      let latitude: number, longitude: number;

      if (Platform.OS === 'web') {
        if (!navigator.geolocation) {
          setError('Location is not supported by this browser.');
          setLocationLoading(false);
          return;
        }
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 60000,
          });
        });
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError('Location permission denied. Please enter your starting point manually.');
          setLocationLoading(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        latitude = loc.coords.latitude;
        longitude = loc.coords.longitude;
      }

      let address = 'Current Location';
      if (Platform.OS === 'web') {
        try {
          const google = await loadMapsApi();
          const geocoder = new google.maps.Geocoder();
          const res = await geocoder.geocode({ location: { lat: latitude, lng: longitude } });
          if (res.results?.[0]) address = res.results[0].formatted_address;
        } catch {
          // Geocoding failed but we still have coords
        }
      } else {
        const geoResponse = await axios.get(
          'https://maps.googleapis.com/maps/api/geocode/json',
          { params: { latlng: `${latitude},${longitude}`, key: GOOGLE_API_KEY } }
        );
        address = geoResponse.data.results[0]?.formatted_address || address;
      }

      setOrigin(address);
      setOriginCoords({ latitude, longitude });
      setOriginSuggestions([]);
    } catch (e: any) {
      if (e?.code === 1) {
        setError('Location permission denied. Please allow location access in your browser settings.');
      } else if (e?.code === 2) {
        setError('Location unavailable. Make sure location services are enabled.');
      } else if (e?.code === 3) {
        setError('Location request timed out. Please try again.');
      } else {
        setError('Could not detect location. Try entering it manually.');
      }
    }
    setLocationLoading(false);
  }

  function fetchSuggestions(text, setSuggestions) {
    if (text.length < 3) { setSuggestions([]); return; }
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      try {
        const response = await axios.post(
          'https://places.googleapis.com/v1/places:autocomplete',
          { input: text },
          { headers: { 'X-Goog-Api-Key': GOOGLE_API_KEY, 'Content-Type': 'application/json' } }
        );
        console.log('[fetchSuggestions] response:', response.data);
        setSuggestions(response.data.suggestions || []);
      } catch (err: any) {
        const status = err?.response?.status;
        const detail = err?.response?.data?.error?.message || err?.message || 'unknown';
        console.log(`[fetchSuggestions] error: ${status} — ${detail}`);
        setError(`Autocomplete failed (${status || 'network'}): ${detail}`);
        setSuggestions([]);
      }
    }, 500);
  }

  function addPrepTask() {
    const id = Date.now().toString();
    setPrepTasks(prev => [...prev, { id, name: '', minutes: '' }]);
  }

  function updatePrepTask(id: string, field: 'name' | 'minutes', value: string) {
    setPrepTasks(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  }

  function removePrepTask(id: string) {
    setPrepTasks(prev => prev.filter(t => t.id !== id));
  }

  function getTotalPrep() {
    return prepTasks.reduce((sum, t) => sum + (parseInt(t.minutes) || 0), 0);
  }

  function addAlongTask() {
    const id = Date.now().toString();
    setAlongTasks(prev => [...prev, { id, name: '', minutes: '' }]);
  }

  function updateAlongTask(id: string, field: 'name' | 'minutes', value: string) {
    setAlongTasks(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  }

  function removeAlongTask(id: string) {
    setAlongTasks(prev => prev.filter(t => t.id !== id));
  }

  function getTotalAlong() {
    return alongTasks.reduce((sum, t) => sum + (parseInt(t.minutes) || 0), 0);
  }

  async function calculateLeaveTime() {
    if (!origin) { setError('Please enter or detect your starting location.'); return; }
    if (!destination) { setError('Please enter a destination.'); return; }
    if (eventDate.getTime() < Date.now()) { setError('Event time is in the past. Please select a future date and time.'); return; }
    setLoading(true);
    setError('');
    setResult(null);
    setScheduledNotifs([]);

    try {
      const directions = await fetchDirections({
        origin,
        originCoords,
        destination,
        departureTime: Math.floor(eventDate.getTime() / 1000),
      });

      if (directions.status !== 'OK') {
        console.log(`[calculateLeaveTime] Directions API status: ${directions.status}`);
        setError(`Could not find that route (${directions.status}). Try being more specific.`);
        setLoading(false);
        return;
      }

      const leg = directions.leg;
      const driveSeconds = leg.duration_in_traffic?.value || leg.duration.value;
      const baseSeconds = leg.duration.value;
      const driveMinutes = Math.round(driveSeconds / 60);
      const baseMinutes = Math.round(baseSeconds / 60);
      const trafficMinutes = driveMinutes - baseMinutes;
      const prep = getTotalPrep();
      const along = getTotalAlong();
      const buffer = bufferEnabled ? 5 : 0;
      const leaveMinutes = driveMinutes + along + buffer;
      const leaveDate = new Date(eventDate.getTime() - leaveMinutes * 60000);
      const prepStartDate = new Date(leaveDate.getTime() - prep * 60000);
      const trafficRatio = baseMinutes > 0 ? trafficMinutes / baseMinutes : 0;
      const trafficLevel = trafficRatio < 0.2 ? 'good' : trafficRatio < 0.5 ? 'moderate' : 'bad';
      const calculatedAt = new Date();

      setResult({
        leaveTime: formatTime(leaveDate),
        leaveDate,
        prepStartTime: formatTime(prepStartDate),
        prepStartDate,
        eventTime: formatTime(eventDate),
        eventDate: formatDate(eventDate),
        drive: baseMinutes,
        traffic: trafficMinutes,
        trafficLevel,
        calculatedAt: formatTime(calculatedAt),
        prep,
        along,
        destination: leg.end_address,
        origin: leg.start_address,
      });
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 150);

    } catch {
      setError('Something went wrong. Check your internet connection.');
    }
    setLoading(false);
  }

  function togglePreset(minutesBefore) {
    setSelectedPresets(prev =>
      prev.includes(minutesBefore)
        ? prev.filter(m => m !== minutesBefore)
        : [...prev, minutesBefore]
    );
  }

  async function scheduleAllNotifications() {
    if (Platform.OS === 'android') {
      await Notifications.deleteNotificationChannelAsync('default');
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        sound: true,
        enableVibrate: true,
        vibrationPattern: [0, 250, 150, 250],
        bypassDnd: true,
      });
    }

    if (Platform.OS === 'web') {
      if (typeof Notification === 'undefined') {
        setError('This browser does not support notifications.');
        setShowNotifModal(false);
        return;
      }
      const perm = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
      if (perm !== 'granted') {
        setError('Please allow notifications in your browser settings.');
        setShowNotifModal(false);
        return;
      }
    } else {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        setError('Please allow notifications in your phone settings.');
        setShowNotifModal(false);
        return;
      }
    }

    const toSchedule = [...selectedPresets];
    const custom = parseInt(customMinutes);
    if (!isNaN(custom) && custom >= 0 && !toSchedule.includes(custom)) {
      toSchedule.push(custom);
    }

    if (toSchedule.length === 0) {
      setError('Please select at least one notification time.');
      return;
    }

    const newNotifs = [];

    for (const minutesBefore of toSchedule) {
      const label = minutesBefore === 0
        ? 'At leave time'
        : minutesBefore < 60
          ? `${minutesBefore} minutes before`
          : minutesBefore === 60
            ? '1 hour before'
            : `${minutesBefore / 60} hours before`;

      const triggerTime = new Date(result.leaveDate.getTime() - minutesBefore * 60000);

      if (triggerTime <= new Date()) {
        console.log(`Skipping "${label}" — trigger time is in the past`);
        continue;
      }

      const msUntilTrigger = triggerTime.getTime() - Date.now();
      const title = '🚗 Time to leave!';
      const body = `Head to ${result.destination.split(',')[0]} — leave by ${result.leaveTime}`;

      let id: string;
      if (Platform.OS === 'web') {
        id = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const timeoutId = setTimeout(() => {
          try { new Notification(title, { body }); } catch {}
          delete webTimeouts.current[id];
          setScheduledNotifs(prev => prev.filter(n => n.id !== id));
        }, msUntilTrigger);
        webTimeouts.current[id] = timeoutId;
      } else {
        id = await Notifications.scheduleNotificationAsync({
          content: { title, body, sound: true },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: Math.floor(msUntilTrigger / 1000),
            channelId: 'default',
          },
        });
      }

      newNotifs.push({ id, label, minutesBefore, triggerTime });
    }

    if (newNotifs.length === 0) {
      setError('All selected times are in the past. Please pick a future event time.');
      setShowNotifModal(false);
      return;
    }

    setScheduledNotifs(prev => [...prev, ...newNotifs]);
    setShowNotifModal(false);
    setSelectedPresets([]);
    setCustomMinutes('');
    setCustomAlarmPreview('');
  }

  async function cancelNotification(id) {
    if (Platform.OS === 'web') {
      const t = webTimeouts.current[id];
      if (t) clearTimeout(t);
      delete webTimeouts.current[id];
    } else {
      await Notifications.cancelScheduledNotificationAsync(id);
    }
    setScheduledNotifs(prev => prev.filter(n => n.id !== id));
  }

  function formatChipText(notif) {
    const alarmTime = formatTime(new Date(notif.triggerTime));
    const min = notif.minutesBefore;
    if (min === 0) return `At leave time — alarm at ${alarmTime}`;
    if (min < 60) return `${min} min before ${result?.leaveTime} — alarm at ${alarmTime}`;
    if (min === 60) return `1 hour before ${result?.leaveTime} — alarm at ${alarmTime}`;
    const hours = parseFloat((min / 60).toFixed(2));
    return `${hours} hours before ${result?.leaveTime} — alarm at ${alarmTime}`;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    <ScrollView
      ref={scrollViewRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.logo}>on<Text style={styles.logoAccent}>time</Text></Text>
      <Text style={styles.tagline}>Never be late again.</Text>

      {/* Starting Point */}
      <View style={styles.card}>
        <Text style={styles.label}>🚗 Starting from</Text>
        <View style={styles.locationRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Enter starting address"
            placeholderTextColor="#aaa"
            value={origin}
            onChangeText={(text) => {
              setOrigin(text);
              setOriginCoords(null);
              fetchSuggestions(text, setOriginSuggestions);
            }}
          />
          {origin.length > 0 && (
            <TouchableOpacity style={styles.clearButton} onPress={() => {
              setOrigin('');
              setOriginCoords(null);
              setOriginSuggestions([]);
            }}>
              <Text style={styles.clearButtonText}>✕</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.gpsButton} onPress={detectLocation} disabled={locationLoading}>
            {locationLoading
              ? <ActivityIndicator size="small" color="#ff4d1c" />
              : <Text style={styles.gpsIcon}>📍</Text>
            }
          </TouchableOpacity>
        </View>
        {originSuggestions.length > 0 && (
          <FlatList
            data={originSuggestions}
            keyExtractor={(item) => item.placePrediction.placeId}
            scrollEnabled={false}
            style={styles.suggestionList}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.suggestionItem} onPress={() => {
                setOrigin(item.placePrediction.text.text);
                setOriginCoords(null);
                setOriginSuggestions([]);
              }}>
                <Text style={styles.suggestionText}>{item.placePrediction.text.text}</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      {/* Destination */}
      <View style={styles.card}>
        <Text style={styles.label}>📍 Where are you going?</Text>
        <View style={styles.locationRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Enter address or place name"
            placeholderTextColor="#aaa"
            value={destination}
            onChangeText={(text) => {
              setDestination(text);
              fetchSuggestions(text, setDestinationSuggestions);
            }}
          />
          {destination.length > 0 && (
            <TouchableOpacity style={styles.clearButton} onPress={() => {
              setDestination('');
              setDestinationSuggestions([]);
            }}>
              <Text style={styles.clearButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        {destinationSuggestions.length > 0 && (
          <FlatList
            data={destinationSuggestions}
            keyExtractor={(item) => item.placePrediction.placeId}
            scrollEnabled={false}
            style={styles.suggestionList}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.suggestionItem} onPress={() => {
                setDestination(item.placePrediction.text.text);
                setDestinationSuggestions([]);
              }}>
                <Text style={styles.suggestionText}>{item.placePrediction.text.text}</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      {/* When */}
      <TouchableOpacity
        style={styles.card}
        onPress={() => {
          if (Platform.OS === 'web') {
            openWebDateTimePicker();
          } else {
            setShowDatePicker(true);
          }
        }}
      >
        <Text style={styles.label}>📅 When</Text>
        <Text style={styles.pickerValue}>{formatDate(eventDate)} at {formatTime(eventDate)}</Text>
        {Platform.OS === 'web' && (
          <input
            ref={dateInputRef}
            type="datetime-local"
            value={webDateTimeValue}
            onChange={(e) => {
              const val = e.target.value;
              if (!val) return;
              const updated = new Date(val);
              if (!isNaN(updated.getTime())) setEventDate(updated);
            }}
            style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              opacity: 0, border: 0, padding: 0, cursor: 'pointer',
            }}
          />
        )}
      </TouchableOpacity>
      {Platform.OS !== 'web' && showDatePicker && (
        <DateTimePicker
          value={eventDate}
          mode="date"
          display="calendar"
          onChange={(event, selected) => {
            setShowDatePicker(false);
            if (selected) {
              const updated = new Date(eventDate);
              updated.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
              setEventDate(updated);
              setTimeout(() => setShowTimePicker(true), 300);
            }
          }}
        />
      )}
      {Platform.OS !== 'web' && showTimePicker && (
        <DateTimePicker
          value={eventDate}
          mode="time"
          display="spinner"
          onChange={(event, selected) => {
            setShowTimePicker(false);
            if (selected) {
              const updated = new Date(eventDate);
              updated.setHours(selected.getHours(), selected.getMinutes());
              setEventDate(updated);
            }
          }}
        />
      )}

      {/* Prep Tasks */}
      <View style={styles.card}>
        <View style={styles.prepHeader}>
          <View>
            <Text style={styles.label}>📋 Prep tasks <Text style={styles.optionalTag}>(optional)</Text></Text>
            <Text style={styles.prepSubtitle}>Things to do before you leave</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={addPrepTask}>
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>
        {prepTasks.map((task) => (
          <View key={task.id} style={styles.prepRow}>
            <View style={styles.prepNameWrap}>
              <TextInput
                style={styles.prepName}
                placeholder="e.g. Cook, Shower, Change"
                placeholderTextColor="#aaa"
                value={task.name}
                onChangeText={(v) => updatePrepTask(task.id, 'name', v)}
              />
              {task.name.length > 0 && (
                <TouchableOpacity style={styles.prepNameClear} onPress={() => updatePrepTask(task.id, 'name', '')}>
                  <Text style={styles.prepNameClearText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.prepMinutesWrap}>
              <TextInput
                style={styles.prepMinutes}
                placeholder="0"
                placeholderTextColor="#aaa"
                keyboardType="numeric"
                value={task.minutes}
                onChangeText={(v) => updatePrepTask(task.id, 'minutes', v)}
              />
              <Text style={styles.prepMinutesUnit}>min</Text>
            </View>
            {prepTasks.length > 1 && (
              <TouchableOpacity style={styles.removeTask} onPress={() => removePrepTask(task.id)}>
                <Text style={styles.removeTaskText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        {prepTasks.length > 1 && (
          <Text style={styles.prepTotal}>Total: {getTotalPrep()} min</Text>
        )}
      </View>

      {/* Along the Way */}
      <View style={styles.card}>
        <View style={styles.prepHeader}>
          <View>
            <Text style={styles.label}>🏁 Arrival tasks <Text style={styles.optionalTag}>(optional)</Text></Text>
            <Text style={styles.prepSubtitle}>Things to do before you arrive</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={addAlongTask}>
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>
        {alongTasks.map((task) => (
          <View key={task.id} style={styles.prepRow}>
            <View style={styles.prepNameWrap}>
              <TextInput
                style={styles.prepName}
                placeholder="e.g. Park, Walk, Coffee"
                placeholderTextColor="#aaa"
                value={task.name}
                onChangeText={(v) => updateAlongTask(task.id, 'name', v)}
              />
              {task.name.length > 0 && (
                <TouchableOpacity style={styles.prepNameClear} onPress={() => updateAlongTask(task.id, 'name', '')}>
                  <Text style={styles.prepNameClearText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.prepMinutesWrap}>
              <TextInput
                style={styles.prepMinutes}
                placeholder="0"
                placeholderTextColor="#aaa"
                keyboardType="numeric"
                value={task.minutes}
                onChangeText={(v) => updateAlongTask(task.id, 'minutes', v)}
              />
              <Text style={styles.prepMinutesUnit}>min</Text>
            </View>
            {alongTasks.length > 1 && (
              <TouchableOpacity style={styles.removeTask} onPress={() => removeAlongTask(task.id)}>
                <Text style={styles.removeTaskText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        {alongTasks.length > 1 && (
          <Text style={styles.prepTotal}>Total: {getTotalAlong()} min</Text>
        )}
      </View>

      {/* Calculate Button */}
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={calculateLeaveTime}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Calculate Leave Time →</Text>
        }
      </TouchableOpacity>

      {/* Error */}
      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      ) : null}

      {/* Result Card */}
      {result && (
        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>LEAVE BY</Text>
          <Text style={styles.resultTime}>{result.leaveTime}</Text>
          <Text style={styles.resultDest}>to reach {result.destination}</Text>
          <Text style={styles.resultDateLine}>on {result.eventDate} at {result.eventTime}</Text>

          <View style={styles.breakdown}>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownVal}>{result.drive}m</Text>
              <Text style={styles.breakdownLbl}>Drive time</Text>
            </View>
            <Animated.View style={[styles.breakdownItem, { borderWidth: 2, borderColor: result.trafficLevel === 'good' ? 'rgba(74,222,128,0.5)' : result.trafficLevel === 'moderate' ? 'rgba(251,146,60,0.5)' : 'rgba(248,113,113,0.5)', opacity: result.trafficLevel === 'bad' ? trafficFlash : 1 }]}>
              <Text style={[styles.breakdownVal, { color: result.trafficLevel === 'good' ? '#4ade80' : result.trafficLevel === 'moderate' ? '#fb923c' : '#f87171' }]}>
                +{result.traffic}m
              </Text>
              <Text style={styles.breakdownLbl}>Traffic</Text>
              <Text style={[styles.breakdownLbl, { fontSize: 10, marginTop: 2, color: result.trafficLevel === 'good' ? '#4ade80' : result.trafficLevel === 'moderate' ? '#fb923c' : '#f87171' }]}>
                {result.trafficLevel === 'good' ? 'Good' : result.trafficLevel === 'moderate' ? 'Ok' : 'Bad'}
              </Text>
            </Animated.View>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownVal}>{result.along}m</Text>
              <Text style={styles.breakdownLbl}>Arrival tasks</Text>
            </View>
            {bufferEnabled ? (
              <TouchableOpacity style={styles.breakdownItem} onPress={() => {
                setBufferEnabled(false);
                const newLeave = new Date(result.leaveDate.getTime() + 5 * 60000);
                const newPrepStart = new Date(newLeave.getTime() - result.prep * 60000);
                setResult(prev => ({ ...prev, leaveTime: formatTime(newLeave), leaveDate: newLeave, prepStartTime: formatTime(newPrepStart), prepStartDate: newPrepStart }));
              }}>
                <Text style={styles.breakdownVal}>5m</Text>
                <Text style={styles.breakdownLbl}>Buffer</Text>
                <Text style={styles.bufferRemove}>✕</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.breakdownItem, { opacity: 0.4 }]} onPress={() => {
                setBufferEnabled(true);
                const newLeave = new Date(result.leaveDate.getTime() - 5 * 60000);
                const newPrepStart = new Date(newLeave.getTime() - result.prep * 60000);
                setResult(prev => ({ ...prev, leaveTime: formatTime(newLeave), leaveDate: newLeave, prepStartTime: formatTime(newPrepStart), prepStartDate: newPrepStart }));
              }}>
                <Text style={styles.breakdownVal}>5m</Text>
                <Text style={styles.breakdownLbl}>Buffer</Text>
                <Text style={styles.bufferAdd}>+ Add</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.trafficRefreshNote}>
            Traffic as of {result.calculatedAt} ·{' '}
            <Text style={styles.trafficRefreshLink} onPress={calculateLeaveTime}>Refresh</Text>
          </Text>

          {result.prep > 0 && (
            <View style={styles.prepReadySection}>
              <Text style={styles.prepReadyLabel}>START GETTING READY</Text>
              <Text style={styles.prepReadyTime}>{result.prepStartTime}</Text>
              <Text style={styles.prepReadyHint}>{result.prep} min to get ready before you go</Text>
            </View>
          )}

          {Platform.OS === 'android' ? (
            <>
              <TouchableOpacity
                style={styles.notifButton}
                onPress={() => setShowNotifModal(true)}
              >
                <Text style={styles.notifButtonText}>🔔 Set Notifications</Text>
              </TouchableOpacity>
              <Text style={styles.notifHint}>Based on leave time</Text>

              {scheduledNotifs.length > 0 && (
                <View style={styles.chipsContainer}>
                  <Text style={styles.chipsLabel}>ACTIVE NOTIFICATIONS</Text>
                  {scheduledNotifs.map((notif) => (
                    <View key={notif.id} style={styles.chip}>
                      <Text style={styles.chipText}>
                        🔔 {formatChipText(notif)}
                      </Text>
                      <TouchableOpacity
                        onPress={() => cancelNotification(notif.id)}
                        style={styles.chipCancel}
                      >
                        <Text style={styles.chipCancelText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : (
            <Text style={styles.notifUnavailable}>Notifications available on the Android app</Text>
          )}
        </View>
      )}

      {/* Notification Modal */}
      {Platform.OS === 'android' && showNotifModal && (
        <Modal transparent animationType="slide">
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>🔔 Set Notifications</Text>
              <Text style={styles.modalSub}>
                Notify me before I need to leave at {result?.leaveTime}
              </Text>

              {PRESET_OPTIONS.map((option) => {
                const isSelected = selectedPresets.includes(option.minutesBefore);
                return (
                  <TouchableOpacity
                    key={option.minutesBefore}
                    style={[styles.presetRow, isSelected && styles.presetRowSelected]}
                    onPress={() => togglePreset(option.minutesBefore)}
                  >
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={[styles.presetLabel, isSelected && styles.presetLabelSelected]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <View style={styles.customRow}>
                <Text style={styles.customLabel}>Custom:</Text>
                <TextInput
                  style={styles.customInput}
                  placeholder="e.g. 45"
                  placeholderTextColor="#aaa"
                  keyboardType="numeric"
                  value={customMinutes}
                  onChangeText={setCustomMinutes}
                />
                <Text style={styles.customUnit}>min before</Text>
              </View>
              {customAlarmPreview ? (
                <Text style={styles.customPreview}>{customAlarmPreview}</Text>
              ) : null}

              <TouchableOpacity
                style={styles.modalDone}
                onPress={scheduleAllNotifications}
              >
                <Text style={styles.modalDoneText}>
                  Confirm {selectedPresets.length + (customMinutes ? 1 : 0)} Notification{(selectedPresets.length + (customMinutes ? 1 : 0)) !== 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => {
                  setShowNotifModal(false);
                  setSelectedPresets([]);
                  setCustomMinutes('');
                  setCustomAlarmPreview('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
          </KeyboardAvoidingView>
        </Modal>
      )}


    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f0e8' },
  content: { padding: 24, paddingTop: 64, paddingBottom: 48 },
  logo: { fontSize: 40, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  logoAccent: { color: '#ff4d1c' },
  tagline: { fontSize: 15, color: '#888', marginBottom: 32 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  label: {
    fontSize: 12, fontWeight: '700', color: '#888',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10,
  },
  input: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  prepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  prepSubtitle: { fontSize: 12, color: '#aaa', marginBottom: 10, marginTop: -6 },
  optionalTag: { fontSize: 11, color: '#888', fontWeight: '400' as const, letterSpacing: 0 },
  addButton: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#ff4d1c', alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  addButtonText: { color: '#fff', fontSize: 18, fontWeight: '700', lineHeight: 20 },
  prepRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8,
  },
  prepNameWrap: { flex: 1, position: 'relative', justifyContent: 'center' },
  prepName: {
    fontSize: 15, fontWeight: '600', color: '#1a1a1a',
    backgroundColor: '#f9f6f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    paddingRight: 30,
  },
  prepNameClear: {
    position: 'absolute', right: 8,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#c7c7cc', alignItems: 'center', justifyContent: 'center',
  },
  prepNameClearText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  prepMinutesWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f9f6f0', borderRadius: 10, paddingRight: 8,
  },
  prepMinutes: {
    width: 40, fontSize: 15, fontWeight: '700', color: '#1a1a1a', textAlign: 'center',
    paddingHorizontal: 6, paddingVertical: 10,
  },
  prepMinutesUnit: { fontSize: 12, color: '#aaa', fontWeight: '600' },
  removeTask: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#e0dbd3', alignItems: 'center', justifyContent: 'center',
  },
  removeTaskText: { color: '#888', fontSize: 11, fontWeight: '700' },
  prepTotal: {
    fontSize: 13, fontWeight: '700', color: '#ff4d1c',
    textAlign: 'right', marginTop: 4,
  },
  pickerValue: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gpsButton: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#f5f0e8', alignItems: 'center', justifyContent: 'center',
  },
  gpsIcon: { fontSize: 18 },
  clearButton: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#c7c7cc', alignItems: 'center', justifyContent: 'center',
    marginRight: 6,
  },
  clearButtonText: { color: '#fff', fontSize: 11, fontWeight: '700', lineHeight: 14 },
  suggestionList: { marginTop: 8, borderTopWidth: 1, borderTopColor: '#f0ece4' },
  suggestionItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0ece4' },
  suggestionText: { fontSize: 14, color: '#1a1a1a' },
  button: {
    backgroundColor: '#ff4d1c', borderRadius: 16, padding: 18,
    alignItems: 'center', marginTop: 8, shadowColor: '#ff4d1c',
    shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  errorCard: { backgroundColor: '#fde0d9', borderRadius: 12, padding: 14, marginTop: 12 },
  errorText: { color: '#c0310c', fontSize: 14, fontWeight: '600' },
  resultCard: {
    backgroundColor: '#1a1a1a', borderRadius: 20, padding: 24,
    marginTop: 24, alignItems: 'center',
  },
  resultLabel: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.5)',
    letterSpacing: 2, marginBottom: 8,
  },
  resultTime: { fontSize: 56, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  bufferRemove: {
    color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '700', marginTop: 4,
  },
  bufferAdd: {
    color: '#ff4d1c', fontSize: 10, fontWeight: '700', marginTop: 4,
  },
  trafficRefreshNote: {
    fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 10, textAlign: 'center',
  },
  trafficRefreshLink: { color: '#ff4d1c', fontWeight: '700', textDecorationLine: 'underline' },
  prepReadySection: {
    width: '100%', marginTop: 16, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  prepReadyLabel: {
    fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.5, marginBottom: 4,
  },
  prepReadyTime: { fontSize: 28, fontWeight: '700', color: '#ff4d1c' },
  prepReadyHint: {
    fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4,
  },
  resultDest: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4, textAlign: 'center' },
  resultDateLine: {
    fontSize: 12, color: 'rgba(255,255,255,0.35)',
    marginTop: 2, marginBottom: 20,
  },
  breakdown: { flexDirection: 'row', gap: 12 },
  breakdownItem: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    padding: 12, alignItems: 'center', flex: 1,
  },
  breakdownVal: { fontSize: 16, fontWeight: '700', color: '#ff4d1c', textAlign: 'center' },
  breakdownLbl: {
    fontSize: 10, color: 'rgba(255,255,255,0.5)',
    marginTop: 2, fontWeight: '600', letterSpacing: 0.5, textAlign: 'center',
  },
  breakdownSub: {
    fontSize: 9, color: 'rgba(255,255,255,0.3)',
    marginTop: 2, fontWeight: '500',
  },
  notifHint: {
    color: 'rgba(255,255,255,0.35)', fontSize: 12,
    textAlign: 'center', marginTop: 6,
  },
  notifUnavailable: {
    marginTop: 20, color: 'rgba(255,255,255,0.4)', fontSize: 13,
    textAlign: 'center', fontStyle: 'italic',
  },
  notifButton: {
    marginTop: 20, backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24,
    width: '100%', alignItems: 'center',
  },
  notifButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  chipsContainer: { width: '100%', marginTop: 16 },
  chipsLabel: {
    fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.5, marginBottom: 8,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,77,28,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,77,28,0.3)',
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 6,
  },
  chipText: { color: '#ff4d1c', fontWeight: '600', fontSize: 13 },
  chipCancel: { paddingLeft: 12 },
  chipCancelText: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 28,
    borderTopRightRadius: 28, padding: 24, paddingBottom: 44,
  },
  modalTitle: {
    fontSize: 20, fontWeight: '800', color: '#1a1a1a',
    marginBottom: 4, textAlign: 'center',
  },
  modalSub: { fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 20 },
  presetRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: 12,
    borderRadius: 12, marginBottom: 6, backgroundColor: '#f9f6f0',
  },
  presetRowSelected: { backgroundColor: '#fff3ee' },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: '#ddd',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  checkboxSelected: { backgroundColor: '#ff4d1c', borderColor: '#ff4d1c' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '800' },
  presetLabel: { fontSize: 15, color: '#888', fontWeight: '500' },
  presetLabelSelected: { color: '#1a1a1a', fontWeight: '700' },
  customRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f9f6f0', borderRadius: 12,
    padding: 12, marginTop: 8, marginBottom: 20, gap: 8,
  },
  customLabel: { fontSize: 15, color: '#888', fontWeight: '500' },
  customInput: {
    flex: 1, fontSize: 16, fontWeight: '700', color: '#1a1a1a',
    textAlign: 'center', borderBottomWidth: 2,
    borderBottomColor: '#ff4d1c', paddingBottom: 2,
  },
  customUnit: { fontSize: 14, color: '#888' },
  customPreview: { fontSize: 13, color: '#ff4d1c', fontWeight: '600', textAlign: 'center', marginBottom: 12, marginTop: -8 },
  modalDone: {
    backgroundColor: '#ff4d1c', borderRadius: 14,
    padding: 16, alignItems: 'center', marginBottom: 10,
  },
  modalDoneText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  modalCancel: { alignItems: 'center', padding: 10 },
  modalCancelText: { color: '#888', fontSize: 15 },
});
