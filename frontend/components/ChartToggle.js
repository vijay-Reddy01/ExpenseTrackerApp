// ChartToggle.js
import React, { useMemo } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { PieChart } from "react-native-chart-kit";
import { useThemeApp } from "../theme/ThemeContext";

const screenWidth = Dimensions.get("window").width;

export default function ChartToggle({ pieData = [] }) {
  const { colors } = useThemeApp();

  // Ensure legend text is readable in both themes
  const safePieData = useMemo(() => {
    return (Array.isArray(pieData) ? pieData : []).map((d) => ({
      ...d,
      legendFontColor: colors.muted,
      legendFontSize: d.legendFontSize ?? 12,
    }));
  }, [pieData, colors.muted]);

  const chartConfig = useMemo(
    () => ({
      backgroundGradientFrom: colors.card,
      backgroundGradientTo: colors.card,
      decimalPlaces: 0,
      color: (opacity = 1) => {
        // chart-kit uses this for some internals; keep it theme-safe
        return `rgba(255, 255, 255, ${opacity})`;
      },
      labelColor: (opacity = 1) => {
        // for some chart-kit builds
        const isDarkText = colors.text?.toLowerCase?.() === "#111827";
        return isDarkText
          ? `rgba(17, 24, 39, ${opacity})`
          : `rgba(255, 255, 255, ${opacity})`;
      },
      propsForLabels: {
        fill: colors.text,
        fontSize: 12,
        fontWeight: "700",
      },
    }),
    [colors.card, colors.text]
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <PieChart
        data={safePieData}
        width={Math.min(screenWidth - 32, 520)} // responsive
        height={240}
        chartConfig={chartConfig}
        accessor={"population"}
        backgroundColor={"transparent"}
        paddingLeft={"12"}
        absolute
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginTop: 14,
    borderWidth: 1,
  },
});
