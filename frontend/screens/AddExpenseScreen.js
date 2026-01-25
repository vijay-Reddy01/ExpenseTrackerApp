import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { api } from "../utils/api";
import colors from "../theme/colors";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";

export default function AddExpenseScreen({ user, navigation, onExpenseAdded }) {
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");

  // ✅ MUST match backend enum: food, shopping, clothing, groceries, travel, medical, other
  const [category, setCategory] = useState("food");

  const handleAddExpense = async () => {
    if (!user?.email) {
      Alert.alert("Not logged in", "Please login again.");
      return;
    }

    const amt = Number(amount);
    if (!name.trim()) {
      Alert.alert("Missing Fields", "Please enter expense name.");
      return;
    }
    if (!amount || Number.isNaN(amt) || amt <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount greater than 0.");
      return;
    }
    if (!category) {
      Alert.alert("Missing Fields", "Please select a category.");
      return;
    }

    try {
      const res = await api.addExpense({
        email: user.email,
        date: date.toISOString(),
        amount: amt,
        name: name.trim(),
        category, // ✅ lowercase
      });

      Alert.alert("Success", res?.message || "Expense added!");

      // ✅ Refresh dashboard data from App.js
      onExpenseAdded?.();

      // ✅ Reset fields
      setName("");
      setAmount("");
      setCategory("food");
      setDate(new Date());

      // ✅ Since you're in Tab navigator, just switch tab
      navigation.navigate("Dashboard");
    } catch (err) {
      Alert.alert("Error", err.message || "Failed to add expense.");
      console.log("Add expense error:", err);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Add Expense</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Expense Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Coffee, Lunch"
          value={name}
          onChangeText={setName}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Amount</Text>
        <TextInput
          style={styles.input}
          placeholder="₹0.00"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Category</Text>
        <View style={styles.pickerWrapper}>
          <Picker selectedValue={category} onValueChange={(v) => setCategory(v)}>
            <Picker.Item label="Food" value="food" />
            <Picker.Item label="Shopping" value="shopping" />
            <Picker.Item label="Clothing" value="clothing" />
            <Picker.Item label="Groceries" value="groceries" />
            <Picker.Item label="Travel" value="travel" />
            <Picker.Item label="Medical" value="medical" />
            <Picker.Item label="Other" value="other" />
          </Picker>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Date</Text>
        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          style={styles.datePickerInput}
        >
          <Text style={styles.datePickerText}>{date.toLocaleDateString()}</Text>
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(event, selectedDate) => {
              setShowDatePicker(Platform.OS === "ios");
              if (selectedDate) setDate(selectedDate);
            }}
          />
        )}
      </View>

      <TouchableOpacity style={styles.addButton} onPress={handleAddExpense}>
        <Text style={styles.addButtonText}>Add Expense</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20 },
  header: { marginBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: "bold", color: colors.text },

  card: { backgroundColor: colors.card, borderRadius: 12, padding: 20, marginBottom: 20 },
  label: { fontSize: 16, color: colors.muted, marginBottom: 10 },

  input: {
    fontSize: 18,
    color: colors.text,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  pickerWrapper: { borderRadius: 8, overflow: "hidden" },

  datePickerInput: { paddingVertical: 12 },
  datePickerText: { fontSize: 16, color: colors.text },

  addButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 10,
  },
  addButtonText: { fontSize: 18, fontWeight: "600", color: "#FFFFFF" },
});
