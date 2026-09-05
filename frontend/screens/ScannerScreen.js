// ScannerScreen.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Animated,
  Dimensions,
  FlatList,
  Platform,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import Svg, { Rect } from "react-native-svg";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

export default function ScannerScreen({
  theme = "dark", // "dark" | "light"
  onFinish,       // (finalTempChunks) => void
  onClose,        // () => void
}) {
  const isDark = theme === "dark";

  const styles = useMemo(() => makeStyles(isDark), [isDark]);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  // temp saved chunks
  const [tempChunks, setTempChunks] = useState([]);
  const [liveText, setLiveText] = useState(""); // preview of current scan result
  const [areaIndex, setAreaIndex] = useState(1); // increments with Scan+

  // ROI config
  const ROI_W = Math.min(SCREEN_W * 0.80, 360);
  const ROI_H = Math.min(SCREEN_H * 0.22, 170);

  // Animated scan window (moves vertically across a safe range)
  const yAnim = useRef(new Animated.Value(0)).current;

  const ROI_MIN_Y = Math.max(80, SCREEN_H * 0.16);
  const ROI_MAX_Y = Math.min(SCREEN_H * 0.52, SCREEN_H - 260); // keeps it visible above controls

  useEffect(() => {
    if (!permission?.granted) return;

    // start continuous loop animation
    yAnim.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(yAnim, {
          toValue: 1,
          duration: 2800,
          useNativeDriver: true,
        }),
        Animated.timing(yAnim, {
          toValue: 0,
          duration: 2800,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [permission?.granted, yAnim]);

  const roiTranslateY = yAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [ROI_MIN_Y, ROI_MAX_Y],
  });

  const roiLeft = (SCREEN_W - ROI_W) / 2;

  // === UI actions ===

  const handleScan = async () => {
    // UI flow: user presses scan -> we show preview result (later OCR)
    // For now, just simulate
    const text = await runOcrOnCurrentROI(); // placeholder
    setLiveText(text);
  };

  const handleSave = () => {
    if (!liveText.trim()) return;

    const chunk = {
      id: `${Date.now()}_${areaIndex}`,
      areaId: `area_${areaIndex}`,
      rawText: liveText.trim(),
      ts: Date.now(),
    };

    setTempChunks((prev) => [chunk, ...prev]);
    setLiveText(""); // clear current preview after save
  };

  const handleScanPlus = () => {
    // Continue scanning next section/page
    setAreaIndex((x) => x + 1);
    setLiveText("");
  };

  const handleFinish = () => {
    // Do NOT merge/format here (per your requirement)
    // Just pass tempChunks back to caller/backend
    if (onFinish) onFinish(tempChunks);
  };

  const handleDeleteChunk = (id) => {
    setTempChunks((prev) => prev.filter((c) => c.id !== id));
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Scanner</Text>
        <Text style={styles.muted}>Loading camera permission…</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Scanner</Text>
        <Text style={styles.muted}>
          Camera permission is required to scan documents.
        </Text>

        <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryBtnText}>Allow Camera</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.ghostBtn} onPress={onClose}>
          <Text style={styles.ghostText}>Close</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Text style={styles.title}>Scanner</Text>

        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Camera + Overlay */}
      <View style={styles.cameraWrap}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          animateShutter={false}
        />

        {/* Dark mask + ROI hole */}
        <View style={StyleSheet.absoluteFill}>
          <Svg width={SCREEN_W} height={SCREEN_H}>
            {/* Overlay tint */}
            <Rect
              x="0"
              y="0"
              width={SCREEN_W}
              height={SCREEN_H}
              fill={isDark ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.35)"}
            />
          </Svg>

          {/* Animated ROI (we draw border + leave the rest tinted) */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.roiBox,
              {
                width: ROI_W,
                height: ROI_H,
                left: roiLeft,
                transform: [{ translateY: roiTranslateY }],
              },
            ]}
          >
            <View style={styles.roiHeader}>
              <Text style={styles.roiLabel}>Scan Area {areaIndex}</Text>
              <Text style={styles.roiHint}>Align text inside the box</Text>
            </View>

            {/* scan line */}
            <View style={styles.scanLine} />
          </Animated.View>
        </View>
      </View>

      {/* Bottom Panel */}
      <View style={styles.bottomPanel}>
        {/* Live preview */}
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Current Scan</Text>
          <Text style={styles.previewText} numberOfLines={3}>
            {liveText ? liveText : "Tap Scan to capture & read this area…"}
          </Text>

          <View style={styles.previewActions}>
            <TouchableOpacity
              style={[styles.secondaryBtn, !liveText.trim() && styles.btnDisabled]}
              onPress={handleSave}
              disabled={!liveText.trim()}
            >
              <Text style={styles.secondaryBtnText}>Save</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={handleScanPlus}>
              <Text style={styles.secondaryBtnText}>Scan +</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryBtn, tempChunks.length === 0 && styles.btnDisabled]}
              onPress={handleFinish}
              disabled={tempChunks.length === 0}
            >
              <Text style={styles.primaryBtnText}>Finish</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Primary scan button */}
        <TouchableOpacity style={styles.bigScanBtn} onPress={handleScan}>
          <Text style={styles.bigScanBtnText}>Scan</Text>
        </TouchableOpacity>

        {/* Temp list */}
        <View style={styles.savedWrap}>
          <Text style={styles.savedTitle}>
            Saved Areas ({tempChunks.length})
          </Text>

          <FlatList
            data={tempChunks}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 12 }}
            renderItem={({ item }) => (
              <View style={styles.chunkCard}>
                <View style={styles.chunkTopRow}>
                  <Text style={styles.chunkTag}>{item.areaId}</Text>
                  <TouchableOpacity onPress={() => handleDeleteChunk(item.id)}>
                    <Text style={styles.chunkDelete}>Delete</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.chunkText} numberOfLines={4}>
                  {item.rawText}
                </Text>
              </View>
            )}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

/**
 * Placeholder OCR function:
 * - Later you’ll replace this with: takePhoto -> crop ROI -> ML Kit OCR -> setLiveText(result)
 */
async function runOcrOnCurrentROI() {
  // Simulate OCR delay
  await new Promise((r) => setTimeout(r, 400));
  return "Sample OCR result: 03/02/2026  Amazon  ₹1,499.00  Debit";
}

function makeStyles(isDark) {
  const bg = isDark ? "#0B0F14" : "#F6F7FB";
  const card = isDark ? "#111827" : "#FFFFFF";
  const text = isDark ? "#E5E7EB" : "#111827";
  const muted = isDark ? "#9CA3AF" : "#6B7280";
  const border = isDark ? "rgba(255,255,255,0.10)" : "rgba(17,24,39,0.12)";

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: bg,
    },

    topBar: {
      paddingHorizontal: 16,
      paddingTop: Platform.OS === "android" ? 10 : 6,
      paddingBottom: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: text,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: card,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: border,
    },
    closeText: { color: text, fontSize: 16, fontWeight: "700" },

    cameraWrap: {
      flex: 1,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: border,
      overflow: "hidden",
    },
    camera: { flex: 1 },

    roiBox: {
      position: "absolute",
      borderRadius: 18,
      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.85)",
      backgroundColor: "rgba(255,255,255,0.04)",
      overflow: "hidden",
    },
    roiHeader: {
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 8,
      backgroundColor: "rgba(0,0,0,0.18)",
    },
    roiLabel: {
      color: "white",
      fontWeight: "800",
      fontSize: 14,
    },
    roiHint: {
      marginTop: 2,
      color: "rgba(255,255,255,0.8)",
      fontSize: 12,
    },
    scanLine: {
      height: 2,
      marginTop: 10,
      marginHorizontal: 12,
      borderRadius: 2,
      backgroundColor: "rgba(0, 255, 170, 0.95)",
    },

    bottomPanel: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 14,
      backgroundColor: bg,
    },

    previewCard: {
      backgroundColor: card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: border,
      padding: 12,
    },
    previewTitle: {
      color: text,
      fontSize: 13,
      fontWeight: "800",
      marginBottom: 6,
    },
    previewText: {
      color: muted,
      fontSize: 13,
      lineHeight: 18,
      minHeight: 54,
    },
    previewActions: {
      marginTop: 10,
      flexDirection: "row",
      gap: 10,
    },

    bigScanBtn: {
      marginTop: 12,
      height: 54,
      borderRadius: 18,
      backgroundColor: isDark ? "#2563EB" : "#1D4ED8",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.10)",
    },
    bigScanBtnText: {
      color: "white",
      fontWeight: "900",
      fontSize: 16,
      letterSpacing: 0.3,
    },

    primaryBtn: {
      flex: 1,
      height: 42,
      borderRadius: 14,
      backgroundColor: isDark ? "#10B981" : "#059669",
      alignItems: "center",
      justifyContent: "center",
    },
    primaryBtnText: {
      color: "white",
      fontWeight: "800",
      fontSize: 14,
    },
    secondaryBtn: {
      flex: 1,
      height: 42,
      borderRadius: 14,
      backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(17,24,39,0.08)",
      borderWidth: 1,
      borderColor: border,
      alignItems: "center",
      justifyContent: "center",
    },
    secondaryBtnText: {
      color: text,
      fontWeight: "800",
      fontSize: 14,
    },
    btnDisabled: {
      opacity: 0.45,
    },

    ghostBtn: {
      marginTop: 12,
      height: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: border,
      alignItems: "center",
      justifyContent: "center",
    },
    ghostText: { color: text, fontWeight: "800" },

    savedWrap: { marginTop: 12 },
    savedTitle: {
      color: text,
      fontWeight: "800",
      fontSize: 13,
      marginBottom: 8,
    },
    chunkCard: {
      width: 220,
      backgroundColor: card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: border,
      padding: 12,
      marginRight: 10,
    },
    chunkTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    chunkTag: {
      color: text,
      fontWeight: "900",
      fontSize: 12,
    },
    chunkDelete: {
      color: isDark ? "#FCA5A5" : "#DC2626",
      fontWeight: "800",
      fontSize: 12,
    },
    chunkText: { color: muted, fontSize: 12, lineHeight: 16 },

    muted: { color: muted, marginTop: 10 },
  });
}
