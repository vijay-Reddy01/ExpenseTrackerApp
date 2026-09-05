import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";

import { useThemeApp } from "../theme/ThemeContext";
import { api } from "../utils/api";
import { navCallbacks } from "../utils/navCallbacks";

export default function ReceiptScanScreen({ navigation, route }) {
  const { colors } = useThemeApp();
  const styles = makeStyles(colors);

  const cameraRef = useRef(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);

  // ✅ Get email safely (from route params OR global callback context you may have)
  const email =
    route?.params?.email ||
    route?.params?.user?.email ||
    route?.params?.userEmail ||
    null;

  useEffect(() => {
    (async () => {
      if (!permission?.granted) await requestPermission();
    })();
  }, [permission?.granted]);

  const takePicture = async () => {
    try {
      if (!cameraRef.current || busy) return;

      if (!email) {
        Alert.alert("Login required", "User email missing. Please login again.");
        return;
      }

      setBusy(true);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: false,
        skipProcessing: false,
      });

      // ✅ Resize for smaller upload (prevents network fail)
      const manipulated = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 1400 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );

      // ✅ Call backend OCR (may be slow)
      const res = await api.scanReceipt({ imageUri: manipulated.uri, email });

      if (!res?.success) {
        Alert.alert("Scan failed", res?.message || "Could not read the receipt. Try again.");
        return;
      }

      // backend returns: { success, type:"image", data:{ name, amount, category, date } }
      const data = res?.type === "image" ? res?.data : null;

      const scanned = {
        name: data?.name || "Expense",
        amount: data?.amount ?? "",
        category: data?.category || "other",
        date: data?.date || null,
      };

      // ✅ Auto-save to DB (so it is stored)
      // If amount is missing, don't save automatically.
      if (scanned.amount !== "" && scanned.amount !== null && scanned.amount !== undefined) {
        try {
          await api.saveReceiptExpense({
            email,
            name: scanned.name,
            amount: Number(scanned.amount) || 0,
            category: scanned.category,
            date: scanned.date,
            description: "Scanned receipt",
          });
        } catch (saveErr) {
          console.log("Save scanned expense failed:", saveErr?.message || saveErr);
          // Not fatal: still send values back to Add Expense screen
        }
      }

      // ✅ Send values back to AddExpense screen (your existing flow)
      if (typeof navCallbacks.onReceiptScanned === "function") {
        navCallbacks.onReceiptScanned(scanned);
      }

      Alert.alert("Scanned", "Receipt values loaded. Review and tap Add Expense.");
      navigation.goBack();
    } catch (e) {
      console.log("Scan error:", e);

      // Better error message
      const msg =
        e?.message?.includes("Network request failed")
          ? "Network request failed. Check internet + backend URL + try again."
          : e?.message || "Failed to capture receipt";

      Alert.alert("Error", msg);
    } finally {
      setBusy(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Camera permission required</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <CameraView style={styles.camera} ref={cameraRef} facing="back" />

      <View style={styles.footer}>
        <TouchableOpacity style={styles.capture} onPress={takePicture} activeOpacity={0.9}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.captureText}>Scan</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancel} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    wrap: { flex: 1, backgroundColor: "#000" },
    camera: { flex: 1 },
    footer: {
      padding: 16,
      gap: 10,
      backgroundColor: "rgba(0,0,0,0.6)",
    },
    capture: {
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
      backgroundColor: colors.primary,
    },
    captureText: { color: "#fff", fontWeight: "900", fontSize: 16 },
    cancel: { paddingVertical: 10, alignItems: "center" },
    cancelText: { color: "#fff", opacity: 0.9, fontWeight: "700" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
    text: { color: "#fff", marginBottom: 12, fontWeight: "700" },
    btn: { backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
    btnText: { color: "#fff", fontWeight: "900" },
  });
