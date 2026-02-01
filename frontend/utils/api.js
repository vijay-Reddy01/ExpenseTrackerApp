import { Platform } from "react-native";

export const BASE_URL = "https://expensetrackerapp-t253.onrender.com/api";
console.log("BASE_URL =", BASE_URL);

const handleResponse = async (res) => {
  const text = await res.text();
  let json;

  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Server unreachable");
  }

  if (!res.ok) throw new Error(json.message || "Request failed");
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


scanReceipt: async ({ imageUri, email }) => {
  const form = new FormData();
  if (email) form.append("email", email);

  // ✅ Backend expects this exact field name:
  const FIELD = "receipt";

  if (Platform.OS === "web") {
    // Web: URI -> Blob
    const resp = await fetch(imageUri);
    const blob = await resp.blob();
    form.append(FIELD, blob, `receipt_${Date.now()}.jpg`);
  } else {
    // ✅ Mobile: must pass uri/name/type object
    const filename = imageUri.split("/").pop() || `receipt_${Date.now()}.jpg`;
    const ext = filename.split(".").pop()?.toLowerCase();

    const mime =
      ext === "pdf" ? "application/pdf" :
      ext === "png" ? "image/png" :
      "image/jpeg";

    form.append(FIELD, {
      uri: imageUri,
      name: filename,
      type: mime,
    });
  }

  const res = await fetch(`${BASE_URL}/receipt/scan`, {
    method: "POST",
    body: form,
    // ✅ IMPORTANT: do NOT set Content-Type manually for FormData
  });

  return handleResponse(res);
},

sendInsightsEmail: ({ email, period = "monthly" }) =>
  fetch(`${BASE_URL}/insights/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, period }),
  }).then(handleResponse),


};
