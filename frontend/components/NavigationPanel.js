import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { api } from "../utils/api";
import { useThemeApp } from "../theme/ThemeContext";

export default function NavigationPanel({ onLogout, user, onProfileUpdate }) {
  const { colors } = useThemeApp();
  const styles = makeStyles(colors);

  const [modalVisible, setModalVisible] = useState(false);
  const [newIncome, setNewIncome] = useState(user?.income > 0 ? String(user.income) : "");
  const [newUsername, setNewUsername] = useState(user?.username || "");

  const handleUpdateProfile = async () => {
    if (!newUsername.trim()) return Alert.alert("Missing", "Enter username");
    if (!newIncome || isNaN(Number(newIncome))) return Alert.alert("Invalid", "Enter valid income");

    try {
      const res = await api.updateProfile({
        email: user.email,
        username: newUsername.trim(),
        income: Number(newIncome),
      });

      if (res?.success) {
        Alert.alert("Updated");
        setModalVisible(false);
        onProfileUpdate?.();
      } else Alert.alert("Error", res?.message);
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  };

  const menuItems = [
    {
      title: "Edit Profile",
      icon: "👤",
      onPress: () => {
        setNewUsername(user?.username || "");
        setNewIncome(user?.income?.toString() || "");
        setModalVisible(true);
      },
    },
    { title: "Budget & Goals", icon: "🎯" },
    { title: "AI Preferences", icon: "🤖" },
    { title: "Notifications", icon: "🔔" },
    { title: "Help & Support", icon: "❓" },
  ];

  return (
    <ScrollView style={styles.container}>

      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.username?.[0]?.toUpperCase() || "U"}</Text>
        </View>

        <Text style={styles.username}>{user?.username}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      {menuItems.map((item, i) => (
        <TouchableOpacity key={i} style={styles.menuItem} onPress={item.onPress}>
          <Text style={styles.menuIcon}>{item.icon}</Text>
          <Text style={styles.menuText}>{item.title}</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutButtonText}>Log Out</Text>
      </TouchableOpacity>

      {/* Modal */}

      <Modal transparent visible={modalVisible}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Profile</Text>

            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor={colors.muted}
              value={newUsername}
              onChangeText={setNewUsername}
            />

            <TextInput
              style={styles.input}
              placeholder="Monthly Income"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              value={newIncome}
              onChangeText={setNewIncome}
            />

            <TouchableOpacity style={styles.saveBtn} onPress={handleUpdateProfile}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 16 },

    profileHeader: { alignItems: "center", marginBottom: 24 },

    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
    },

    avatarText: { color: "#fff", fontSize: 30, fontWeight: "900" },

    username: { color: colors.text, fontSize: 22, fontWeight: "900" },
    email: { color: colors.muted },

    menuItem: {
      flexDirection: "row",
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 14,
      alignItems: "center",
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },

    menuIcon: { fontSize: 18, marginRight: 10 },
    menuText: { color: colors.text, flex: 1, fontWeight: "700" },
    menuArrow: { color: colors.muted, fontSize: 20 },

    logoutButton: {
      marginTop: 20,
      backgroundColor: "#F87171",
      padding: 16,
      borderRadius: 14,
      alignItems: "center",
    },

    logoutButtonText: { color: "#fff", fontWeight: "900" },

    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
    },

    modalContent: {
      backgroundColor: colors.card,
      padding: 20,
      borderRadius: 16,
      width: "85%",
      borderWidth: 1,
      borderColor: colors.border,
    },

    modalTitle: { color: colors.text, fontWeight: "900", fontSize: 18, marginBottom: 16 },

    input: {
      backgroundColor: colors.background,
      borderRadius: 10,
      padding: 12,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
    },

    saveBtn: {
      backgroundColor: colors.primary,
      padding: 14,
      borderRadius: 12,
      alignItems: "center",
      marginTop: 8,
    },

    saveText: { color: "#fff", fontWeight: "900" },

    cancelText: { marginTop: 10, textAlign: "center", color: colors.muted },
  });
