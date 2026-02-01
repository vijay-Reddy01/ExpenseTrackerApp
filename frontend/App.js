import "react-native-gesture-handler";
import React, { useCallback, useState } from "react";
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
import ExpensesScreen from "./screens/ExpensesScreen";
import ReceiptScanScreen from "./screens/ReceiptScanScreen";
import EditProfileScreen from "./screens/EditProfileScreen";
import NotificationScreen from "./screens/NotificationScreen";
import HelpSupportScreen from "./screens/HelpSupportScreen";

// ✅ These must exist in your project for Profile buttons to work


import { ThemeProvider, useThemeApp } from "./theme/ThemeContext";

const Tab = createBottomTabNavigator();
const RootStack = createStackNavigator();
const AppStack = createStackNavigator();
const ProfileStackNav = createStackNavigator();

/* ---------------------------
   Profile Stack (Fixes buttons)
--------------------------- */
function ProfileStack({ user, onLogout, reloadUser }) {
  return (
    <ProfileStackNav.Navigator>
      <ProfileStackNav.Screen name="ProfileHome" options={{ headerShown: false }}>
        {(props) => (
          <ProfileScreen
            {...props}
            user={user}
            onLogout={onLogout}
            onProfileUpdate={reloadUser}
          />
        )}
      </ProfileStackNav.Screen>

      <ProfileStackNav.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: "Edit Profile" }}
      />

      <ProfileStackNav.Screen
        name="Notifications"
        component={NotificationScreen}
        options={{ title: "Notifications" }}
      />

      <ProfileStackNav.Screen
        name="HelpSupport"
        component={HelpSupportScreen}
        options={{ title: "Help & Support" }}
      />
    </ProfileStackNav.Navigator>
  );
}

/* ---------------------------
   Tabs
--------------------------- */
function AppTabs({ user, onLogout, reloadUser }) {
  const { colors } = useThemeApp();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let iconName = "•";
          if (route.name === "Dashboard") iconName = "📊";
          else if (route.name === "Add Expense") iconName = "➕";
          else if (route.name === "Insights") iconName = "💡";
          else if (route.name === "Profile") iconName = "👤";
          return <Text style={{ fontSize: size, color }}>{iconName}</Text>;
        },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
      })}
    >
      <Tab.Screen name="Dashboard">
        {(props) => <DashboardScreen {...props} user={user} />}
      </Tab.Screen>

      <Tab.Screen name="Add Expense">
        {(props) => (
          <AddExpenseScreen {...props} user={user} onExpenseAdded={reloadUser} />
        )}
      </Tab.Screen>

      <Tab.Screen name="Insights">
        {(props) => <InsightsScreen {...props} user={user} />}
      </Tab.Screen>

      {/* ✅ Profile now uses ProfileStack */}
      <Tab.Screen name="Profile">
        {(props) => (
          <ProfileStack
            {...props}
            user={user}
            onLogout={onLogout}
            reloadUser={reloadUser}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

/* ---------------------------
   Main App Stack
--------------------------- */
function MainAppStack({ user, onLogout, reloadUser }) {
  return (
    <AppStack.Navigator screenOptions={{ headerShown: false }}>
      <AppStack.Screen name="MainTabs">
        {(props) => (
          <AppTabs
            {...props}
            user={user}
            onLogout={onLogout}
            reloadUser={reloadUser}
          />
        )}
      </AppStack.Screen>
        <AppStack.Screen name="EditProfile" component={EditProfileScreen} />
        <AppStack.Screen name="Notifications" component={NotificationScreen} />
        <AppStack.Screen name="HelpSupport" component={HelpSupportScreen} />

     <AppStack.Screen name="Expenses">
  {(props) => (
    <ExpensesScreen
      {...props}
      user={user}
      onDataChange={reloadUser}   // ✅ this is what triggers refresh everywhere
    />
  )}
</AppStack.Screen>



      <AppStack.Screen name="ReceiptScan" component={ReceiptScanScreen} />
    </AppStack.Navigator>
  );
}

/* ---------------------------
   App Inner (uses Theme)
--------------------------- */
function AppInner() {
  const { navTheme, colors } = useThemeApp();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadUser = useCallback(async (email) => {
    if (!email) return;
    setLoading(true);
    try {
      const res = await api.getDashboardData(email);
      if (res?.success && res?.data) setUser(res.data);
      else setUser(null);
    } catch (err) {
      console.error("❌ loadUser failed:", err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const onLogin = useCallback(
    (loginData) => {
      if (loginData?.email) loadUser(loginData.email);
    },
    [loadUser]
  );

  const onLogout = useCallback(() => setUser(null), []);

  const reloadUser = useCallback(() => {
    if (user?.email) return loadUser(user.email);
  }, [user?.email, loadUser]);

  if (loading) {
    return (
      <View style={[styles.loaderContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <>
            <RootStack.Screen name="Login">
              {(props) => <LoginScreen {...props} onLogin={onLogin} />}
            </RootStack.Screen>

            <RootStack.Screen name="SignUp">
              {(props) => <SignUpScreen {...props} onLogin={onLogin} />}
            </RootStack.Screen>
          </>
        ) : (
          <RootStack.Screen name="App">
            {(props) => (
              <MainAppStack
                {...props}
                user={user}
                onLogout={onLogout}
                reloadUser={reloadUser}
              />
            )}
          </RootStack.Screen>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

/* ---------------------------
   Final Export wrapped with ThemeProvider
--------------------------- */
export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
