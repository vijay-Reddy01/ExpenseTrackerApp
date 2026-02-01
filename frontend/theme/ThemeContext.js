import React, { createContext, useContext, useMemo, useState } from "react";
import { DefaultTheme } from "@react-navigation/native";

const lightColors = {
  background: "#FFFFFF",
  card: "#edeaea",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  primary: "#67d161",
  danger: "#EF4444",
};

const darkColors = {
  background: "#1f1f1f",
  card: "#515151",
  text: "#E5E7EB",
  muted: "#cbcbcb",
  border: "#243049",
  primary: "#67d161",
  danger: "#F87171",
};

const ThemeContext = createContext({
  mode: "dark",
  colors: darkColors,
  navTheme: DefaultTheme,
  toggleTheme: () => {},
});

export const useThemeApp = () => useContext(ThemeContext);

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState("dark");

  const colors = mode === "dark" ? darkColors : lightColors;

  const navTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background: colors.background,
        card: colors.card,
        text: colors.text,
        border: colors.border,
        primary: colors.primary,
      },
    }),
    [colors]
  );

  const toggleTheme = () => setMode((m) => (m === "dark" ? "light" : "dark"));

  const value = useMemo(() => ({ mode, colors, navTheme, toggleTheme }), [mode, colors, navTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
