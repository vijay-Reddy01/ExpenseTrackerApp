// screens/EditProfileScreen.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useThemeApp } from "../theme/ThemeContext";
import { api } from "../utils/api";

export default function EditProfileScreen({ navigation, route }) {
  const { colors } = useThemeApp();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors, insets);

  const user = route?.params?.user;
  const onProfileUpdate = route?.params?.onProfileUpdate;

  const [username, setUsername] = useState(user?.username || "");
  const [income, setIncome] = useState(String(user?.income ?? ""));
  const [photoUrl, setPhotoUrl] = useState(user?.photoUrl || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setUsername(user?.username || "");
    setIncome(String(user?.income ?? ""));
    setPhotoUrl(user?.photoUrl || "");
  }, [user?.email]);

  const pickPhoto = async () => {
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
        base64: true,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.base64) {
        Alert.alert("Photo", "Could not read image data. Try again.");
        return;
      }

      setPhotoUrl(`data:image/jpeg;base64,${asset.base64}`);
    } catch (e) {
      Alert.alert("Photo", e?.message || "Could not pick photo");
    }
  };

  const onSave = async () => {
    const cleanName = String(username || "").trim();
    const incomeNum = Number(income);

    if (!user?.email) return Alert.alert("Error", "Login again");
    if (!cleanName) return Alert.alert("Missing", "Enter name");
    if (Number.isNaN(incomeNum) || incomeNum < 0) {
      return Alert.alert("Invalid", "Income must be a valid number");
    }

    setSaving(true);
    try {
      const res = await api.updateProfile({
        email: user.email,
        username: cleanName,
        income: incomeNum,
        photoUrl: photoUrl || "",
      });

      if (!res?.success) {
        Alert.alert("Failed", res?.message || "Could not update profile");
        return;
      }

      await onProfileUpdate?.();
      Alert.alert("Saved", "Profile updated");
      navigation.goBack();
    } catch (e) {
      Alert.alert("Error", e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* ✅ Custom top bar: back left + title centered */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>

        <Text style={styles.centerTitle}>Edit Profile</Text>

        {/* spacer keeps layout balanced */}
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.content}>
        <TouchableOpacity onPress={pickPhoto} activeOpacity={0.9} style={styles.avatarWrap}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarLetter}>{(username?.[0] || "U").toUpperCase()}</Text>
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

const makeStyles = (colors, insets) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },

    topBar: {
      marginTop: insets.top + 10, // ✅ pushed down
      paddingHorizontal: 16,
      paddingBottom: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    back: { color: colors.primary, fontWeight: "900", fontSize: 16 },

    // ✅ centered title even with back button
    centerTitle: {
      position: "absolute",
      left: 0,
      right: 0,
      textAlign: "center",
      fontSize: 20,
      fontWeight: "900",
      color: colors.text,
    },

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
      marginTop: 10,
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
    },

    saveText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  });
