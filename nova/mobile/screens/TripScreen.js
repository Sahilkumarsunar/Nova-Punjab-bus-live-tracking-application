import { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, Alert, ScrollView, StatusBar } from "react-native";
import * as Location from "expo-location";
import { startTrip, stopTrip, updateLocation } from "../services/api";
import s, { COLORS } from "../components/styles";

export default function TripScreen({ route, navigation }) {
  const { busId } = route.params;
  const [running, setRunning] = useState(false);
  const [coords, setCoords] = useState(null);
  const [lastSent, setLastSent] = useState(null);
  const [sendCount, setSendCount] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => () => intervalRef.current && clearInterval(intervalRef.current), []);

  const sendOnce = async () => {
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = pos.coords;
      setCoords({ latitude, longitude });
      await updateLocation(busId, latitude, longitude);
      setLastSent(new Date());
      setSendCount((c) => c + 1);
    } catch (e) { console.warn(e.message); }
  };

  const onStart = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return Alert.alert("Permission required", "Location permission is needed.");
    try {
      await startTrip(busId);
      setRunning(true);
      setSendCount(0);
      await sendOnce();
      intervalRef.current = setInterval(sendOnce, 10000);
    } catch (e) {
      Alert.alert("Failed to start", e.response?.data?.message || e.message);
    }
  };

  const onStop = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    try {
      await stopTrip(busId);
      setRunning(false);
    } catch (e) {
      Alert.alert("Failed to stop", e.response?.data?.message || e.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={s.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <Text style={[s.title, { textAlign: "center" }]}>
        {running ? "Trip in progress" : "Trip stopped"}
      </Text>
      <Text style={[s.muted, { textAlign: "center", marginBottom: 20 }]}>
        {running ? "Location is shared every 10 seconds" : "Start your trip to begin sharing location"}
      </Text>

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
        <View style={[s.card, { flex: 1, alignItems: "center", marginBottom: 0 }]}>
          <Text style={s.statValue}>{sendCount}</Text>
          <Text style={s.statLabel}>Updates sent</Text>
        </View>
        <View style={[s.card, { flex: 1, alignItems: "center", marginBottom: 0 }]}>
          <View style={[
            s.badge,
            { backgroundColor: running ? COLORS.greenLight : COLORS.redLight, marginBottom: 4 }
          ]}>
            <Text style={[
              s.badgeText,
              { color: running ? COLORS.green : COLORS.red }
            ]}>
              {running ? "Active" : "Offline"}
            </Text>
          </View>
          <Text style={s.statLabel}>Status</Text>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.cardHeader}>Current location</Text>
        {coords ? (
          <>
            <Text style={{ color: COLORS.inkSecondary, fontSize: 14, marginBottom: 4 }}>
              Lat: {coords.latitude.toFixed(5)}
            </Text>
            <Text style={{ color: COLORS.inkSecondary, fontSize: 14 }}>
              Lng: {coords.longitude.toFixed(5)}
            </Text>
          </>
        ) : (
          <Text style={s.muted}>Waiting for location data…</Text>
        )}
        {lastSent && (
          <>
            <View style={s.divider} />
            <Text style={s.muted}>Last sent: {lastSent.toLocaleTimeString()}</Text>
          </>
        )}
      </View>

      {!running ? (
        <TouchableOpacity
          style={[s.btn, { backgroundColor: COLORS.green }]}
          onPress={onStart}
          activeOpacity={0.7}
        >
          <Text style={s.btnText}>Start trip</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={[s.btn, s.btnDanger]} onPress={onStop} activeOpacity={0.7}>
          <Text style={s.btnText}>Stop trip</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[s.btn, s.btnSecondary]}
        onPress={() => navigation.navigate("Dashboard")}
        activeOpacity={0.7}
      >
        <Text style={s.btnTextSecondary}>← Back to dashboard</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
