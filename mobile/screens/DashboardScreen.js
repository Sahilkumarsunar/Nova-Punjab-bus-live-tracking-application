import { useEffect, useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, ScrollView,
  StatusBar, Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getMyBus } from "../services/api";
import * as tripService from "../services/tripService";
import s, { COLORS } from "../components/styles";

export default function DashboardScreen({ navigation }) {
  const [driver, setDriver] = useState(null);
  const [bus, setBus] = useState(null);
  const [trip, setTrip] = useState(tripService.getState());

  const load = useCallback(async () => {
    const d = await AsyncStorage.getItem("driver");
    setDriver(d ? JSON.parse(d) : null);
    try { setBus(await getMyBus()); } catch (e) { console.warn(e.message); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Keep trip banner in sync with global trip state
  useEffect(() => {
    const unsub = tripService.subscribe(setTrip);
    return unsub;
  }, []);

  const logout = async () => {
    if (tripService.getState().running) {
      Alert.alert("Trip is active", "Please stop the trip before signing out.");
      return;
    }
    await AsyncStorage.multiRemove(["token", "driver"]);
    navigation.replace("Login");
  };

  const onStopTrip = () => {
    Alert.alert(
      "Stop trip?",
      "This will end the trip and stop location sharing.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop trip",
          style: "destructive",
          onPress: () => tripService.stopTrip(),
        },
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={s.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <Text style={s.title}>Hello, {driver?.name || "Driver"}</Text>
      <Text style={s.muted}>{driver?.phone}</Text>

      {/* ── Trip Active Banner ── */}
      {trip.running && (
        <View
          style={[
            s.card,
            {
              marginTop: 20,
              borderColor: COLORS.green,
              borderWidth: 1.5,
              backgroundColor: COLORS.greenLight,
            },
          ]}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: COLORS.green, fontWeight: "800", fontSize: 16 }}>
                🟢  Trip Active
              </Text>
              <Text
                style={{ color: COLORS.inkSecondary, fontSize: 13, marginTop: 4 }}
              >
                Sending GPS every 10 s · {trip.sendCount} updates sent
              </Text>
            </View>
            <TouchableOpacity
              style={{
                backgroundColor: COLORS.red,
                paddingHorizontal: 18,
                paddingVertical: 10,
                borderRadius: 100,
                marginLeft: 12,
              }}
              onPress={onStopTrip}
              activeOpacity={0.7}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
                Stop
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Bus Card ── */}
      <View style={[s.card, { marginTop: trip.running ? 0 : 20 }]}>
        <Text style={s.cardHeader}>Your bus</Text>
        {bus ? (
          <>
            <View style={s.row}>
              <Text
                style={{
                  fontWeight: "700",
                  fontSize: 20,
                  color: COLORS.ink,
                  letterSpacing: -0.3,
                }}
              >
                {bus.busNumber}
              </Text>
              <View
                style={[
                  s.badge,
                  {
                    backgroundColor:
                      bus.status === "active" ? COLORS.greenLight : COLORS.redLight,
                  },
                ]}
              >
                <Text
                  style={[
                    s.badgeText,
                    { color: bus.status === "active" ? COLORS.green : COLORS.red },
                  ]}
                >
                  {bus.status}
                </Text>
              </View>
            </View>
            <View style={s.divider} />
            <View style={s.infoChip}>
              <View style={[s.infoChipIcon, { backgroundColor: COLORS.tealLight }]}>
                <Text style={{ fontSize: 16 }}>🚌</Text>
              </View>
              <View>
                <Text style={{ color: COLORS.ink, fontWeight: "600", fontSize: 14 }}>
                  {bus.busBrand}
                </Text>
                <Text style={s.muted}>
                  {bus.busType === "government" ? "Government" : "Private"}
                </Text>
              </View>
            </View>
            <View style={s.infoChip}>
              <View style={[s.infoChipIcon, { backgroundColor: COLORS.amberLight }]}>
                <Text style={{ fontSize: 16 }}>🗺️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: COLORS.ink, fontWeight: "600", fontSize: 14 }}>
                  {bus.routeId?.routeName || bus.routeId}
                </Text>
                <Text style={s.muted}>Assigned route</Text>
              </View>
            </View>
          </>
        ) : (
          <View style={{ alignItems: "center", paddingVertical: 24 }}>
            <Text
              style={{ color: COLORS.inkMuted, textAlign: "center", lineHeight: 20 }}
            >
              No bus configured yet.{"\n"}Set up your bus to get started.
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={s.btn}
        onPress={() => navigation.navigate("BusSetup")}
        activeOpacity={0.7}
      >
        <Text style={s.btnText}>
          {bus ? "Edit bus details" : "Set up your bus"}
        </Text>
      </TouchableOpacity>

      {bus && (
        <TouchableOpacity
          style={[s.btn, { backgroundColor: COLORS.green }]}
          onPress={() => navigation.navigate("Trip", { busId: bus._id })}
          activeOpacity={0.7}
        >
          <Text style={s.btnText}>Go to trip screen →</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[s.btn, s.btnSecondary]}
        onPress={logout}
        activeOpacity={0.7}
      >
        <Text style={s.btnTextSecondary}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
