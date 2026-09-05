// frontend/screens/AddExpenseScreen.js
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Picker } from "@react-native-picker/picker";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

import DateField from "../components/DateField";
import { api } from "../utils/api";
import { useThemeApp } from "../theme/ThemeContext";
import { navCallbacks } from "../utils/navCallbacks";
import TransactionPickerModal from "../components/TransactionPickerModal";

export default function AddExpenseScreen({ user, navigation, onExpenseAdded }) {
  const { colors } = useThemeApp();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [date, setDate] = useState(new Date());
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("food");
  const [busy, setBusy] = useState(false);

  const email = String(user?.email || "").toLowerCase().trim();

  const [txModalVisible, setTxModalVisible] = useState(false);
  const [extractedTx, setExtractedTx] = useState([]);

  const applyScanData = (raw) => {
    if (!raw || typeof raw !== "object") return;

    const pickedName =
      raw.name ?? raw.title ?? raw.merchant ?? raw.store ?? raw.vendor ?? raw.description;

    const pickedAmount =
      raw.amount ?? raw.total ?? raw.cost ?? raw.price ?? raw.grandTotal ?? raw.netAmount;

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

  useEffect(() => {
    navCallbacks.onReceiptScanned = (data) => {
      applyScanData(data);
      Alert.alert("Receipt scanned", "Values filled. Review and tap Add Expense.");
    };
    return () => {
      navCallbacks.onReceiptScanned = null;
    };
  }, []);

  const extractTxListFromScanResponse = (res) => {
    const candidates = [
      res?.data,
      res?.data?.transactions,
      res?.data?.items,
      res?.data?.rows,
      res?.data?.result,
      res?.data?.results,
      res?.data?.data,
      res?.transactions,
      res?.items,
      res?.rows,
    ];
    for (const c of candidates) {
      if (Array.isArray(c)) return c;
    }
    const deep1 = res?.data?.data?.transactions;
    const deep2 = res?.data?.data?.items;
    if (Array.isArray(deep1)) return deep1;
    if (Array.isArray(deep2)) return deep2;
    return [];
  };

  const normalizeTransactions = (list) =>
    (list || []).map((t, idx) => ({
      tempId: t.tempId || `tx_${idx + 1}`,
      slno: t.slno ?? idx + 1,
      name: String(t.name || t.merchant || t.description || "Expense"),
      date: String(t.date || t.transactionDate || t.billDate || ""),
      amount: Number(t.amount ?? t.total ?? t.cost ?? 0),
      category: String(t.category || "other").toLowerCase(),
    }));

  const openTxModalWithList = (list) => {
    const normalized = normalizeTransactions(list);
    setExtractedTx(normalized);
    setTxModalVisible(true);
  };

  // ✅ SCAN: camera
  const handleScanButton = async () => {
    try {
      if (!email) return Alert.alert("Error", "Please login again.");

      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permission needed", "Camera permission is required to scan receipts.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
      });

      if (result.canceled) return;

      const uri = result.assets?.[0]?.uri;
      if (!uri) return Alert.alert("Error", "Camera did not return an image.");

      setBusy(true);
      const res = await api.scanReceipt({ imageUri: uri, email });

      if (!res?.success) {
        Alert.alert("Scan failed", res?.message || "Could not read receipt.");
        return;
      }

      if (res.type === "image") {
        applyScanData(res.data);
        Alert.alert("Scanned", "Values filled. Review and tap Add Expense.");
        return;
      }

      if (res.type === "pdf") {
        const list = extractTxListFromScanResponse(res);
        if (!list.length) return Alert.alert("PDF", "No readable entries found.");
        openTxModalWithList(list);
      }
    } catch (e) {
      console.log("handleScanButton error:", e);
      Alert.alert("Scan failed", e?.message || "Scan failed");
    } finally {
      setBusy(false);
    }
  };

  // ✅ UPLOAD: file picker
  const handleUploadButton = async () => {
    try {
      if (!email) return Alert.alert("Error", "Please login again.");

      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      const uri = asset?.uri;
      if (!uri) return Alert.alert("Error", "Could not read selected file.");

      setBusy(true);
      const res = await api.scanReceipt({ imageUri: uri, email });

      if (!res?.success) {
        Alert.alert("Upload failed", res?.message || "Could not read file.");
        return;
      }

      if (res.type === "image") {
        applyScanData(res.data);
        Alert.alert("Uploaded", "Values filled. Review and tap Add Expense.");
        return;
      }

      if (res.type === "pdf") {
        const list = extractTxListFromScanResponse(res);
        if (!list.length) return Alert.alert("PDF", "No readable entries found.");
        openTxModalWithList(list);
      }
    } catch (e) {
      console.log("handleUploadButton error:", e);
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

  // ✅ THIS is what your Save Selected must do
  const saveSelectedPdfTransactions = async (selectedTransactions) => {
    try {
      if (!email) return Alert.alert("Error", "Please login again.");
      if (!selectedTransactions?.length) return Alert.alert("Select", "Select at least 1 transaction.");

      setBusy(true);

      let added = 0;

      // (optional) add sequentially (safe)
      for (const t of selectedTransactions) {
        const amt = Number(t.amount);
        const d = new Date(t.date);

        if (!t.name || !String(t.name).trim()) continue;
        if (Number.isNaN(d.getTime())) continue;
        if (!amt || Number.isNaN(amt) || amt <= 0) continue;

        await api.addExpense({
          email,
          date: d.toISOString(),
          amount: amt,
          name: String(t.name).trim(),
          category: String(t.category || "other").toLowerCase(),
        });

        added++;
      }

      setTxModalVisible(false); // ✅ close modal
      onExpenseAdded?.();       // ✅ refresh dashboard data in parent
      Alert.alert("Saved", `Added ${added} expenses from PDF.`);
      navigation.navigate("Dashboard");
    } catch (e) {
      console.log("saveSelectedPdfTransactions error:", e);
      Alert.alert("Error", e?.message || "Failed to save selected transactions");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <TouchableOpacity
        onPress={handleScanButton}
        activeOpacity={0.85}
        style={[
          styles.scanFloatBtn,
          {
            top: insets.top + 10,
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <Image
          source={require("../assets/scanIcon.png")}
          style={styles.scanIcon}
          resizeMode="contain"
        />
      </TouchableOpacity>

      <TouchableOpacity
  style={styles.scanBtn}
  onPress={() => navigation.navigate("Scanner")}
>
  <Text style={styles.scanBtnText}>Open Scanner</Text>
</TouchableOpacity>


      {busy && (
        <View style={styles.busyOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.busyText}>Processing…</Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 80 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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
              <Picker
                selectedValue={category}
                onValueChange={setCategory}
                style={{ color: colors.text }}
                dropdownIconColor={colors.text}
              >
                <Picker.Item label="Food" value="food" color={colors.text} />
                <Picker.Item label="Shopping" value="shopping" color={colors.text} />
                <Picker.Item label="Clothing" value="clothing" color={colors.text} />
                <Picker.Item label="Groceries" value="groceries" color={colors.text} />
                <Picker.Item label="Travel" value="travel" color={colors.text} />
                <Picker.Item label="Medical" value="medical" color={colors.text} />
                <Picker.Item label="Other" value="other" color={colors.text} />
              </Picker>
            </View>
          </View>

          <View style={styles.card}>
            <DateField label="Date" value={date} onChange={setDate} stylesObj={styles} />
          </View>

          <TouchableOpacity style={styles.uploadBtn} onPress={handleUploadButton} activeOpacity={0.9}>
            <Text style={styles.uploadBtnText}>+ Upload Receipt</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btn} onPress={handleAddExpense} activeOpacity={0.9}>
            <Text style={styles.btnText}>Add Expense</Text>
          </TouchableOpacity>

          <View style={{ height: 120 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <TransactionPickerModal
        visible={txModalVisible}
        transactions={extractedTx}
        onClose={() => setTxModalVisible(false)}
        onConfirm={saveSelectedPdfTransactions}
        theme={{
          background: "#ffffff",
          card: "#f3f4f6",
          text: "#0b1220",
          subText: "#475569",
          border: "rgba(15,23,42,0.12)",
          primary: colors.primary,
        }}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: {
      padding: 16,
      paddingTop: 20,
      gap: 14,
      paddingBottom: 140,
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
