import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useThemeApp } from "../theme/ThemeContext";

const STORAGE_KEYS = {
  EXPENSES: "EXPENSES_LIST",
};

export default function NotificationsScreen() {
  const { colors, isDark } = useThemeApp();
  const styles = makeStyles(colors, isDark);

  const [message, setMessage] = useState("Loading notifications...");

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.EXPENSES);
      const expenses = raw ? JSON.parse(raw) : [];
      setMessage(
        !Array.isArray(expenses) || expenses.length === 0
          ? "Add expenses to get insights."
          : "Welcome back! Your insights are ready."
      );
    } catch {
      setMessage("Could not load notifications.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notifications</Text>

      <View style={styles.noticeCard}>
        <Text style={styles.noticeText}>{message}</Text>
      </View>
    </View>
  );
}

const makeStyles = (colors, isDark) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 16 },

    title: { fontSize: 20, fontWeight: "900", marginBottom: 14, color: colors.text },

    noticeCard: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOpacity: isDark ? 0.25 : 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3,
    },

    noticeText: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      lineHeight: 22,
      textAlign: "center",
    },
  });
