// AddExpenseScreen.js
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Picker } from "@react-native-picker/picker";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

import DateField from "../components/DateField";
import { api } from "../utils/api";
import { useThemeApp } from "../theme/ThemeContext";
import { navCallbacks } from "../utils/navCallbacks";

export default function AddExpenseScreen({ user, navigation, onExpenseAdded }) {
  const { colors } = useThemeApp();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [date, setDate] = useState(new Date());
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("food");
  const [busy, setBusy] = useState(false);

  const email = String(user?.email || "").toLowerCase().trim();

  // ✅ Apply scanned/parsed values safely (supports different key names)
  const applyScanData = (raw) => {
    if (!raw || typeof raw !== "object") return;

    // accept multiple naming styles from backend OCR
    const pickedName =
      raw.name ??
      raw.title ??
      raw.merchant ??
      raw.store ??
      raw.vendor ??
      raw.description;

    const pickedAmount =
      raw.amount ??
      raw.total ??
      raw.cost ??
      raw.price ??
      raw.grandTotal ??
      raw.netAmount;

    const pickedCategory = raw.category ?? raw.type;

    const pickedDate = raw.date ?? raw.billDate ?? raw.transactionDate;

    try {
      if (pickedName != null) setName(String(pickedName).trim());
      if (pickedAmount != null && pickedAmount !== "") setAmount(String(pickedAmount));
      if (pickedCategory != null) setCategory(String(pickedCategory).toLowerCase());
      if (pickedDate) {
        const d = new Date(pickedDate);
        if (!Number.isNaN(d.getTime())) setDate(d);
      }
    } catch (e) {
      console.log("applyScanData error:", e);
    }
  };

  // ✅ Receive scan result via navCallbacks (ReceiptScanScreen should call this)
  useEffect(() => {
    navCallbacks.onReceiptScanned = (data) => {
      applyScanData(data);
      Alert.alert("Receipt scanned", "Values filled. Review and tap Add Expense.");
    };

    return () => {
      navCallbacks.onReceiptScanned = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Camera scan -> take photo -> send to backend -> fill values
  const onScanReceipt = async () => {
    try {
      if (!email) return Alert.alert("Error", "Please login again.");

      // Web camera often blocked / not consistent
      if (Platform.OS === "web") {
        navigation.navigate("ReceiptScan");
        return;
      }

      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permission needed", "Camera permission is required to scan receipts.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.85,
        allowsEditing: false,
      });

      if (result.canceled) return;

      const uri = result.assets?.[0]?.uri;
      if (!uri) return;

      if (typeof api.scanReceipt !== "function") {
        Alert.alert(
          "Scan not configured",
          "api.scanReceipt() is missing in utils/api.js. Add it and try again."
        );
        return;
      }

      setBusy(true);
      const res = await api.scanReceipt({ imageUri: fileAsset.uri, email: user.email });

      if (!res?.success) {
        Alert.alert("Scan failed", res?.message || "Could not read receipt.");
        return;
      }

      // Image OCR result
      if (res.type === "image") {
        applyScanData(res.data);
        Alert.alert("Scanned", "Values filled. Review and tap Add Expense.");
        return;
      }

      // PDF result list
      if (res.type === "pdf") {
        const list = Array.isArray(res.data) ? res.data : [];
        if (!list.length) return Alert.alert("PDF", "No readable entries found.");

        // auto-fill first item for convenience
        applyScanData(list[0]);
        Alert.alert("PDF Parsed", "First entry filled. You can also import all from Upload.");
      }
    } catch (e) {
      console.log("onScanReceipt error:", e);
      Alert.alert("Scan failed", e?.message || "Scan failed");
    } finally {
      setBusy(false);
    }
  };

  // ✅ Upload Receipt (image/pdf) -> send to backend -> fill values / import list
  const uploadReceipt = async () => {
    try {
      if (!email) return Alert.alert("Error", "Please login again.");

      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const fileAsset = result.assets?.[0];
      if (!fileAsset?.uri) return;

      if (typeof api.scanReceipt !== "function") {
        Alert.alert(
          "Upload not configured",
          "api.scanReceipt() is missing in utils/api.js. Add it and try again."
        );
        return;
      }

      setBusy(true);
      const res = await api.scanReceipt({
        imageUri: fileAsset.uri,
        // some web pickers include file object; keep it if your api.js uses it
        file: Platform.OS === "web" ? fileAsset.file : undefined,
        email,
      });

      if (!res?.success) {
        Alert.alert("Upload", res?.message || "Could not read file.");
        return;
      }

      // ✅ image: auto fill fields
      if (res.type === "image") {
        applyScanData(res.data);
        Alert.alert("Uploaded", "Values filled. Review and tap Add Expense.");
        return;
      }

      // ✅ pdf: import multiple rows into DB
      if (res.type === "pdf") {
        const list = Array.isArray(res.data) ? res.data : [];
        if (!list.length) {
          Alert.alert("PDF", "No readable entries found.");
          return;
        }

        let added = 0;
        for (const item of list) {
          const amt = Number(item.amount ?? item.total ?? item.cost);
          const d = item.date;
          if (!d || !amt || Number.isNaN(amt) || amt <= 0) continue;

          await api.addExpense({
            email,
            date: new Date(d).toISOString(),
            amount: amt,
            name: String(item.name || item.merchant || "Expense"),
            category: String(item.category || "other").toLowerCase(),
          });

          added++;
        }

        onExpenseAdded?.();
        Alert.alert("PDF Imported", `Added ${added} expenses.`);
        navigation.navigate("Dashboard");
      }
    } catch (e) {
      console.log("uploadReceipt error:", e);
      Alert.alert("Upload failed", e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const handleAddExpense = async () => {
    if (!email) return Alert.alert("Error", "Please login again.");

    const amt = Number(amount);

    if (!String(name).trim()) return Alert.alert("Missing", "Enter expense name");
    if (!amt || Number.isNaN(amt) || amt <= 0) return Alert.alert("Invalid", "Enter valid amount");

    try {
      setBusy(true);

      await api.addExpense({
        email,
        date: date.toISOString(),
        amount: amt,
        name: String(name).trim(),
        category: String(category || "other").toLowerCase(),
      });

      Alert.alert("Success", "Expense added");
      onExpenseAdded?.();

      setName("");
      setAmount("");
      setCategory("food");
      setDate(new Date());

      navigation.navigate("Dashboard");
    } catch (e) {
      console.log("Add expense error:", e);
      Alert.alert("Error", e?.message || "Failed to add expense");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* ✅ Scan button */}
      <TouchableOpacity
        onPress={onScanReceipt}
        activeOpacity={0.85}
        style={[
          styles.scanFloatBtn,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Image
          source={require("../assets/scanIcon.png")}
          style={styles.scanIcon}
          resizeMode="contain"
        />
      </TouchableOpacity>

      {busy && (
        <View style={styles.busyOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.busyText}>Processing…</Text>
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.pageTitle}>Add Expense</Text>

          <View style={styles.card}>
            <Text style={styles.label}>Expense Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Coffee"
              placeholderTextColor={colors.muted}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Amount</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="₹0"
              placeholderTextColor={colors.muted}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={category} onValueChange={setCategory}>
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
            <DateField label="Date" value={date} onChange={setDate} stylesObj={styles} />
          </View>

          <TouchableOpacity style={styles.uploadBtn} onPress={uploadReceipt} activeOpacity={0.9}>
            <Text style={styles.uploadBtnText}>+ Upload Receipt</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btn} onPress={handleAddExpense} activeOpacity={0.9}>
            <Text style={styles.btnText}>Add Expense</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },

    content: {
      padding: 16,
      paddingTop: 70,
      gap: 14,
      paddingBottom: 110,
      backgroundColor: colors.background,
    },

    pageTitle: { fontSize: 22, fontWeight: "900", color: colors.text, marginBottom: 6 },

    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },

    label: { color: colors.muted, fontWeight: "800", marginBottom: 6 },

    input: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      color: colors.text,
      paddingVertical: 10,
    },

    pickerWrap: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      overflow: "hidden",
      backgroundColor: colors.background,
    },

    scanFloatBtn: {
      position: "absolute",
      top: 16,
      right: 16,
      zIndex: 99,
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
    },

    scanIcon: { width: 24, height: 24 },

    uploadBtn: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      borderRadius: 14,
      alignItems: "center",
    },

    uploadBtnText: { color: colors.text, fontWeight: "900" },

    btn: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 14,
      alignItems: "center",
    },

    btnText: { color: "#fff", fontWeight: "900" },

    busyOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 200,
      backgroundColor: "rgba(0,0,0,0.25)",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    busyText: { color: "#fff", fontWeight: "900" },
  });
