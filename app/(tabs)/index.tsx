import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  const [destination, setDestination] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [prepTime, setPrepTime] = useState('15');
  const [result, setResult] = useState(null);

  function calculateLeaveTime() {
    // Make sure the user filled everything in
    if (!destination || !eventTime) {
      Alert.alert('Missing info', 'Please enter a destination and event time.');
      return;
    }

    // Parse the event time the user typed e.g. "7:00 PM"
    const [timePart, meridiem] = eventTime.trim().split(' ');
    const [hoursRaw, minutes] = timePart.split(':').map(Number);
    let hours = hoursRaw;
    if (meridiem?.toUpperCase() === 'PM' && hours !== 12) hours += 12;
    if (meridiem?.toUpperCase() === 'AM' && hours === 12) hours = 0;

    // Build a Date object for the event time (today)
    const eventDate = new Date();
    eventDate.setHours(hours, minutes, 0, 0);

    // Simulate drive time (we'll replace this with Google Maps API later)
    const driveMinutes = Math.floor(Math.random() * 20) + 15; // 15–35 min
    const trafficMinutes = Math.floor(Math.random() * 10);     // 0–10 min extra
    const prep = parseInt(prepTime) || 0;
    const safetyBuffer = 5;

    const totalMinutes = driveMinutes + trafficMinutes + prep + safetyBuffer;

    // Subtract total from event time to get leave time
    const leaveDate = new Date(eventDate.getTime() - totalMinutes * 60000);

    // Format leave time nicely e.g. "6:12 PM"
    const leaveFormatted = leaveDate.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Save result to state so we can show it
    setResult({
      leaveTime: leaveFormatted,
      drive: driveMinutes,
      traffic: trafficMinutes,
      prep,
      destination,
    });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Header */}
      <Text style={styles.logo}>on<Text style={styles.logoAccent}>time</Text></Text>
      <Text style={styles.tagline}>Never be late again.</Text>

      {/* Destination Input */}
      <View style={styles.card}>
        <Text style={styles.label}>📍 Where are you going?</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter address or place name"
          placeholderTextColor="#aaa"
          value={destination}
          onChangeText={setDestination}
        />
      </View>

      {/* Event Time Input */}
      <View style={styles.card}>
        <Text style={styles.label}>⏰ Event starts at</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 7:00 PM"
          placeholderTextColor="#aaa"
          value={eventTime}
          onChangeText={setEventTime}
        />
      </View>

      {/* Prep Time Input */}
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
      <TouchableOpacity style={styles.button} onPress={calculateLeaveTime}>
        <Text style={styles.buttonText}>Calculate Leave Time →</Text>
      </TouchableOpacity>

      {/* Result Card — only shows after calculating */}
      {result && (
        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>LEAVE BY</Text>
          <Text style={styles.resultTime}>{result.leaveTime}</Text>
          <Text style={styles.resultDest}>to reach {result.destination}</Text>

          {/* Breakdown */}
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

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f0e8',
  },
  content: {
    padding: 24,
    paddingTop: 64,
  },
  logo: {
    fontSize: 40,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  logoAccent: {
    color: '#ff4d1c',
  },
  tagline: {
    fontSize: 15,
    color: '#888',
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  input: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  button: {
    backgroundColor: '#ff4d1c',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#ff4d1c',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  resultCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    marginTop: 24,
    alignItems: 'center',
  },
  resultLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 2,
    marginBottom: 8,
  },
  resultTime: {
    fontSize: 56,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
  },
  resultDest: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
    marginBottom: 20,
  },
  breakdown: {
    flexDirection: 'row',
    gap: 12,
  },
  breakdownItem: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    flex: 1,
  },
  breakdownVal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ff4d1c',
  },
  breakdownLbl: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});