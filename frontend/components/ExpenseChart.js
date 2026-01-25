// frontend/components/ExpenseChart.js
import React from "react";
import { VictoryPie, VictoryBar } from "victory-native";
import { View } from "react-native";
import colors from "../theme/colors";

const categoryColors = {
  food: colors.success,
  groceries: colors.warning,
  shopping: colors.danger,
  // Add more mappings if needed
};

export default function ExpenseChart({ type, data }) {
  if (type === "pie") {
    return (
      <VictoryPie
        data={data}
        x="category"
        y="amount"
        colorScale={[colors.success, colors.warning, colors.danger]}
        labels={({ datum }) => `${datum.category}: ${datum.amount}`}
      />
    );
  }

  return (
    <VictoryBar
      data={data}
      x="category"
      y="amount"
      style={{
        data: {
          fill: ({ datum }) => categoryColors[datum.category] || colors.primary,
        },
      }}
    />
  );
}
