// theme/colors.js

export const lightColors = {
  mode: "light",

  background: "#f2f3f4",
  card: "#FFFFFF",
  surface: "#F3F4F6",

  text: "#111827",
  muted: "#888888",

  border: "#fefeff",

  primary: "#16A34A",
  primaryDark: "#15803D",

  danger: "#F87171",
  success: "#22C55E",
  warning: "#F59E0B",
};

export const darkColors = {
  mode: "dark",

  background: "#0B1220",   // app background
  card: "#32353c",         // card panels
  surface: "#111C33",      // inner boxes / inputs

  text: "#F8FAFC",
  muted: "#fdfdfd",

  border: "#ababab",

  primary: "#22C55E",
  primaryDark: "#16A34A",

  danger: "#FB7185",
  success: "#22C55E",
  warning: "#FBBF24",
};

export function getColors(mode) {
  return mode === "dark" ? darkColors : lightColors;
}
