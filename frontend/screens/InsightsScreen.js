
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import colors from "../theme/colors";
import { api } from "../utils/api";

export default function InsightsScreen({ user }) {

  const handleGetInsights = async () => {
  try {
    const res = await api.sendInsightsEmail({
      email: user.email,
      period: "monthly", // you can change to "weekly" later if needed
    });

    Alert.alert("Success", res.message || "Email sent successfully!");
  } catch (error) {
    Alert.alert("Error", error.message || "Failed to send email.");
  }
};


  // Calculate total expenses for the current month
  const now = new Date();
  const monthlyExpenses = user.transactions
    .filter(t => new Date(t.date).getMonth() === now.getMonth())
    .reduce((sum, t) => sum + t.amount, 0);

  const spendingRatio = user.income > 0 ? (monthlyExpenses / user.income) * 100 : 0;

  let spendingFeedback = "Set an income in your profile to get personalized feedback!";
  if (user.income > 0) {
      if (spendingRatio > 90) {
        spendingFeedback = `Warning: You\'ve spent over 90% of your income this month.`;
      } else if (spendingRatio > 60) {
        spendingFeedback = "You are spending a significant portion of your income. Consider reviewing your budget.";
      } else if (user.transactions.length > 0) {
        spendingFeedback = "You\'re managing your expenses well this month! Keep it up.";
      } else {
        spendingFeedback = "No expenses logged this month. You\'re on track!"
      }
  }

  // Categorize all transactions
  const lowTier = user.transactions.filter((t) => t.amount <= 500) || [];
  const medTier = user.transactions.filter((t) => t.amount > 500 && t.amount <= 2000) || [];
  const highTier = user.transactions.filter((t) => t.amount > 2000) || [];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Insights & Analysis</Text>
      </View>

      {user.income > 0 && (
          <View style={styles.card}>
              <Text style={styles.cardTitle}>Spending vs. Income</Text>
              <Text style={styles.feedbackText}>{spendingFeedback}</Text>
          </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Expense Breakdown</Text>
        {user.transactions.length > 0 ? (
            <>
                <Text style={styles.insightCategory}>
                  Low-Cost ({lowTier.length}): {lowTier.map((t) => t.name).join(", ")}
                </Text>
                <Text style={styles.insightCategory}>
                  Medium-Cost ({medTier.length}): {medTier.map((t) => t.name).join(", ")}
                </Text>
                <Text style={styles.insightCategory}>
                  High-Cost ({highTier.length}): {highTier.map((t) => t.name).join(", ")}
                </Text>
            </>
        ) : (
            <Text style={styles.noDataText}>No expenses to analyze. Add some to see your insights!</Text>
        )}
        
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Email Summary</Text>
        <Text style={styles.mutedText}>
          Get a summary of your spending habits sent directly to your email (mock feature).
        </Text>
        <TouchableOpacity style={styles.insightButton} onPress={handleGetInsights}>
          <Text style={styles.insightButtonText}>Send Email Summary</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.text,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 15,
  },
  insightCategory: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 10,
    lineHeight: 24,
  },
  mutedText: {
      fontSize: 14,
      color: colors.muted,
      marginBottom: 20,
  },
  insightButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: "center",
  },
  insightButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  noDataText: {
      textAlign: 'center',
      color: colors.muted,
      paddingVertical: 20,
  },
  feedbackText: {
      fontSize: 16,
      color: colors.primaryDark || colors.primary,
      textAlign: 'center',
      fontStyle: 'italic',
      lineHeight: 22,
  }
});
