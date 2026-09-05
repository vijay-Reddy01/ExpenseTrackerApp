// frontend/utils/api.js
import { Platform } from "react-native";

// Override this with EXPO_PUBLIC_API_BASE_URL in frontend/.env when using a
// physical device (for example: http://192.168.1.20:4000/api).
// Android emulators reach the host machine through 10.0.2.2, not localhost.
const defaultBaseUrl =
  Platform.OS === "android"
    ? "http://10.0.2.2:4000/api"
    : "http://localhost:4000/api";

export const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || defaultBaseUrl;

const handleResponse = async (res) => {
  const text = await res.text();

  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore non-json responses
  }

  if (!res.ok) {
    const msg =
      (json && (json.message || json.error)) ||
      `Request failed: ${res.status} ${res.statusText}`;
    throw new Error(msg);
  }

  return json ?? { success: true };
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
    fetch(`${BASE_URL}/user/data?email=${encodeURIComponent(email)}`).then(handleResponse),

  addExpense: (data) =>
    fetch(`${BASE_URL}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(handleResponse),

  deleteExpense: (id, email) =>
    fetch(`${BASE_URL}/expenses/${id}?email=${encodeURIComponent(email)}`, {
      method: "DELETE",
    }).then(handleResponse),

  updateProfile: (data) =>
    fetch(`${BASE_URL}/user/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(handleResponse),

  sendInsightsEmail: ({ email, period = "monthly" }) =>
    fetch(`${BASE_URL}/insights/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, period }),
    }).then(handleResponse),

  saveReceiptExpense: (data) =>
    fetch(`${BASE_URL}/receipt/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(handleResponse),

  // ✅ OCR scan upload (image/pdf)
  scanReceipt: async ({ imageUri, email }) => {
    const form = new FormData();
    if (email) form.append("email", email);

    const FIELD = "receipt"; // backend accepts receipt or file

    // Helper to guess mime from uri/file name
    const guessMime = (uriOrName) => {
      const s = String(uriOrName || "").toLowerCase();
      if (s.endsWith(".pdf")) return "application/pdf";
      if (s.endsWith(".png")) return "image/png";
      if (s.endsWith(".jpg") || s.endsWith(".jpeg")) return "image/jpeg";
      return "application/octet-stream";
    };

    if (Platform.OS === "web") {
      // On web: fetch the blob from the object url
      const resp = await fetch(imageUri);
      const blob = await resp.blob();

      // Use blob.type if available
      const mime = blob.type || guessMime(imageUri);
      const ext = mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : "jpg";
      const filename = `upload_${Date.now()}.${ext}`;

      form.append(FIELD, blob, filename);
    } else {
      const filename = imageUri.split("/").pop() || `upload_${Date.now()}.jpg`;
      const mime = guessMime(filename);

      form.append(FIELD, {
        uri: imageUri,
        name: filename,
        type: mime,
      });
    }

    const res = await fetch(`${BASE_URL}/receipt/scan`, {
      method: "POST",
      body: form,
    });

    return handleResponse(res);
  },
};
