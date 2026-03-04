import DateTimePicker from '@react-native-community/datetimepicker';
import axios from 'axios';
import * as Location from 'expo-location';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY;

export default function HomeScreen() {
  const [origin, setOrigin] = useState('');
  const [originCoords, setOriginCoords] = useState(null);
  const [destination, setDestination] = useState('');
  const [eventDate, setEventDate] = useState(new Date());
  const [prepTime, setPrepTime] = useState('15');
  const [result, setResult] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [error, setError] = useState('');
  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);

  function formatDate(date) {
    return date.toLocaleDateString([], {
      weekday: 'long', month: 'long', day: 'numeric',
    });
  }

  function formatTime(date) {
    return date.toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit',
    });
  }

  // ── Detect current GPS location ──
  async function detectLocation() {
    setLocationLoading(true);
    setError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied. Please enter your starting point manually.');
        setLocationLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;

      const geoResponse = await axios.get(
        'https://maps.googleapis.com/maps/api/geocode/json',
        { params: { latlng: `${latitude},${longitude}`, key: GOOGLE_API_KEY } }
      );

      const address = geoResponse.data.results[0]?.formatted_address || 'Current Location';
      setOrigin(address);
      setOriginCoords({ latitude, longitude });
      setOriginSuggestions([]);
    } catch (err) {
      setError('Could not detect location. Try entering it manually.');
    }
    setLocationLoading(false);
  }

  // ── Autocomplete suggestions ──
  async function fetchSuggestions(text, setSuggestions) {
    if (text.length < 3) { setSuggestions([]); return; }
    try {
      const response = await axios.get(
        'https://maps.googleapis.com/maps/api/place/autocomplete/json',
        { params: { input: text, key: GOOGLE_API_KEY } }
      );
      setSuggestions(response.data.predictions || []);
    } catch {
      setSuggestions([]);
    }
  }

  // ── Calculate leave time ──
  async function calculateLeaveTime() {
    if (!origin) { setError('Please enter or detect your starting location.'); return; }
    if (!destination) { setError('Please enter a destination.'); return; }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const originParam = originCoords
        ? `${originCoords.latitude},${originCoords.longitude}`
        : origin;

      const response = await axios.get(
        'https://maps.googleapis.com/maps/api/directions/json',
        {
          params: {
            origin: originParam,
            destination,
            departure_time: Math.floor(eventDate.getTime() / 1000),
            traffic_model: 'best_guess',
            key: GOOGLE_API_KEY,
          },
        }
      );

      if (response.data.status !== 'OK') {
        setError('Could not find that route. Try being more specific.');
        setLoading(false);
        return;
      }

      // ── Drive time calculation ──
      const leg = response.data.routes[0].legs[0];
      const driveSeconds = leg.duration_in_traffic?.value || leg.duration.value;
      const baseSeconds = leg.duration.value;
      const driveMinutes = Math.round(driveSeconds / 60);
      const baseMinutes = Math.round(baseSeconds / 60);
      const trafficMinutes = driveMinutes - baseMinutes;

      const prep = parseInt(prepTime) || 0;
      const totalMinutes = driveMinutes + prep + 5;
      const leaveDate = new Date(eventDate.getTime() - totalMinutes * 60000);

      setResult({
        leaveTime: formatTime(leaveDate),
        eventTime: formatTime(eventDate),
        eventDate: formatDate(eventDate),
        drive: baseMinutes,
        traffic: trafficMinutes,
        prep,
        destination: leg.end_address,
        origin: leg.start_address,
      });

    } catch (err) {
      setError('Something went wrong. Check your internet connection.');
    }

    setLoading(false);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      {/* Header */}
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
          <TouchableOpacity
            style={styles.gpsButton}
            onPress={detectLocation}
            disabled={locationLoading}
          >
            {locationLoading
              ? <ActivityIndicator size="small" color="#ff4d1c" />
              : <Text style={styles.gpsIcon}>📍</Text>
            }
          </TouchableOpacity>
        </View>

        {originSuggestions.length > 0 && (
          <FlatList
            data={originSuggestions}
            keyExtractor={(item) => item.place_id}
            scrollEnabled={false}
            style={styles.suggestionList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.suggestionItem}
                onPress={() => {
                  setOrigin(item.description);
                  setOriginCoords(null);
                  setOriginSuggestions([]);
                }}
              >
                <Text style={styles.suggestionText}>{item.description}</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      {/* Destination */}
      <View style={styles.card}>
        <Text style={styles.label}>📍 Where are you going?</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter address or place name"
          placeholderTextColor="#aaa"
          value={destination}
          onChangeText={(text) => {
            setDestination(text);
            fetchSuggestions(text, setDestinationSuggestions);
          }}
        />

        {destinationSuggestions.length > 0 && (
          <FlatList
            data={destinationSuggestions}
            keyExtractor={(item) => item.place_id}
            scrollEnabled={false}
            style={styles.suggestionList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.suggestionItem}
                onPress={() => {
                  setDestination(item.description);
                  setDestinationSuggestions([]);
                }}
              >
                <Text style={styles.suggestionText}>{item.description}</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      {/* Date Picker */}
      <TouchableOpacity style={styles.card} onPress={() => setShowDatePicker(true)}>
        <Text style={styles.label}>📅 Event date</Text>
        <Text style={styles.pickerValue}>{formatDate(eventDate)}</Text>
      </TouchableOpacity>

      {/* Time Picker */}
      <TouchableOpacity style={styles.card} onPress={() => setShowTimePicker(true)}>
        <Text style={styles.label}>⏰ Event starts at</Text>
        <Text style={styles.pickerValue}>{formatTime(eventDate)}</Text>
      </TouchableOpacity>

      {/* Prep Time */}
      <View style={styles.card}>
        <Text style={styles.label}>🧴 Getting-ready buffer (minutes)</Text>
        <TextInput
          style={styles.input}
          placeholder="15"
          placeholderTextColor="#aaa"
          keyboardType="numeric"
          value={prepTime}
          onChangeText={setPrepTime}
        />
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
              <Text style={styles.breakdownLbl}>Drive</Text>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownVal}>+{result.traffic}m</Text>
              <Text style={styles.breakdownLbl}>Traffic</Text>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownVal}>{result.prep}m</Text>
              <Text style={styles.breakdownLbl}>Prep</Text>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownVal}>5m</Text>
              <Text style={styles.breakdownLbl}>Buffer</Text>
            </View>
          </View>
        </View>
      )}

      {/* Date Modal */}
      {showDatePicker && (
        <Modal transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Pick a Date</Text>
              <DateTimePicker
                value={eventDate}
                mode="date"
                display="spinner"
                onChange={(event, selected) => {
                  if (selected) {
                    const updated = new Date(eventDate);
                    updated.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
                    setEventDate(updated);
                  }
                }}
                style={styles.picker}
              />
              <TouchableOpacity style={styles.modalDone} onPress={() => setShowDatePicker(false)}>
                <Text style={styles.modalDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Time Modal */}
      {showTimePicker && (
        <Modal transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Pick a Time</Text>
              <DateTimePicker
                value={eventDate}
                mode="time"
                display="spinner"
                onChange={(event, selected) => {
                  if (selected) {
                    const updated = new Date(eventDate);
                    updated.setHours(selected.getHours(), selected.getMinutes());
                    setEventDate(updated);
                  }
                }}
                style={styles.picker}
              />
              <TouchableOpacity style={styles.modalDone} onPress={() => setShowTimePicker(false)}>
                <Text style={styles.modalDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f0e8' },
  content: { padding: 24, paddingTop: 64, paddingBottom: 48 },
  logo: { fontSize: 40, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  logoAccent: { color: '#ff4d1c' },
  tagline: { fontSize: 15, color: '#888', marginBottom: 32 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  label: {
    fontSize: 12, fontWeight: '700', color: '#888',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10,
  },
  input: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  pickerValue: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gpsButton: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#f5f0e8', alignItems: 'center', justifyContent: 'center',
  },
  gpsIcon: { fontSize: 18 },
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
  resultDest: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  resultDateLine: {
    fontSize: 12, color: 'rgba(255,255,255,0.35)',
    marginTop: 2, marginBottom: 20,
  },
  breakdown: { flexDirection: 'row', gap: 12 },
  breakdownItem: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    padding: 12, alignItems: 'center', flex: 1,
  },
  breakdownVal: { fontSize: 16, fontWeight: '700', color: '#ff4d1c' },
  breakdownLbl: {
    fontSize: 10, color: 'rgba(255,255,255,0.5)',
    marginTop: 2, fontWeight: '600', letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 24, paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18, fontWeight: '700', color: '#1a1a1a',
    marginBottom: 12, textAlign: 'center',
  },
  picker: { width: '100%' },
  modalDone: {
    backgroundColor: '#ff4d1c', borderRadius: 14,
    padding: 16, alignItems: 'center', marginTop: 16,
  },
  modalDoneText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});