import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { api } from "../utils/api";
import { useThemeApp } from "../theme/ThemeContext";
import { center } from "@shopify/react-native-skia";

export default function LoginScreen({ navigation, onLogin }) {
  const { colors, isDark } = useThemeApp();
  const styles = makeStyles(colors, isDark);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      const e = email.trim();

      if (!e || !e.includes("@")) return Alert.alert("Validation", "Enter a valid email.");
      if (!password || password.length < 3) return Alert.alert("Validation", "Enter your password.");

      setLoading(true);
      const res = await api.login(e, password);

      if (res?.success && res?.user?.email) {
        onLogin?.(res.user);
        return;
      }

      Alert.alert("Login failed", res?.message || "Invalid credentials");
    } catch (err) {
      Alert.alert("Error", err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* ✅ APP TITLE */}
        <Text style={styles.appTitle}>Welcome to AiExpenseTracker</Text>

        <View style={styles.card}>
          <Text style={styles.title}>Welcome Back👋</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor={colors.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.muted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? "Logging in..." : "Login"}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate("SignUp")} style={styles.linkWrap}>
            <Text style={styles.link}>
              Don't have an account? <Text style={styles.linkHighlight}>Sign Up</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors, isDark) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },

    container: {
      flexGrow: 1,
      justifyContent: "center",
      padding: 20,
    },

    /* ✅ CENTER TITLE */
    appTitle: {
      textAlign: "center",
      fontSize: 26,
      fontWeight: "900",
      color: colors.primary,
      marginBottom: 24,
    },

    card: {
      backgroundColor: colors.card,
      borderRadius: 22,
      padding: 22,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOpacity: isDark ? 0.25 : 0.1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },

    title: { fontSize: 22, fontWeight: "900", color: colors.text,textAlign: "center" },
    subtitle: { marginTop: 4, marginBottom: 18, color: colors.muted },

    label: { marginTop: 12, marginBottom: 6, color: colors.muted, fontWeight: "800" },

    input: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
    },

    button: {
      marginTop: 20,
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
    },

    buttonDisabled: { opacity: 0.7 },

    buttonText: { color: "#fff", fontWeight: "900", fontSize: 16 },

    linkWrap: { marginTop: 18, alignItems: "center" },

    link: { color: colors.muted },

    linkHighlight: { color: colors.primary, fontWeight: "900" },
  });
