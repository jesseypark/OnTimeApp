import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  const [destination, setDestination] = useState('');
  const [eventDate, setEventDate] = useState(new Date());
  const [prepTime, setPrepTime] = useState('15');
  const [result, setResult] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Format date nicely e.g. "Tuesday, March 4"
  function formatDate(date) {
    return date.toLocaleDateString([], {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }

  // Format time nicely e.g. "7:00 PM"
  function formatTime(date) {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function calculateLeaveTime() {
    if (!destination) {
      alert('Please enter a destination.');
      return;
    }

    const driveMinutes = Math.floor(Math.random() * 20) + 15;
    const trafficMinutes = Math.floor(Math.random() * 10);
    const prep = parseInt(prepTime) || 0;
    const safetyBuffer = 5;
    const totalMinutes = driveMinutes + trafficMinutes + prep + safetyBuffer;

    const leaveDate = new Date(eventDate.getTime() - totalMinutes * 60000);

    setResult({
      leaveTime: formatTime(leaveDate),
      eventTime: formatTime(eventDate),
      eventDate: formatDate(eventDate),
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

      {/* Date Picker Modal */}
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

      {/* Time Picker Modal */}
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
  container: {
    flex: 1,
    backgroundColor: '#f5f0e8',
  },
  content: {
    padding: 24,
    paddingTop: 64,
    paddingBottom: 48,
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
  pickerValue: {
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
  },
  resultDateLine: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 2,
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
    textAlign: 'center',
  },
  picker: {
    width: '100%',
  },
  modalDone: {
    backgroundColor: '#ff4d1c',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  modalDoneText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});