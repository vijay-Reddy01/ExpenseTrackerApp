import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../utils/api";
import { useThemeApp } from "../theme/ThemeContext";

export default function InsightsScreen({ user }) {
  const { colors, isDark } = useThemeApp();
  const styles = makeStyles(colors, isDark);

  const [loading, setLoading] = useState(false);

  const {
    incomeUsed,
    monthlyExpenses,
    savingsThisMonth,
    spendingRatio,
    statusLabel,
    spendingFeedback,
    lowTier,
    medTier,
    highTier,
    statusTone,
  } = useMemo(() => {
    const tx = Array.isArray(user?.transactions) ? user.transactions : [];
    const income = Number(user?.income || 0);

    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    const thisMonth = tx.filter((t) => {
      const d = new Date(t?.date);
      return !Number.isNaN(d.getTime()) && d.getMonth() === month && d.getFullYear() === year;
    });

    const monthlyTotal = thisMonth.reduce((sum, t) => sum + Number(t?.amount || 0), 0);

    const ratio = income > 0 ? (monthlyTotal / income) * 100 : 0;
    const savings = income > 0 ? income - monthlyTotal : 0;

    let status = "No Income Set";
    let feedback = "Set your income in Profile to get personalized insights.";
    let tone = "neutral"; // neutral | good | warn | danger

    if (income > 0) {
      if (thisMonth.length === 0) {
        status = "Great Start";
        feedback = "✅ No expenses logged this month. Add expenses to see insights.";
        tone = "good";
      } else if (ratio >= 100) {
        status = "Overspent";
        feedback =
          "🚨 You spent more than your monthly income. Reduce high-cost items and set category limits.";
        tone = "danger";
      } else if (ratio > 90) {
        status = "Critical";
        feedback = "⚠️ You’re using more than 90% of your income. Reduce non-essential spending.";
        tone = "danger";
      } else if (ratio > 70) {
        status = "High";
        feedback = "⚠️ Spending is high (above 70%). Try reducing shopping/travel this week.";
        tone = "warn";
      } else if (ratio > 50) {
        status = "Moderate";
        feedback = "✅ Spending is moderate. Try saving at least 30% by controlling medium/high items.";
        tone = "neutral";
      } else {
        status = "Excellent";
        feedback = "✅ Great control! You’re spending below 50% of income. Keep a savings goal.";
        tone = "good";
      }
    }

    const low = thisMonth.filter((t) => Number(t?.amount || 0) <= 500);
    const med = thisMonth.filter((t) => {
      const a = Number(t?.amount || 0);
      return a > 500 && a <= 2000;
    });
    const high = thisMonth.filter((t) => Number(t?.amount || 0) > 2000);

    return {
      incomeUsed: income,
      monthlyExpenses: monthlyTotal,
      savingsThisMonth: savings,
      spendingRatio: ratio,
      statusLabel: status,
      spendingFeedback: feedback,
      lowTier: low,
      medTier: med,
      highTier: high,
      statusTone: tone,
    };
  }, [user?.income, user?.transactions]);

  const handleGetInsights = async () => {
    if (!user?.email) return Alert.alert("Login required", "Please login again.");

    try {
      setLoading(true);
      const res = await api.sendInsightsEmail({ email: user.email, period: "monthly" });
      Alert.alert("Success", res?.message || "Email sent");
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Email error";
      Alert.alert("Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const statusColor =
    statusTone === "danger"
      ? "#EF4444"
      : statusTone === "warn"
      ? "#F59E0B"
      : statusTone === "good"
      ? "#22C55E"
      : colors.primary;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Insights & Analysis</Text>
          <Text style={styles.headerSub}>
            Monthly insights based on your income and current month expenses.
          </Text>
        </View>

        {/* Summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Income vs Expenses</Text>

          <View style={styles.kpiRow}>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Income</Text>
              <Text style={styles.kpiValue}>₹{Number(incomeUsed || 0).toFixed(2)}</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Spent</Text>
              <Text style={styles.kpiValue}>₹{monthlyExpenses.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.kpiRow}>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Usage</Text>
              <Text style={styles.kpiValue}>{spendingRatio.toFixed(1)}%</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Savings Left</Text>
              <Text style={styles.kpiValue}>₹{Math.max(0, savingsThisMonth).toFixed(2)}</Text>
            </View>
          </View>

          <View style={[styles.statusPill, { borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>Status: {statusLabel}</Text>
          </View>

          <View style={styles.feedbackBox}>
            <Text style={styles.feedbackText}>{spendingFeedback}</Text>
          </View>
        </View>

        {/* Breakdown */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Breakdown</Text>

          <View style={styles.breakRow}>
            <View style={styles.breakBox}>
              <Text style={styles.breakLabel}>Low (≤₹500)</Text>
              <Text style={styles.breakValue}>{lowTier.length}</Text>
            </View>
            <View style={styles.breakBox}>
              <Text style={styles.breakLabel}>Medium (₹501-₹2000)</Text>
              <Text style={styles.breakValue}>{medTier.length}</Text>
            </View>
            <View style={styles.breakBox}>
              <Text style={styles.breakLabel}>High (&gt;₹2000)</Text>
              <Text style={styles.breakValue}>{highTier.length}</Text>
            </View>
          </View>

          <Text style={styles.hint}>
            Tip: If “High” is increasing, set weekly caps for those categories and track daily limits.
          </Text>
        </View>

        {/* Email */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Email Summary</Text>
          <Text style={styles.mutedText}>Send your monthly insights summary to your email.</Text>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleGetInsights}
            disabled={loading}
            activeOpacity={0.9}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send Email</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors, isDark) {
  const surface = colors.surface || colors.background; // ✅ fallback if surface missing

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 110, gap: 14 },

    header: { marginBottom: 4 },
    headerTitle: { fontSize: 22, fontWeight: "900", color: colors.text },
    headerSub: { marginTop: 6, fontSize: 13, color: colors.muted, lineHeight: 18 },

    card: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOpacity: isDark ? 0.18 : 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3,
    },

    cardTitle: { fontSize: 16, fontWeight: "900", color: colors.text, marginBottom: 10 },

    kpiRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
    kpiBox: {
      flexGrow: 1,
      flexBasis: "48%",
      backgroundColor: surface,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    kpiLabel: { fontSize: 12, color: colors.muted, marginBottom: 4, fontWeight: "900" },
    kpiValue: { fontSize: 16, color: colors.text, fontWeight: "900" },

    statusPill: {
      marginTop: 12,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    statusText: { fontWeight: "900" },

    feedbackBox: {
      marginTop: 12,
      borderRadius: 14,
      padding: 12,
      backgroundColor: surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    feedbackText: {
      fontSize: 13,
      color: colors.text,
      textAlign: "center",
      lineHeight: 18,
      fontStyle: "italic",
      fontWeight: "700",
    },

    breakRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
    breakBox: {
      flexGrow: 1,
      flexBasis: "30%",
      backgroundColor: surface,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    breakLabel: { fontSize: 12, color: colors.muted, fontWeight: "900", textAlign: "center" },
    breakValue: { marginTop: 6, fontSize: 18, fontWeight: "900", color: colors.text },

    hint: { marginTop: 10, fontSize: 12.5, color: colors.muted, lineHeight: 18 },

    mutedText: { fontSize: 13, color: colors.muted, marginBottom: 12, lineHeight: 18 },

    btn: { backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 14, alignItems: "center" },
    btnDisabled: { opacity: 0.7 },
    btnText: { color: "#fff", fontWeight: "900" },
  });
}
