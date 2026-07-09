import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, StatusBar, KeyboardAvoidingView, Platform, Image } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { register } from "../services/api";
import s, { COLORS } from "../components/styles";

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dlNumber, setDlNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!name || !phone || !dlNumber || !password) {
      return Alert.alert("Validation Error", "All fields are required");
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      return Alert.alert("Validation Error", "Name must be at least 2 characters");
    }
    if (!/^[a-zA-Z\s]+$/.test(trimmedName)) {
      return Alert.alert("Validation Error", "Name must contain only letters and spaces");
    }

    const trimmedPhone = phone.trim();
    if (!/^[6-9]\d{9}$/.test(trimmedPhone)) {
      return Alert.alert("Validation Error", "Phone number must be a valid 10-digit mobile number");
    }

    const cleanDL = dlNumber.replace(/[-\s]/g, "").toUpperCase();
    if (!/^[A-Z]{2}\d{13}$/.test(cleanDL)) {
      return Alert.alert(
        "Validation Error",
        "Driving License must be a valid Indian DL (e.g. PB1020150123456)"
      );
    }

    if (password.length < 6) {
      return Alert.alert("Validation Error", "Password must be at least 6 characters");
    }

    setBusy(true);
    try {
      const { token, driver } = await register({
        name: trimmedName,
        phone: trimmedPhone,
        dlNumber: cleanDL,
        password,
      });
      await AsyncStorage.setItem("token", token);
      await AsyncStorage.setItem("driver", JSON.stringify(driver));
      navigation.replace("Dashboard");
    } catch (e) {
      Alert.alert("Register failed", e.response?.data?.message || e.message);
    } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={[s.screen, { justifyContent: "center" }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      <Image
        source={require("../assets/icon.png")}
        style={{ width: 56, height: 56, borderRadius: 14, marginBottom: 12, alignSelf: "center" }}
      />
      <Text style={[s.title, { textAlign: "center" }]}>Create account</Text>
      <Text style={[s.subtitle, { textAlign: "center", marginBottom: 24 }]}>Join NOVA as a bus driver</Text>

      <View style={s.card}>
        <Text style={s.label}>Full name</Text>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={setName}
          placeholderTextColor={COLORS.inkFaint}
          placeholder="Enter your full name"
        />

        <Text style={s.label}>Phone number</Text>
        <TextInput
          style={s.input}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholderTextColor={COLORS.inkFaint}
          placeholder="Enter your phone"
        />

        <Text style={s.label}>Driving License (DL) Number</Text>
        <TextInput
          style={s.input}
          value={dlNumber}
          onChangeText={setDlNumber}
          autoCapitalize="characters"
          placeholderTextColor={COLORS.inkFaint}
          placeholder="e.g. PB1020150123456"
        />

        <Text style={s.label}>Password</Text>
        <View style={{ position: "relative" }}>
          <TextInput
            style={[s.input, { paddingRight: 48 }]}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPass}
            placeholderTextColor={COLORS.inkFaint}
            placeholder="Create a password"
          />
          <TouchableOpacity
            onPress={() => setShowPass(!showPass)}
            style={{ position: "absolute", right: 12, top: 0, bottom: 0, justifyContent: "center" }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ fontSize: 18, opacity: 0.5 }}>{showPass ? "🙈" : "👁️"}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.btn} onPress={onSubmit} disabled={busy} activeOpacity={0.7}>
          <Text style={s.btnText}>{busy ? "Creating…" : "Create account"}</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.link} onPress={() => navigation.goBack()}>
        ← Back to sign in
      </Text>
    </KeyboardAvoidingView>
  );
}
