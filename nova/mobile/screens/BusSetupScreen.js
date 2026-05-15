import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, StatusBar } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { getRoutes, registerBus, getMyBus } from "../services/api";
import s, { COLORS } from "../components/styles";

const BRANDS = [
  { label: "Punjab Roadways (Government)", value: "Punjab Roadways", type: "government" },
  { label: "PRTC (Government)", value: "PRTC", type: "government" },
  { label: "PunBus (Government)", value: "PunBus", type: "government" },
  { label: "Private Bus Operator", value: "Private Bus Operator", type: "private" },
];

export default function BusSetupScreen({ navigation }) {
  const [busNumber, setBusNumber] = useState("");
  const [busBrand, setBusBrand] = useState("Punjab Roadways");
  const [routes, setRoutes] = useState([]);
  const [routeId, setRouteId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getRoutes().then((rs) => {
      setRoutes(rs);
      if (rs[0]) setRouteId(rs[0]._id);
    });
    getMyBus().then((b) => {
      if (b) {
        setBusNumber(b.busNumber);
        setBusBrand(b.busBrand);
        setRouteId(b.routeId?._id || b.routeId);
      }
    }).catch(() => {});
  }, []);

  const onSave = async () => {
    if (!busNumber || !busBrand || !routeId) return Alert.alert("Fill all fields");
    const brand = BRANDS.find((b) => b.value === busBrand);
    setBusy(true);
    try {
      const bus = await registerBus({
        busNumber, busBrand, busType: brand.type, routeId,
      });
      Alert.alert("Saved", "Bus details updated successfully");
      navigation.replace("Trip", { busId: bus._id });
    } catch (e) {
      Alert.alert("Error", e.response?.data?.message || e.message);
    } finally { setBusy(false); }
  };

  return (
    <ScrollView contentContainerStyle={s.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <Text style={s.title}>Bus setup</Text>
      <Text style={s.subtitle}>Configure your bus and select a route</Text>

      <View style={s.card}>
        <Text style={s.label}>Bus number</Text>
        <TextInput
          style={s.input}
          value={busNumber}
          onChangeText={setBusNumber}
          autoCapitalize="characters"
          placeholderTextColor={COLORS.inkFaint}
          placeholder="e.g. PB10AB1234"
        />

        <Text style={s.label}>Bus brand</Text>
        <View style={[s.input, { padding: 0, borderColor: COLORS.borderStrong }]}>
          <Picker
            selectedValue={busBrand}
            onValueChange={setBusBrand}
            style={{ color: COLORS.ink }}
            dropdownIconColor={COLORS.inkMuted}
          >
            {BRANDS.map((b) => (
              <Picker.Item key={b.value} label={b.label} value={b.value} color={COLORS.ink} />
            ))}
          </Picker>
        </View>

        <Text style={s.label}>Route</Text>
        <View style={[s.input, { padding: 0, borderColor: COLORS.borderStrong }]}>
          <Picker
            selectedValue={routeId}
            onValueChange={setRouteId}
            style={{ color: COLORS.ink }}
            dropdownIconColor={COLORS.inkMuted}
          >
            {routes.map((r) => (
              <Picker.Item key={r._id} label={r.routeName} value={r._id} color={COLORS.ink} />
            ))}
          </Picker>
        </View>
      </View>

      <TouchableOpacity
        style={[s.btn, { backgroundColor: COLORS.green }]}
        onPress={onSave}
        disabled={busy}
        activeOpacity={0.7}
      >
        <Text style={s.btnText}>{busy ? "Saving…" : "Save & continue →"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
