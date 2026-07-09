import "react-native-gesture-handler";
// Register background location task BEFORE any navigator renders
import "./services/locationTask";
import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, Text, ActivityIndicator, StatusBar } from "react-native";

import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import DashboardScreen from "./screens/DashboardScreen";
import BusSetupScreen from "./screens/BusSetupScreen";
import TripScreen from "./screens/TripScreen";

const Stack = createNativeStackNavigator();

export default function App() {
  const [initial, setInitial] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem("token")
      .then((t) => setInitial(t ? "Dashboard" : "Login"))
      .catch((e) => {
        console.error("AsyncStorage error:", e);
        setInitial("Login");
      });
  }, []);

  if (!initial) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F7F8FC" }}>
        <StatusBar barStyle="dark-content" backgroundColor="#F7F8FC" />
        <ActivityIndicator size="large" color="#7B2CBF" />
        <Text style={{ marginTop: 12, color: "#1A1A2E", fontWeight: "800", fontSize: 24, letterSpacing: -0.5 }}>
          NOVA
        </Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Stack.Navigator
        initialRouteName={initial}
        screenOptions={{
          headerStyle: { backgroundColor: "#FFFFFF" },
          headerTintColor: "#1A1A2E",
          headerTitleStyle: { fontWeight: "800", color: "#1A1A2E", fontSize: 20 },
          contentStyle: { backgroundColor: "#F7F8FC" },
          headerShadowVisible: false,
          headerBorderBottomWidth: 1,
          headerBorderBottomColor: "rgba(123, 44, 191, 0.08)",
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: "NOVA" }} />
        <Stack.Screen name="BusSetup" component={BusSetupScreen} options={{ title: "Bus Setup" }} />
        <Stack.Screen name="Trip" component={TripScreen} options={{ title: "Live Trip" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
