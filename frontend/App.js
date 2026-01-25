import "react-native-gesture-handler";
import React, { useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { api } from "./utils/api";
import LoginScreen from "./screens/LoginScreen";
import SignUpScreen from "./screens/SignUpScreen";
import DashboardScreen from "./screens/DashboardScreen";
import AddExpenseScreen from "./screens/AddExpenseScreen";
import InsightsScreen from "./screens/InsightsScreen";
import ProfileScreen from "./screens/ProfileScreen";
import colors from "./theme/colors";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function AppTabs({ user, onLogout, onDataChange }) {
  return (
    <Tab.Navigator
      initialRouteName="Dashboard"  // ✅ always open dashboard
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === "Dashboard") iconName = "📊";
          else if (route.name === "Add Expense") iconName = "➕";
          else if (route.name === "Insights") iconName = "💡";
          else if (route.name === "Profile") iconName = "👤";
          return <Text style={{ fontSize: size, color }}>{iconName}</Text>;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
      })}
    >
      <Tab.Screen name="Dashboard">
        {(props) => <DashboardScreen {...props} user={user} />}
      </Tab.Screen>

      <Tab.Screen name="Add Expense">
        {(props) => <AddExpenseScreen {...props} user={user} onExpenseAdded={onDataChange} />}
      </Tab.Screen>

      <Tab.Screen name="Insights">
        {(props) => <InsightsScreen {...props} user={user} />}
      </Tab.Screen>

      <Tab.Screen name="Profile">
        {(props) => (
          <ProfileScreen
            {...props}
            user={user}
            onLogout={onLogout}
            onProfileUpdate={onDataChange}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);

  const loadUserData = async (email) => {
    setAuthLoading(true);
    try {
      const res = await api.getDashboardData(email);
      if (res?.success && res?.data) {
        setUser(res.data); // ✅ this triggers redirect to tabs
      } else {
        setUser(null);
      }
    } catch (e) {
      console.error("loadUserData failed:", e);
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  // ✅ called by LoginScreen/SignUpScreen
  const handleLogin = (u) => {
    if (u?.email) loadUserData(u.email);
  };

  const handleLogout = () => setUser(null);

  if (authLoading && !user) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!user ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login">
            {(props) => <LoginScreen {...props} onLogin={handleLogin} />}
          </Stack.Screen>
          <Stack.Screen name="SignUp">
            {(props) => <SignUpScreen {...props} onLogin={handleLogin} />}
          </Stack.Screen>
        </Stack.Navigator>
      ) : (
        <AppTabs
          user={user}
          onLogout={handleLogout}
          onDataChange={() => loadUserData(user.email)}
        />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
});
