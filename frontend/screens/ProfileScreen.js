// screens/ProfileScreen.js
import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  Platform
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useThemeApp } from "../theme/ThemeContext";

export default function ProfileScreen({ navigation, user, onLogout, onProfileUpdate }) {
  const { toggleTheme, mode, colors } = useThemeApp();
  const styles = makeStyles(colors);

  const profile = useMemo(() => {
    return {
      name: user?.username || "User",
      email: user?.email || "",
      income: Number(user?.income || 0),
      photoUrl: user?.photoUrl || "",
    };
  }, [user?.username, user?.email, user?.income, user?.photoUrl]);

  const logout = () => {
  if (Platform.OS === "web") {
    const ok = window.confirm("Logout?");
    if (ok) onLogout?.();
    return;
  }

  Alert.alert("Logout?", "Are you sure?", [
    { text: "Cancel", style: "cancel" },
    { text: "Logout", style: "destructive", onPress: () => onLogout?.() },
  ]);
};


  // ✅ Pick photo as BASE64 and go to EditProfile
  // (EditProfile will save to DB on Save)
  const pickImageAndGoEdit = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Gallery permission is required.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true, // ✅ IMPORTANT
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.base64) {
        Alert.alert("Photo", "Could not read image data. Try again.");
        return;
      }

      // ✅ Data URL works on web + mobile and can be stored in MongoDB
      const dataUrl = `data:image/jpeg;base64,${asset.base64}`;

      navigation.navigate("EditProfile", {
        user: { ...user, photoUrl: dataUrl },
        onProfileUpdate,
      });
    } catch (e) {
      Alert.alert("Photo", e?.message || "Could not pick photo");
    }
  };

  const goEditProfile = () => {
    navigation.navigate("EditProfile", {
      user,
      onProfileUpdate,
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Theme toggle */}
      <TouchableOpacity
        onPress={toggleTheme}
        activeOpacity={0.85}
        style={[
          styles.themeToggleBtn,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={{ fontSize: 18 }}>{mode === "dark" ? "🌙" : "☀️"}</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        {profile.photoUrl ? (
          <Image source={{ uri: profile.photoUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarLetter}>
              {(profile.name?.[0] || "U").toUpperCase()}
            </Text>
          </View>
        )}

        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.email}>{profile.email}</Text>

        <View style={styles.incomePill}>
          <Text style={styles.incomeText}>Monthly Income: ₹{profile.income}</Text>
        </View>

        <TouchableOpacity style={styles.photoBtn} onPress={pickImageAndGoEdit} activeOpacity={0.9}>
          <Text style={styles.photoText}>Change Photo</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <MenuItem icon="👤" title="Edit Profile" onPress={goEditProfile} colors={colors} />

        <MenuItem
          icon="🔔"
          title="Notifications"
          onPress={() => navigation.navigate("Notifications")}
          colors={colors}
        />

        <MenuItem
          icon="❓"
          title="Help & Support"
          onPress={() => navigation.navigate("HelpSupport")}
          colors={colors}
        />

        <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.9}>
  <Text style={styles.logoutText}>Log Out</Text>
</TouchableOpacity>


        <Text style={styles.themeHint}>
          Current theme: {mode === "dark" ? "Dark" : "Light"}
        </Text>
      </View>
    </ScrollView>
  );
}

function MenuItem({ icon, title, onPress, colors }) {
  const s = itemStyles(colors);
  return (
    <TouchableOpacity style={s.menuItem} onPress={onPress} activeOpacity={0.85}>
      <Text style={s.menuIcon}>{icon}</Text>
      <Text style={s.menuTitle}>{title}</Text>
      <Text style={s.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const itemStyles = (colors) =>
  StyleSheet.create({
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    menuIcon: { fontSize: 18, width: 34 },
    menuTitle: { flex: 1, fontWeight: "800", color: colors.text },
    chevron: { fontSize: 22, color: colors.muted },
  });

const makeStyles = (colors) =>
  StyleSheet.create({
    container: {
      padding: 16,
      flexGrow: 1,
      backgroundColor: colors.background,
      paddingBottom: 110,
    },

    themeToggleBtn: {
      position: "absolute",
      top: 16,
      right: 16,
      zIndex: 99,
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
    },

    header: { alignItems: "center", marginTop: 40, marginBottom: 16 },

    avatar: { width: 90, height: 90, borderRadius: 45, marginBottom: 10 },

    avatarFallback: {
      width: 90,
      height: 90,
      borderRadius: 45,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
      backgroundColor: colors.primary,
    },

    avatarLetter: { color: "#fff", fontSize: 36, fontWeight: "900" },

    name: { fontSize: 20, fontWeight: "900", color: colors.text },
    email: { marginTop: 3, color: colors.muted },

    incomePill: {
      marginTop: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 999,
    },

    incomeText: { color: colors.text, fontWeight: "900" },

    photoBtn: {
      marginTop: 12,
      backgroundColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 18,
      borderRadius: 14,
    },

    photoText: { color: "#fff", fontWeight: "900" },

    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },

    logoutBtn: {
      marginTop: 14,
      backgroundColor: "#F87171",
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
    },

    logoutText: { color: "#fff", fontWeight: "900" },

    themeHint: {
      marginTop: 10,
      textAlign: "center",
      color: colors.muted,
      fontWeight: "700",
      fontSize: 12,
    },
  });
