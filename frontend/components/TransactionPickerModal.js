// frontend/components/TransactionPickerModal.js
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
  TextInput,
  Alert,
} from "react-native";

export default function TransactionPickerModal({
  visible,
  transactions = [],
  onClose,
  onConfirm,
  theme,
}) {
  const t = theme || {};
  const styles = useMemo(() => makeStyles(t), [t]);

  // { tempId: true }
  const [selected, setSelected] = useState({});

  // local editable copy of txs (by id)
  // { [tempId]: { ...tx, name, date, amount } }
  const [txMap, setTxMap] = useState({});

  // edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState(""); // YYYY-MM-DD
  const [editAmount, setEditAmount] = useState(""); // string for input

  useEffect(() => {
    if (visible) {
      setSelected({});

      // initialize editable map from transactions
      const map = {};
      for (const tx of transactions) {
        const id = tx?.tempId;
        if (!id) continue;
        map[id] = {
          ...tx,
          name: String(tx?.name ?? "Expense"),
          date: String(tx?.date ?? "").slice(0, 10), // normalize YYYY-MM-DD
          amount: Number(tx?.amount ?? 0),
        };
      }
      setTxMap(map);
    }
  }, [visible, transactions?.length]);

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const toggle = (id) => setSelected((prev) => ({ ...prev, [id]: !prev[id] }));

  const selectAll = () => {
    const obj = {};
    for (const tx of transactions) obj[tx.tempId] = true;
    setSelected(obj);
  };

  const clearAll = () => setSelected({});

  const openEdit = (id) => {
    const tx = txMap?.[id];
    if (!tx) return;

    setEditId(id);
    setEditName(String(tx.name ?? ""));
    setEditDate(String(tx.date ?? "").slice(0, 10));
    setEditAmount(String(Number(tx.amount ?? 0) || ""));
    setEditOpen(true);
  };

  const isValidDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
  const isValidAmount = (s) => {
    const n = Number(s);
    return Number.isFinite(n) && n > 0;
  };

  const saveEdit = () => {
    const name = String(editName || "").trim();
    const date = String(editDate || "").trim();
    const amountStr = String(editAmount || "").trim();

    if (!name) {
      Alert.alert("Invalid", "Enter a transaction name.");
      return;
    }
    if (!isValidDate(date)) {
      Alert.alert("Invalid date", "Use format YYYY-MM-DD (example: 2026-02-03).");
      return;
    }
    if (!isValidAmount(amountStr)) {
      Alert.alert("Invalid amount", "Enter a valid amount greater than 0.");
      return;
    }

    const amount = Math.round(Number(amountStr));

    setTxMap((prev) => ({
      ...prev,
      [editId]: {
        ...prev[editId],
        name,
        date,
        amount,
      },
    }));

    setEditOpen(false);
    setEditId(null);
  };

  const handleSave = async () => {
    try {
      // return edited tx objects (from txMap)
      const picked = transactions
        .filter((tx) => selected[tx.tempId])
        .map((tx) => txMap[tx.tempId] || tx);

      if (!picked.length) return;

      await onConfirm?.(picked);
      onClose?.();
    } catch (e) {
      console.log("TransactionPickerModal save error:", e);
    }
  };

  const renderItem = ({ item }) => {
    const id = item.tempId;
    const checked = !!selected[id];

    const tx = txMap?.[id] || item;
    const amount = Number(tx.amount || 0);

    return (
      <View style={styles.rowWrap}>
        {/* Row click toggles checkbox */}
        <TouchableOpacity
          onPress={() => toggle(id)}
          activeOpacity={0.85}
          style={styles.row}
        >
          <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
            {checked ? <Text style={styles.tick}>✓</Text> : null}
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {tx.name}
            </Text>
            <Text style={styles.sub}>{String(tx.date || "").slice(0, 10)}</Text>
          </View>

          <View style={styles.right}>
            <Text style={styles.badge}>DEBIT</Text>
            <Text style={styles.amount}>- ₹ {amount.toFixed(2)}</Text>
          </View>
        </TouchableOpacity>

        {/* Edit button */}
        <TouchableOpacity
          onPress={() => openEdit(id)}
          activeOpacity={0.9}
          style={styles.editBtn}
        >
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <>
      <Modal visible={!!visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.h1}>Select transactions</Text>
            <Text style={styles.h2}>
              Selected: {selectedCount} / {transactions.length}
            </Text>

            <View style={styles.topActions}>
              <TouchableOpacity onPress={selectAll} style={styles.smallBtn}>
                <Text style={styles.smallBtnText}>Select All</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={clearAll} style={styles.smallBtn}>
                <Text style={styles.smallBtnText}>Clear</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <FlatList
              data={transactions}
              keyExtractor={(item) => String(item.tempId)}
              renderItem={renderItem}
              contentContainerStyle={{ paddingBottom: 10 }}
              showsVerticalScrollIndicator
            />

            <View style={styles.bottomRow}>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.9}>
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSave}
                style={[styles.saveBtn, selectedCount === 0 && styles.saveBtnDisabled]}
                activeOpacity={0.9}
                disabled={selectedCount === 0}
              >
                <Text style={styles.saveText}>Save Selected</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ✅ Edit Transaction modal */}
      <Modal visible={editOpen} transparent animationType="fade" onRequestClose={() => setEditOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.editSheet}>
            <Text style={styles.editTitle}>Edit transaction</Text>

            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Transaction name"
              placeholderTextColor={t.subText || "#64748b"}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Date (YYYY-MM-DD)</Text>
            <TextInput
              value={editDate}
              onChangeText={setEditDate}
              placeholder="2026-02-03"
              placeholderTextColor={t.subText || "#64748b"}
              style={styles.input}
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>Amount</Text>
            <TextInput
              value={editAmount}
              onChangeText={setEditAmount}
              placeholder="1200"
              placeholderTextColor={t.subText || "#64748b"}
              style={styles.input}
              keyboardType={Platform.OS === "web" ? "default" : "numeric"}
            />

            <View style={styles.editButtonsRow}>
              <TouchableOpacity
                onPress={() => setEditOpen(false)}
                style={styles.cancelBtn}
                activeOpacity={0.9}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={saveEdit}
                style={styles.updateBtn}
                activeOpacity={0.9}
              >
                <Text style={styles.updateText}>Update</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.editHint}>
              Tip: Your edits will be saved only if you tap “Save Selected” on the main modal.
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const makeStyles = (theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    },
    sheet: {
      width: "100%",
      maxWidth: 900,
      height: Platform.OS === "web" ? "85%" : "80%",
      backgroundColor: theme.background || "#fff",
      borderRadius: 16,
      padding: 16,
      overflow: "hidden",
    },
    h1: { fontSize: 22, fontWeight: "900", color: theme.text || "#111" },
    h2: { marginTop: 4, color: theme.subText || "#475569", fontWeight: "700" },

    topActions: { flexDirection: "row", gap: 10, marginTop: 12 },
    smallBtn: {
      backgroundColor: theme.card || "#f1f5f9",
      borderWidth: 1,
      borderColor: theme.border || "rgba(0,0,0,0.12)",
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
    },
    smallBtnText: { color: theme.text || "#111", fontWeight: "800" },

    divider: {
      height: 1,
      backgroundColor: theme.border || "rgba(0,0,0,0.12)",
      marginVertical: 12,
    },

    rowWrap: {
      flexDirection: "row",
      alignItems: "stretch",
      borderBottomWidth: 1,
      borderBottomColor: theme.border || "rgba(0,0,0,0.08)",
    },

    row: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
      paddingRight: 12,
    },

    editBtn: {
      alignSelf: "center",
      marginLeft: 10,
      backgroundColor: theme.card || "#f1f5f9",
      borderWidth: 1,
      borderColor: theme.border || "rgba(0,0,0,0.12)",
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      height: 36,
      justifyContent: "center",
    },
    editBtnText: { color: theme.text || "#111", fontWeight: "900", fontSize: 12 },

    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: "rgba(0,0,0,0.35)",
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxChecked: {
      borderColor: theme.primary || "#22c55e",
      backgroundColor: theme.primary || "#22c55e",
    },
    tick: { color: "#fff", fontWeight: "900" },

    title: { color: theme.text || "#111", fontWeight: "900", fontSize: 16 },
    sub: { color: theme.subText || "#64748b", fontWeight: "700", marginTop: 2 },

    right: { alignItems: "flex-end" },
    badge: {
      backgroundColor: "#c2410c",
      color: "#fff",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      overflow: "hidden",
      fontWeight: "900",
      fontSize: 12,
    },
    amount: { marginTop: 6, color: theme.text || "#111", fontWeight: "900" },

    bottomRow: { flexDirection: "row", gap: 12, marginTop: 14 },
    closeBtn: {
      flex: 1,
      backgroundColor: theme.card || "#f1f5f9",
      borderWidth: 1,
      borderColor: theme.border || "rgba(0,0,0,0.12)",
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
    },
    closeText: { color: theme.text || "#111", fontWeight: "900" },

    saveBtn: {
      flex: 1,
      backgroundColor: theme.primary || "#22c55e",
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
    },
    saveBtnDisabled: { opacity: 0.5 },
    saveText: { color: "#fff", fontWeight: "900" },

    // ✅ Edit modal styles
    editSheet: {
      width: "100%",
      maxWidth: 520,
      backgroundColor: theme.background || "#fff",
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border || "rgba(0,0,0,0.12)",
    },
    editTitle: { fontSize: 18, fontWeight: "900", color: theme.text || "#111" },
    fieldLabel: { marginTop: 12, marginBottom: 6, fontWeight: "900", color: theme.subText || "#475569" },
    input: {
      borderWidth: 1,
      borderColor: theme.border || "rgba(0,0,0,0.12)",
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      color: theme.text || "#111",
      backgroundColor: theme.card || "#f8fafc",
      fontWeight: "800",
    },
    editButtonsRow: { flexDirection: "row", gap: 12, marginTop: 14 },
    cancelBtn: {
      flex: 1,
      backgroundColor: theme.card || "#f1f5f9",
      borderWidth: 1,
      borderColor: theme.border || "rgba(0,0,0,0.12)",
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
    },
    cancelText: { color: theme.text || "#111", fontWeight: "900" },
    updateBtn: {
      flex: 1,
      backgroundColor: theme.primary || "#22c55e",
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
    },
    updateText: { color: "#fff", fontWeight: "900" },
    editHint: { marginTop: 10, color: theme.subText || "#64748b", fontWeight: "700", fontSize: 12 },
  });
