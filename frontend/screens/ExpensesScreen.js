// frontend/screens/ExpensesScreen.js
import React, { useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../utils/api";
import { useThemeApp } from "../theme/ThemeContext";

export default function ExpensesScreen({ navigation, user, onDataChange }) {
  const { colors } = useThemeApp();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const expenses = Array.isArray(user?.transactions) ? user.transactions : [];
  const email = user?.email;

  const handleDelete = async (expenseId) => {
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

    const formattedDate = item?.date
      ? new Date(item.date).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "";

    return (
      <View style={styles.transactionItem}>
        <View style={styles.transactionDetails}>
          <Text style={styles.transactionName} numberOfLines={1}>
            {item?.name || "Expense"}
          </Text>

          <Text style={styles.transactionCategory}>
            {(item?.category || "other").toString()}
          </Text>

          {!!formattedDate && <Text style={styles.transactionDate}>{formattedDate}</Text>}
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

  // ✅ WEB scroll fix: make a real scroll area with fixed height
  const WebScrollList = () => {
    return (
      <View style={styles.webPage}>
        {/* Header */}
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
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

        {/* Scroll container */}
        <View
          style={styles.webScrollArea}
          // 👇 Force wheel scrolling even if RN-web fails to route wheel to container
          onWheel={(e) => {
            try {
              const el = e.currentTarget;
              el.scrollTop += e.deltaY;
            } catch {}
          }}
          // make it focusable so wheel works on some browsers
          // (RN-web will pass unknown props to DOM)
          tabIndex={0}
        >
          <View style={styles.webListContent}>
            {expenses.length ? (
              expenses.map((x, idx) => (
                <View key={String(x?._id || idx)}>{renderItem({ item: x })}</View>
              ))
            ) : (
              <Text style={styles.emptyText}>No expenses found.</Text>
            )}
            {/* Extra bottom space so last card is reachable */}
            <View style={{ height: 120 }} />
          </View>
        </View>
      </View>
    );
  };

  // ✅ MOBILE: FlatList is best
  const MobileList = () => {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
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

        <FlatList
          data={expenses}
          renderItem={renderItem}
          keyExtractor={(item, index) => String(item?._id || index)}
          showsVerticalScrollIndicator
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingBottom: insets.bottom + 140,
          }}
          ListEmptyComponent={<Text style={styles.emptyText}>No expenses found.</Text>}
        />
      </View>
    );
  };

  return Platform.OS === "web" ? <WebScrollList /> : <MobileList />;
}

const makeStyles = (colors) =>
  StyleSheet.create({
    // ✅ MOBILE
    container: {
      flex: 1,
      paddingHorizontal: 20,
      backgroundColor: colors.background,
      minHeight: 0,
    },

    // ✅ WEB: lock page height so inner scroll works
    webPage: {
      height: "100vh",
      backgroundColor: colors.background,
      paddingHorizontal: 20,
      minHeight: 0,
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

    // ✅ WEB scroll area
    webScrollArea: {
      flex: 1,
      minHeight: 0,
      overflowY: "auto",
      // helps on some browsers for smooth wheel
      overscrollBehavior: "contain",
    },

    webListContent: {
      paddingBottom: 20,
    },

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

    transactionDate: {
      fontSize: 11,
      color: colors.muted,
      marginTop: 2,
      fontWeight: "700",
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
