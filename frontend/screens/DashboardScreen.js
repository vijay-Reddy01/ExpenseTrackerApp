import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { PieChart } from "react-native-chart-kit";
import colors from "../theme/colors";

const screenWidth = Dimensions.get("window").width;

// Helper to get start of the week (Mon)
const getStartOfWeek = (date) => {
  const dt = new Date(date);
  const day = dt.getDay();
  const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(dt.setDate(diff));
};

// Stable colors by category (no random flicker)
const CATEGORY_COLORS = {
  food: "#22C55E",
  shopping: "#A855F7",
  clothing: "#F97316",
  groceries: "#06B6D4",
  travel: "#3B82F6",
  medical: "#EF4444",
  other: "#64748B",
};

export default function DashboardScreen({ user }) {
  const [chartView, setChartView] = useState("monthly"); // weekly | monthly

  const { pieData, recentTransactions, totalExpenses, topCategory } = useMemo(() => {
    if (!user || !user.transactions) {
      return { pieData: [], recentTransactions: [], totalExpenses: 0, topCategory: null };
    }

    const now = new Date();

    const filtered = user.transactions.filter((t) => {
      const txDate = new Date(t.date);
      if (chartView === "weekly") {
        const startOfWeek = getStartOfWeek(now);
        return txDate >= startOfWeek;
      }
      return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
    });

    // group by category
    const expenseByCategory = filtered.reduce((acc, curr) => {
      const cat = curr.category || "other";
      acc[cat] = (acc[cat] || 0) + Number(curr.amount || 0);
      return acc;
    }, {});

    const pie = Object.keys(expenseByCategory).map((category) => ({
      name: category,
      population: expenseByCategory[category],
      color: CATEGORY_COLORS[category] || CATEGORY_COLORS.other,
      legendFontColor: "#7F7F7F",
      legendFontSize: 14,
    }));

    const total = pie.reduce((sum, item) => sum + item.population, 0);

    // find top category
    let top = null;
    if (pie.length > 0) {
      const sorted = [...pie].sort((a, b) => b.population - a.population);
      top = { category: sorted[0].name, spend: sorted[0].population };
    }

    return {
      pieData: pie,
      recentTransactions: filtered.slice(0, 5),
      totalExpenses: total,
      topCategory: top,
    };
  }, [user, chartView]);

  const income = Number(user?.income || 0);
  const totalBalance = income - totalExpenses;
  const spendPct = income > 0 ? (totalExpenses / income) * 100 : 0;

  let headline = "Add income in Profile to get smart insights.";
  if (income > 0 && spendPct > 90) headline = "⚠️ You’ve spent above 90% of your salary.";
  else if (income > 0 && spendPct > 70) headline = "⚠️ Spending is high. Try to reduce expenses.";
  else if (income > 0 && totalExpenses > 0) headline = "✅ You’re tracking well. Keep it consistent.";
  else if (income > 0 && totalExpenses === 0) headline = "✅ No expenses yet. Great start!";

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Welcome, {user?.username || "User"}</Text>
        <Text style={styles.headerSubtitle}>{headline}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Total Balance</Text>
        <Text style={styles.balance}>₹{totalBalance.toFixed(2)}</Text>

        <View style={styles.balanceDetails}>
          <Text style={styles.income}>Income: ₹{income.toFixed(2)}</Text>
          <Text style={styles.expense}>
            Expenses ({chartView}): ₹{totalExpenses.toFixed(2)}
          </Text>
        </View>

        {income > 0 && (
          <View style={styles.miniRow}>
            <Text style={styles.miniText}>Spent: {spendPct.toFixed(1)}% of salary</Text>
            <Text style={styles.miniText}>
              Savings target: {Math.max(0, 100 - spendPct).toFixed(1)}%
            </Text>
          </View>
        )}

        {income > 0 && topCategory && (
          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>Top pressure</Text>
            <Text style={styles.tipText}>
              {topCategory.category.toUpperCase()} is highest at ₹{topCategory.spend.toFixed(2)} (
              {((topCategory.spend / income) * 100).toFixed(1)}% of salary). Try setting a weekly cap.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            onPress={() => setChartView("weekly")}
            style={[styles.toggleButton, chartView === "weekly" && styles.toggleActive]}
          >
            <Text style={[styles.toggleText, chartView === "weekly" && styles.toggleActiveText]}>
              Weekly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setChartView("monthly")}
            style={[styles.toggleButton, chartView === "monthly" && styles.toggleActive]}
          >
            <Text style={[styles.toggleText, chartView === "monthly" && styles.toggleActiveText]}>
              Monthly
            </Text>
          </TouchableOpacity>
        </View>

        {pieData.length > 0 ? (
          <PieChart
            data={pieData}
            width={screenWidth - 80}
            height={220}
            chartConfig={{
              color: (opacity = 1) => `rgba(22, 163, 74, ${opacity})`,
            }}
            accessor={"population"}
            backgroundColor={"transparent"}
            paddingLeft={"15"}
            absolute
          />
        ) : (
          <Text style={styles.noDataText}>No expenses logged for this period.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Transactions</Text>
        {recentTransactions.length > 0 ? (
          recentTransactions.map((tx, index) => (
            <View key={tx._id || index} style={styles.transaction}>
              <Text style={styles.transactionName}>{tx.name}</Text>
              <Text style={styles.transactionAmount}>₹{Number(tx.amount).toFixed(2)}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.noDataText}>No recent transactions.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20 },
  header: { marginBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: "bold", color: colors.text },
  headerSubtitle: { marginTop: 6, fontSize: 14, color: colors.muted },

  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: { fontSize: 18, fontWeight: "600", color: colors.text, marginBottom: 15 },

  balance: { fontSize: 36, fontWeight: "bold", color: colors.primary, marginBottom: 10 },
  balanceDetails: { flexDirection: "row", justifyContent: "space-between" },
  income: { fontSize: 16, color: colors.primary },
  expense: { fontSize: 16, color: "#F87171" },

  miniRow: { marginTop: 12, flexDirection: "row", justifyContent: "space-between" },
  miniText: { fontSize: 13, color: colors.muted },

  tipBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tipTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: 6 },
  tipText: { fontSize: 13, color: colors.muted, lineHeight: 18 },

  transaction: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  transactionName: { fontSize: 16, color: colors.text },
  transactionAmount: { fontSize: 16, fontWeight: "600", color: colors.text },

  noDataText: { textAlign: "center", color: colors.muted, marginTop: 20 },

  toggleContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 15,
    backgroundColor: colors.background,
    borderRadius: 8,
  },
  toggleButton: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8 },
  toggleActive: { backgroundColor: colors.primary },
  toggleText: { fontSize: 14, fontWeight: "600", color: colors.primary },
  toggleActiveText: { color: "#FFFFFF" },
});
