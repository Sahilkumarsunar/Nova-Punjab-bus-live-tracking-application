import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, StatusBar, KeyboardAvoidingView, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { register } from "../services/api";
import s, { COLORS } from "../components/styles";

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!name || !phone || !password) return Alert.alert("Fill all fields");
    setBusy(true);
    try {
      const { token, driver } = await register({ name, phone, password });
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
