import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, StatusBar, KeyboardAvoidingView, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { login } from "../services/api";
import s, { COLORS } from "../components/styles";

export default function LoginScreen({ navigation }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);

  const onLogin = async () => {
    if (!phone || !password) {
      return Alert.alert("Validation Error", "Please enter phone and password");
    }

    const trimmedPhone = phone.trim();
    if (!/^[6-9]\d{9}$/.test(trimmedPhone)) {
      return Alert.alert("Validation Error", "Please enter a valid 10-digit mobile number");
    }

    if (password.length < 6) {
      return Alert.alert("Validation Error", "Password must be at least 6 characters");
    }

    setBusy(true);
    try {
      const { token, driver } = await login({ phone: trimmedPhone, password });
      await AsyncStorage.setItem("token", token);
      await AsyncStorage.setItem("driver", JSON.stringify(driver));
      navigation.replace("Dashboard");
    } catch (e) {
      Alert.alert("Login failed", e.response?.data?.message || e.message);
    } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={[s.screen, { justifyContent: "center" }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      <View style={{
        width: 52, height: 52, borderRadius: 14,
        backgroundColor: COLORS.teal, alignItems: "center",
        justifyContent: "center", marginBottom: 16, alignSelf: "center",
      }}>
        <Text style={{ fontSize: 26 }}>🚌</Text>
      </View>
      <Text style={[s.title, { textAlign: "center", fontSize: 24 }]}>NOVA</Text>
      <Text style={[s.subtitle, { textAlign: "center", marginBottom: 28 }]}>Sign in to your driver account</Text>

      <View style={s.card}>
        <Text style={s.label}>Phone number</Text>
        <TextInput
          style={s.input}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholderTextColor={COLORS.inkFaint}
          placeholder="Enter your phone"
        />

        <Text style={s.label}>Password</Text>
        <View style={{ position: "relative" }}>
          <TextInput
            style={[s.input, { paddingRight: 48 }]}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPass}
            placeholderTextColor={COLORS.inkFaint}
            placeholder="Enter your password"
          />
          <TouchableOpacity
            onPress={() => setShowPass(!showPass)}
            style={{ position: "absolute", right: 12, top: 0, bottom: 0, justifyContent: "center" }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ fontSize: 18, opacity: 0.5 }}>{showPass ? "🙈" : "👁️"}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.btn} onPress={onLogin} disabled={busy} activeOpacity={0.7}>
          <Text style={s.btnText}>{busy ? "Signing in…" : "Sign in"}</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.link} onPress={() => navigation.navigate("Register")}>
        New driver? Create account →
      </Text>
    </KeyboardAvoidingView>
  );
}
