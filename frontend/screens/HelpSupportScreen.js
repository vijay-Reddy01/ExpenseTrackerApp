import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeApp } from "../theme/ThemeContext";

const ADMIN_PHONE = "+91 9515404432";
const ADMIN_EMAIL = "vijay.projectofficial@gmail.com";
const ADDRESS =
  "21st floor mroads, orbit building, Panmaktha, Serilingampalle (M, Rai Durg, Hyderabad, Telangana 500032";

export default function HelpSupportScreen() {
  const { colors, isDark } = useThemeApp();
  const styles = makeStyles(colors, isDark);

  const callAdmin = async () => {
    try {
      const phone = ADMIN_PHONE.replace(/\s/g, "");
      const url = `tel:${phone}`;
      const supported = await Linking.canOpenURL(url);
      if (!supported) return Alert.alert("Not supported", "Calling is not supported on this device.");
      await Linking.openURL(url);
    } catch {
      Alert.alert("Error", "Could not open dialer.");
    }
  };

  const mailAdmin = async () => {
    try {
      const url = `mailto:${ADMIN_EMAIL}`;
      const supported = await Linking.canOpenURL(url);
      if (!supported) return Alert.alert("Not supported", "Email is not supported on this device.");
      await Linking.openURL(url);
    } catch {
      Alert.alert("Error", "Could not open email app.");
    }
  };

  const openMaps = async () => {
    try {
      const query = encodeURIComponent(ADDRESS);
      const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
      const supported = await Linking.canOpenURL(url);
      if (!supported) return Alert.alert("Not supported", "Maps is not supported on this device.");
      await Linking.openURL(url);
    } catch {
      Alert.alert("Error", "Could not open maps.");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.container}>
        <Text style={styles.title}>Help & Support</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Admin Phone</Text>
          <TouchableOpacity onPress={callAdmin} activeOpacity={0.85} style={styles.actionRow}>
            <Text style={styles.linkText}>{ADMIN_PHONE}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <Text style={styles.label}>Admin Email</Text>
          <TouchableOpacity onPress={mailAdmin} activeOpacity={0.85} style={styles.actionRow}>
            <Text style={styles.linkText}>{ADMIN_EMAIL}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <Text style={styles.label}>Address</Text>
          <TouchableOpacity onPress={openMaps} activeOpacity={0.85} style={styles.addressRow}>
            <Text style={styles.addressText}>{ADDRESS}</Text>
            <Text style={styles.mapHint}>Tap to open in Maps</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors, isDark) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1, backgroundColor: colors.background, padding: 16 },

    title: { fontSize: 20, fontWeight: "900", marginBottom: 14, color: colors.text },

    card: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOpacity: isDark ? 0.18 : 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3,
    },

    label: { marginTop: 6, color: colors.muted, fontWeight: "900", fontSize: 12 },

    actionRow: {
      marginTop: 10,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },

    linkText: { flex: 1, color: colors.primary, fontWeight: "900", fontSize: 16 },

    chevron: { color: colors.muted, fontSize: 22, fontWeight: "800" },

    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 12,
    },

    addressRow: {
      marginTop: 10,
      paddingVertical: 6,
    },

    addressText: { color: colors.text, fontWeight: "700", lineHeight: 22 },

    mapHint: { marginTop: 8, color: colors.muted, fontWeight: "700" },
  });
