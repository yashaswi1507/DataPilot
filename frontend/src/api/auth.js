import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { "ngrok-skip-browser-warning": "true" },
});

// Auto-attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("dp_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const login = async (email, password) => {
  const { data } = await api.post("/api/auth/login", { email, password });
  return data;
};

export const register = async (name, email, password, plan = "free", isStudentSelfDeclared = false) => {
  const { data } = await api.post("/api/auth/register", { name, email, password, plan, is_student_selfdeclared: isStudentSelfDeclared });
  return data;
};

export const googleLogin = async (credential, plan = "free", isStudentSelfDeclared = false) => {
  const { data } = await api.post("/api/auth/google", { credential, plan, is_student_selfdeclared: isStudentSelfDeclared });
  return data;
};

export const acceptInvite = async (inviteToken, name, password) => {
  const { data } = await api.post("/api/organizations/accept-invite", { invite_token: inviteToken, name, password });
  return data;
};

export const getMe = async () => {
  const { data } = await api.get("/api/auth/me");
  return data;
};

export const changePassword = async (old_password, new_password) => {
  const { data } = await api.post("/api/auth/change-password", { old_password, new_password });
  return data;
};

export const logout = () => {
  localStorage.removeItem("dp_token");
  localStorage.removeItem("dp_user");
  window.location.href = "/login";
};

export default api;
