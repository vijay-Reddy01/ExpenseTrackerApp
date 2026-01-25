import { Platform } from "react-native";

const PORT = 4000;
const API_PATH = "/api";

let HOST = "localhost";

// Android Emulator
if (Platform.OS === "android") {
  HOST = "10.0.2.2";
}

// Real device override
if (process.env.EXPO_PUBLIC_API_HOST) {
  HOST = process.env.EXPO_PUBLIC_API_HOST;
}

export const BASE_URL = `http://${HOST}:${PORT}${API_PATH}`;

const handleResponse = async (response) => {
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.message || "Request failed");
  }
  return json;
};

export const api = {
  login: (email, password) =>
    fetch(`${BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).then(handleResponse),

  signup: (data) =>
    fetch(`${BASE_URL}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(handleResponse),

  getDashboardData: (email) =>
    fetch(`${BASE_URL}/user/data?email=${encodeURIComponent(email)}`)
      .then(handleResponse),

  addExpense: (data) =>
    fetch(`${BASE_URL}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(handleResponse),

  updateProfile: (data) =>
    fetch(`${BASE_URL}/user/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(handleResponse),

  // ✅ FIXED: THIS IS WHAT YOUR BUTTON NEEDS
  sendInsightsEmail: ({ email, period = "monthly" }) =>
    fetch(`${BASE_URL}/insights/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, period }),
    }).then(handleResponse),
};
