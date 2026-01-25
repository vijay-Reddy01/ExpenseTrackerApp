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
import colors from "../theme/colors";

export default function NavigationPanel({ onLogout, user, onProfileUpdate }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [newIncome, setNewIncome] = useState(user?.income > 0 ? String(user.income) : "");
  const [newUsername, setNewUsername] = useState(user?.username || "");

  const handleUpdateProfile = async () => {
    if (!newUsername.trim()) {
      Alert.alert("Missing Fields", "Please provide a username.");
      return;
    }
    if (newIncome === "" || isNaN(Number(newIncome))) {
      Alert.alert("Invalid Salary", "Please enter a valid monthly salary number.");
      return;
    }

    try {
      const res = await api.updateProfile({
        email: user.email,
        username: newUsername.trim(),
        income: Number(newIncome),
      });

      if (res.success) {
        Alert.alert("Success", "Your profile has been updated.");
        setModalVisible(false);
        // Best: trigger parent refresh (App.js already refetches user data)
        if (onProfileUpdate) onProfileUpdate();
      } else {
        Alert.alert("Error", res.message || "Failed to update profile.");
      }
    } catch (err) {
      Alert.alert("Error", err.message || "An unexpected error occurred.");
    }
  };

  const menuItems = [
    {
      id: "edit-profile",
      title: "Edit Profile",
      icon: "👤",
      onPress: () => {
        setNewUsername(user?.username || "");
        setNewIncome(user?.income > 0 ? user.income.toString() : "");
        setModalVisible(true);
      },
    },
    { id: "budget-goals", title: "Budget & Goals", icon: "🎯" },
    { id: "ai-prefs", title: "AI Preferences", icon: "🤖" },
    { id: "notifications", title: "Notifications", icon: "🔔" },
    { id: "data-sync", title: "Data & Sync", icon: "🔄" },
    { id: "help-support", title: "Help & Support", icon: "❓" },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.username?.[0]?.toUpperCase() || "U"}</Text>
        </View>
        <Text style={styles.username}>{user?.username || "User"}</Text>
        <Text style={styles.email}>{user?.email || "email@example.com"}</Text>
      </View>

      {menuItems.map((item) => (
        <TouchableOpacity key={item.id} style={styles.menuItem} onPress={item.onPress}>
          <Text style={styles.menuIcon}>{item.icon}</Text>
          <Text style={styles.menuText}>{item.title}</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutButtonText}>Log Out</Text>
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Profile</Text>

            <TextInput
              style={styles.input}
              placeholder="Username"
              value={newUsername}
              onChangeText={setNewUsername}
            />

            <TextInput
              style={styles.input}
              placeholder="Monthly Salary"
              keyboardType="numeric"
              value={newIncome}
              onChangeText={setNewIncome}
            />

            <TouchableOpacity style={styles.saveButton} onPress={handleUpdateProfile}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20 },
  profileHeader: { alignItems: "center", marginBottom: 30 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  avatarText: { fontSize: 32, color: "#FFFFFF", fontWeight: "bold" },
  username: { fontSize: 22, fontWeight: "bold", color: colors.text },
  email: { fontSize: 16, color: colors.muted },

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    marginBottom: 10,
  },
  menuIcon: { fontSize: 20, marginRight: 15 },
  menuText: { fontSize: 16, color: colors.text, flex: 1 },
  menuArrow: { fontSize: 20, color: colors.muted },

  logoutButton: {
    backgroundColor: "#F87171",
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 20,
  },
  logoutButtonText: { fontSize: 18, fontWeight: "600", color: "#FFFFFF" },

  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: { backgroundColor: colors.card, borderRadius: 12, padding: 20, width: "80%", alignItems: "center" },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 20 },

  input: {
    width: "100%",
    backgroundColor: colors.background,
    padding: 15,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 20,
  },
  saveButton: { backgroundColor: colors.primary, padding: 15, borderRadius: 8, width: "100%", alignItems: "center" },
  saveButtonText: { color: "#FFFFFF", fontWeight: "bold" },
  cancelButton: { marginTop: 10, padding: 10 },
  cancelButtonText: { color: colors.muted },
});
