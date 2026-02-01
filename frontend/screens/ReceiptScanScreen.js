import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";

import { useThemeApp } from "../theme/ThemeContext";
import { api } from "../utils/api";
import { navCallbacks } from "../utils/navCallbacks";

export default function ReceiptScanScreen({ navigation }) {
  const { colors } = useThemeApp();
  const styles = makeStyles(colors);

  const cameraRef = useRef(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!permission?.granted) await requestPermission();
    })();
  }, [permission?.granted]);

  const takePicture = async () => {
    try {
      if (!cameraRef.current || busy) return;
      setBusy(true);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: false,
        skipProcessing: false,
      });

      // ✅ Resize for better OCR + smaller upload
      const manipulated = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 1400 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );

      // ✅ Call backend OCR
      const res = await api.scanReceipt({ imageUri: manipulated.uri });

      if (!res?.success) {
        Alert.alert("Scan failed", "Could not read the receipt. Try again or enter manually.");
        return;
      }

      // backend returns: { success, type:"image", data:{ name, amount, category, date } }
      const data = res.type === "image" ? res.data : null;

      if (data && typeof navCallbacks.onReceiptScanned === "function") {
        navCallbacks.onReceiptScanned({
          name: data.name || "",
          amount: data.amount ?? "",
          category: data.category || "other",
          date: data.date || null,
        });
      }

      Alert.alert("Scanned", "Receipt values loaded. Review and tap Add Expense.");
      navigation.goBack();
    } catch (e) {
      console.log("Scan error:", e);
      Alert.alert("Error", e?.message || "Failed to capture receipt");
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
