import React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { api } from "../utils/api";
import { useThemeApp } from "../theme/ThemeContext";

export default function ExpensesScreen({ navigation, user, onDataChange }) {
  const { colors } = useThemeApp();
  const styles = makeStyles(colors);

  const expenses = Array.isArray(user?.transactions) ? user.transactions : [];
  const email = user?.email;

  const handleDelete = async (expenseId) => {
    // ✅ keep your delete logic as it is (no changes)
    if (Platform.OS === "web") {
      const ok = window.confirm("Are you sure you want to delete this expense?");
      if (!ok) return;

      try {
        if (!email) return window.alert("Missing user email.");

        const res = await api.deleteExpense(expenseId, email);

        if (res?.success) {
          onDataChange?.();
          window.alert("Deleted!");
        } else {
          window.alert(res?.message || "Delete failed");
        }
      } catch (e) {
        window.alert(e?.message || "Delete failed");
      }
      return;
    }

    Alert.alert("Delete Expense", "Are you sure you want to delete this expense?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            if (!email) return Alert.alert("Error", "Missing user email.");

            const res = await api.deleteExpense(expenseId, email);

            if (res?.success) {
              onDataChange?.();
              Alert.alert("Deleted", "Expense deleted successfully.");
            } else {
              Alert.alert("Error", res?.message || "Delete failed");
            }
          } catch (e) {
            Alert.alert("Delete failed", e?.message || "Unexpected error");
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }) => {
    const amt = Number(item?.amount || 0);

    return (
      <View style={styles.transactionItem}>
        <View style={styles.transactionDetails}>
          <Text style={styles.transactionName} numberOfLines={1}>
            {item?.name || "Expense"}
          </Text>
          <Text style={styles.transactionCategory}>
            {(item?.category || "other").toString()}
          </Text>
        </View>

        <View style={styles.transactionAmountContainer}>
          <Text style={styles.transactionAmount}>₹{amt.toFixed(2)}</Text>

          <TouchableOpacity
            onPress={() => handleDelete(item._id)}
            activeOpacity={0.8}
            style={styles.deleteButton}
          >
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.navigate("MainTabs", { screen: "Dashboard" })}
          activeOpacity={0.8}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>

        <Text style={styles.header}>All Expenses</Text>
        <View style={{ width: 70 }} />
      </View>

      {/* ✅ Scroll fix */}
      <FlatList
        data={expenses}
        renderItem={renderItem}
        keyExtractor={(item, index) => String(item?._id || index)}
        showsVerticalScrollIndicator={true}
        style={{ flex: 1 }} // ✅ ensure FlatList gets height
        contentContainerStyle={{
          paddingBottom: 30,
          flexGrow: 1, // ✅ allows scrolling properly on web
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No expenses found.</Text>
        }
      />
    </View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      height: "100%",
      paddingHorizontal: 20,
      paddingTop: 16,
      backgroundColor: colors.background,
      // ❌ remove overflow hidden (it blocks web scroll)
      // overflow: "hidden",
    },

    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    backBtn: { paddingVertical: 6, paddingHorizontal: 8, borderRadius: 10 },
    backText: { color: colors.primary, fontWeight: "900", fontSize: 16 },

    header: { fontSize: 24, fontWeight: "bold", color: colors.text },

    transactionItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 15,
      backgroundColor: colors.card,
      borderRadius: 10,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    transactionDetails: { flex: 1, paddingRight: 10 },
    transactionName: { fontSize: 16, fontWeight: "600", color: colors.text },
    transactionCategory: {
      fontSize: 12,
      color: colors.muted,
      textTransform: "capitalize",
      marginTop: 4,
    },
    transactionAmountContainer: { alignItems: "flex-end" },
    transactionAmount: { fontSize: 16, fontWeight: "bold", color: colors.primary },
    deleteButton: {
      marginTop: 6,
      backgroundColor: "#F87171",
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
    },
    deleteButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
    emptyText: {
      textAlign: "center",
      color: colors.muted,
      fontWeight: "700",
      marginTop: 30,
    },
  });
