// ExpenseChart.js
import React, { useMemo } from "react";
import { View } from "react-native";
import { VictoryPie, VictoryBar } from "victory-native";
import { useThemeApp } from "../theme/ThemeContext";

export default function ExpenseChart({ type = "pie", data = [] }) {
  const { colors } = useThemeApp();

  const safeData = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const categoryColors = useMemo(
    () => ({
      food: colors.success || colors.primary,
      groceries: colors.warning || colors.primary,
      shopping: colors.danger || colors.primary,
      clothing: colors.primary,
      travel: colors.primary,
      medical: colors.danger || colors.primary,
      other: colors.muted,
    }),
    [colors]
  );

  const labelStyle = useMemo(
    () => ({
      fill: colors.text,
      fontSize: 12,
      fontWeight: "700",
    }),
    [colors.text]
  );

  if (type === "pie") {
    const colorScale = [
      colors.success || colors.primary,
      colors.warning || colors.primary,
      colors.danger || colors.primary,
      colors.primary,
      colors.muted,
    ].filter(Boolean);

    return (
      <View>
        <VictoryPie
          data={safeData}
          x="category"
          y="amount"
          colorScale={colorScale}
          labels={({ datum }) => `${datum.category}: ${datum.amount}`}
          style={{
            labels: labelStyle,
            data: {
              stroke: colors.card, // separator lines look good in both themes
              strokeWidth: 2,
            },
          }}
          padding={{ top: 24, bottom: 24, left: 24, right: 24 }}
        />
      </View>
    );
  }

  return (
    <View>
      <VictoryBar
        data={safeData}
        x="category"
        y="amount"
        style={{
          data: {
            fill: ({ datum }) =>
              categoryColors[String(datum?.category || "other").toLowerCase()] ||
              colors.primary,
          },
          labels: labelStyle,
        }}
        labels={({ datum }) => `${datum.amount}`}
        domainPadding={{ x: 16, y: 10 }}
        padding={{ top: 18, bottom: 42, left: 48, right: 18 }}
      />
    </View>
  );
}
