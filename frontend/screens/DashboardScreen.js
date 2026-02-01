import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PieChart } from "react-native-chart-kit";
import { useThemeApp } from "../theme/ThemeContext";

// Helper to get start of week (Mon)
const getStartOfWeek = (date) => {
  const dt = new Date(date);
  const day = dt.getDay();
  const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(dt.setDate(diff));
};

const CATEGORY_COLORS = {
  food: "#22C55E",
  shopping: "#A855F7",
  clothing: "#F97316",
  groceries: "#06B6D4",
  travel: "#3B82F6",
  medical: "#EF4444",
  other: "#64748B",
};

export default function DashboardScreen({ user, navigation }) {
  const theme = useThemeApp();
  const colors = theme?.colors || {
    background: "#0B1220",
    card: "#111A2E",
    text: "#E5E7EB",
    muted: "#94A3B8",
    border: "#243049",
    primary: "#60A5FA",
    danger: "#F87171",
  };

  const styles = makeStyles(colors);

  const [chartView, setChartView] = useState("monthly");
  const { width } = useWindowDimensions();

  const income = Number(user?.income || 0);
  const transactions = Array.isArray(user?.transactions) ? user.transactions : [];

  const { pieData, recentTransactions, totalExpenses, topCategory } = useMemo(() => {
    const now = new Date();

    const filtered = transactions
      .filter((t) => {
        const d = new Date(t?.date);
        if (Number.isNaN(d.getTime())) return false;

        if (chartView === "weekly") return d >= getStartOfWeek(now);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .sort((a, b) => new Date(b?.date) - new Date(a?.date));

    const grouped = filtered.reduce((acc, t) => {
      const c = String(t?.category || "other").toLowerCase();
      acc[c] = (acc[c] || 0) + Number(t?.amount || 0);
      return acc;
    }, {});

    const pie = Object.keys(grouped).map((k) => ({
      name: k,
      population: grouped[k],
      color: CATEGORY_COLORS[k] || CATEGORY_COLORS.other,
      legendFontColor: colors.muted,
      legendFontSize: 12,
    }));

    const total = pie.reduce((s, i) => s + i.population, 0);

    let top = null;
    if (pie.length) {
      const s = [...pie].sort((a, b) => b.population - a.population);
      top = { category: s[0].name, spend: s[0].population };
    }

    return {
      pieData: pie,
      recentTransactions: filtered.slice(0, 5),
      totalExpenses: total,
      topCategory: top,
    };
  }, [transactions, chartView, colors.muted]);

  const balance = income - totalExpenses;
  const spendPct = income > 0 ? (totalExpenses / income) * 100 : 0;

  let headline = "Set your income in Profile to get better insights.";
  if (income > 0 && spendPct > 90) headline = "⚠️ You’ve used above 90% of your salary.";
  else if (income > 0 && spendPct > 70) headline = "⚠️ Spending is high. Try reducing non-essentials.";
  else if (income > 0 && totalExpenses > 0) headline = "✅ Tracking is good. Keep it consistent.";
  else if (income > 0 && totalExpenses === 0) headline = "✅ Great start! No expenses yet.";

  const chartWidth = Math.min(width - 48, 460);
  const chartHeight = Math.min(280, Math.max(230, width * 0.55));

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            Welcome, {user?.username || "User"}
          </Text>
          <Text style={styles.sub}>{headline}</Text>
        </View>

        {/* KPI Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Balance</Text>
          <Text style={styles.balance}>₹{balance.toFixed(2)}</Text>

          <View style={styles.kpiRow}>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Income</Text>
              <Text style={styles.kpiValue}>₹{income.toFixed(2)}</Text>
            </View>

            <View style={styles.kpiBox}>
              <Text style={[styles.kpiLabel, { color: colors.danger || "#EF4444" }]}>
                Spent ({chartView})
              </Text>
              <Text style={[styles.kpiValue, { color: colors.danger || "#EF4444" }]}>
                ₹{totalExpenses.toFixed(2)}
              </Text>
            </View>
          </View>

          {!!topCategory && (
            <View style={styles.tipBox}>
              <Text style={styles.tipTitle}>Top category</Text>
              <Text style={styles.tipText}>
                {topCategory.category.toUpperCase()} • ₹{topCategory.spend.toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        {/* Chart Card */}
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            {["weekly", "monthly"].map((v) => {
              const active = chartView === v;
              return (
                <TouchableOpacity
                  key={v}
                  onPress={() => setChartView(v)}
                  style={[styles.toggle, active && styles.toggleActive]}
                  activeOpacity={0.9}
                >
                  <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
                    {v.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {pieData.length ? (
            <View style={styles.chartWrap}>
              <PieChart
                data={pieData}
                width={chartWidth}
                height={chartHeight}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="10"
                chartConfig={{
                  // ✅ make chart labels readable on both light/dark
                  color: (opacity = 1) =>
                    `rgba(0,0,0,${opacity})`,
                }}
                absolute
              />
            </View>
          ) : (
            <Text style={styles.empty}>No expenses logged for this period.</Text>
          )}
        </View>

        {/* Recent Transactions */}
        <View style={styles.card}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={styles.cardTitle}>Recent</Text>

            <TouchableOpacity
              onPress={() => navigation.navigate("Expenses", { email: user?.email })}
              activeOpacity={0.8}
            >
              <Text style={{ color: colors.primary, fontWeight: "900" }}>Show all</Text>
            </TouchableOpacity>
          </View>

          {recentTransactions.length ? (
            recentTransactions.map((t, i) => (
              <View key={t?._id || i} style={styles.tx}>
                <Text style={styles.txName} numberOfLines={1}>
                  {t?.name || "Expense"}
                </Text>
                <Text style={styles.txAmt}>₹{Number(t?.amount || 0).toFixed(2)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>No recent transactions.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 110, gap: 14 },

    header: { marginBottom: 2 },
    title: { fontSize: 22, fontWeight: "900", color: colors.text },
    sub: { marginTop: 6, color: colors.muted, lineHeight: 18 },

    card: {
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
    },

    cardTitle: { color: colors.text, fontWeight: "900", fontSize: 16, marginBottom: 10 },
    balance: { fontSize: 32, fontWeight: "900", color: colors.primary, marginBottom: 10 },

    kpiRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
    kpiBox: {
      flexGrow: 1,
      flexBasis: "48%",
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    kpiLabel: { color: colors.muted, fontWeight: "800", fontSize: 12, marginBottom: 4 },
    kpiValue: { color: colors.text, fontWeight: "900", fontSize: 16 },

    tipBox: {
      marginTop: 12,
      padding: 12,
      borderRadius: 14,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tipTitle: { color: colors.muted, fontWeight: "900", fontSize: 12, marginBottom: 4 },
    tipText: { color: colors.text, fontWeight: "900" },

    toggleRow: {
      flexDirection: "row",
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 4,
      marginBottom: 12,
      gap: 6,
    },
    toggle: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 12,
      alignItems: "center",
    },
    toggleActive: { backgroundColor: colors.primary },
    toggleText: { color: colors.text, fontWeight: "900", fontSize: 13 },
    toggleTextActive: { color: "#fff" },

    chartWrap: { alignItems: "center", justifyContent: "center" },

    empty: { textAlign: "center", color: colors.muted, paddingVertical: 8 },

    tx: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
    },
    txName: { flex: 1, color: colors.text, fontWeight: "700" },
    txAmt: { color: colors.text, fontWeight: "900" },
  });
