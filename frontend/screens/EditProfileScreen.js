// screens/EditProfileScreen.js
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useThemeApp } from "../theme/ThemeContext";
import { api } from "../utils/api";

export default function EditProfileScreen({ navigation, route }) {
  const { colors } = useThemeApp();
  const styles = makeStyles(colors);

  // ✅ We will receive user + onProfileUpdate via route params
  const user = route?.params?.user;
  const onProfileUpdate = route?.params?.onProfileUpdate;

  const [username, setUsername] = useState(user?.username || "");
  const [income, setIncome] = useState(String(user?.income ?? ""));
  const [photoUrl, setPhotoUrl] = useState(user?.photoUrl || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // If route user changes
    setUsername(user?.username || "");
    setIncome(String(user?.income ?? ""));
    setPhotoUrl(user?.photoUrl || "");
  }, [user?.email]);

const pickPhoto = async () => {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Gallery permission is required to choose a photo.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,      // ✅ keep smaller
      base64: true,      // ✅ IMPORTANT
    });

    if (result.canceled) return;

    const asset = result.assets?.[0];
    if (!asset?.base64) {
      Alert.alert("Photo", "Could not read image data. Try again.");
      return;
    }

    // ✅ Save as Data URL (works on web + mobile and can be stored in MongoDB)
    const dataUrl = `data:image/jpeg;base64,${asset.base64}`;
    setPhotoUrl(dataUrl);
  } catch (e) {
    Alert.alert("Photo", e?.message || "Could not pick photo");
  }
};


  const onSave = async () => {
    const cleanName = String(username || "").trim();
    const incomeNum = Number(income);

    if (!user?.email) return Alert.alert("Error", "User email missing. Please login again.");
    if (!cleanName) return Alert.alert("Missing", "Please enter your name.");
    if (Number.isNaN(incomeNum) || incomeNum < 0) return Alert.alert("Invalid", "Income must be a valid number.");

    setSaving(true);
    try {
      const res = await api.updateProfile({
        email: user.email,
        username: cleanName,
        income: incomeNum,
        photoUrl: photoUrl || "",
      });

      if (!res?.success) {
        Alert.alert("Save failed", res?.message || "Could not update profile.");
        return;
      }

      // ✅ Refresh app-level user from DB (updates Dashboard/Insights/Profile)
      await onProfileUpdate?.();

      Alert.alert("Saved", "Profile updated successfully.");
      navigation.goBack();
    } catch (e) {
      Alert.alert("Save failed", e?.message || "Profile update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profile</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.content}>
        <TouchableOpacity onPress={pickPhoto} activeOpacity={0.9} style={styles.avatarWrap}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarLetter}>
                {(cleanFirstLetter(username) || "U").toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.changePhoto}>Change Photo</Text>
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={colors.muted}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Monthly Income</Text>
          <TextInput
            value={income}
            onChangeText={setIncome}
            style={styles.input}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.muted}
          />
        </View>

        <TouchableOpacity
          onPress={onSave}
          activeOpacity={0.9}
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          disabled={saving}
        >
          <Text style={styles.saveText}>{saving ? "Saving..." : "Save"}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function cleanFirstLetter(s) {
  const t = String(s || "").trim();
  return t ? t[0] : "";
}

const makeStyles = (colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    back: { color: colors.primary, fontWeight: "900", fontSize: 16 },
    title: { color: colors.text, fontWeight: "900", fontSize: 18 },

    content: { padding: 16, gap: 14 },

    avatarWrap: { alignItems: "center", marginBottom: 6 },
    avatar: { width: 96, height: 96, borderRadius: 48 },
    avatarFallback: {
      width: 96,
      height: 96,
      borderRadius: 48,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    avatarLetter: { color: "#fff", fontSize: 36, fontWeight: "900" },
    changePhoto: { marginTop: 10, color: colors.primary, fontWeight: "900" },

    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
    },
    label: { color: colors.muted, fontWeight: "800", marginBottom: 6 },
    input: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      color: colors.text,
      paddingVertical: 10,
      fontWeight: "800",
    },

    saveBtn: {
      marginTop: 6,
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
    },
    saveText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  });
