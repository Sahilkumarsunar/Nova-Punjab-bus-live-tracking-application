import "react-native-gesture-handler";
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
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f6f5f1" }}>
        <StatusBar barStyle="dark-content" backgroundColor="#f6f5f1" />
        <ActivityIndicator size="large" color="#0d9488" />
        <Text style={{ marginTop: 12, color: "#0d9488", fontWeight: "700", fontSize: 18, letterSpacing: 1 }}>
          NOVA
        </Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <Stack.Navigator
        initialRouteName={initial}
        screenOptions={{
          headerStyle: { backgroundColor: "#ffffff" },
          headerTintColor: "#1c1917",
          headerTitleStyle: { fontWeight: "600", color: "#1c1917" },
          contentStyle: { backgroundColor: "#f6f5f1" },
          headerShadowVisible: false,
          headerBorderBottomWidth: 1,
          headerBorderBottomColor: "#e7e5e4",
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: "NOVA" }} />
        <Stack.Screen name="BusSetup" component={BusSetupScreen} options={{ title: "Bus Setup" }} />
        <Stack.Screen name="Trip" component={TripScreen} options={{ title: "Trip" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
