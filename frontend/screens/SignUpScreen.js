import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { api } from "../utils/api";
import colors from "../theme/colors";

export default function SignUpScreen({ navigation, onLogin }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = async () => {
    try {
      if (!username.trim()) {
        Alert.alert("Validation", "Enter your name.");
        return;
      }
      if (!email || !email.includes("@")) {
        Alert.alert("Validation", "Enter a valid email.");
        return;
      }
      if (!password || password.length < 3) {
        Alert.alert("Validation", "Password must be at least 3 characters.");
        return;
      }

      const res = await api.signup({
        username: username.trim(),
        email: email.trim(),
        password,
      });

      if (res?.success && res?.user?.email) {
        onLogin(res.user); // ✅ App.js will switch to Tabs
        return;
      }

      Alert.alert("Signup failed", res?.message || "Could not create account");
    } catch (err) {
      Alert.alert("Error", err.message || "Signup failed");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Start tracking your expenses today</Text>

      <TextInput
        style={styles.input}
        placeholder="Full Name"
        value={username}
        onChangeText={setUsername}
      />

      <TextInput
        style={styles.input}
        placeholder="Email Address"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {/* ✅ FIXED: correct function name */}
      <TouchableOpacity style={styles.button} onPress={handleSignup}>
        <Text style={styles.buttonText}>Sign Up</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate("Login")}>
        <Text style={styles.link}>
          Already have an account? <Text style={styles.linkHighlight}>Log In</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: colors.background },
  title: { fontSize: 28, fontWeight: "bold", color: colors.text, marginBottom: 10 },
  subtitle: { fontSize: 16, color: colors.muted, marginBottom: 30 },
  input: {
    width: "100%",
    backgroundColor: colors.card,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: { width: "100%", backgroundColor: colors.primary, paddingVertical: 18, borderRadius: 12, alignItems: "center", marginTop: 10 },
  buttonText: { color: "#FFFFFF", fontSize: 18, fontWeight: "600" },
  link: { marginTop: 20, color: colors.muted, fontSize: 14 },
  linkHighlight: { color: colors.primary, fontWeight: "600" },
});
