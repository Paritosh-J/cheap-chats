import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8080";

const BASE_URL = `${BACKEND_URL}/api`;

const api = axios.create();

api.interceptors.request.use((config) => {
  const sessionId = localStorage.getItem("sessionId");
  if (sessionId) {
    config.headers.set("X-Session-Id", sessionId);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      localStorage.removeItem("username");
      if (window.location.pathname !== "/") {
        window.location.replace("/");
      }
    }
    return Promise.reject(error);
  },
);

export async function fetchData(endpoint: string) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    credentials: "include",
    headers: {
      "X-Session-Id": localStorage.getItem("sessionId") ?? "",
    },
  });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
}

export const loginUser = async (username: string, password: string) =>
  api.post(`${BASE_URL}/login`, { username, password });

export const heartbeatSession = async () =>
  api.post(`${BASE_URL}/session/heartbeat`);

export const logoutUser = async () => api.post(`${BASE_URL}/logout`);

export const createGroup = async (
  groupName: string,
  createdBy: string,
  expiresInMinutes: number,
) =>
  api.post(`${BASE_URL}/group`, null, {
    params: { groupName, createdBy, expiryInMinutes: expiresInMinutes },
  });

export const joinGroup = async (groupName: string, username: string) =>
  api.post(`${BASE_URL}/group/${groupName}/join`, null, {
    params: { username },
  });

export const leaveGroup = async (groupName: string, username: string) =>
  api.post(`${BASE_URL}/group/${groupName}/leave`, null, {
    params: { username },
  });

export const removeMember = async (groupName: string, targetMember: string) =>
  api.delete(`${BASE_URL}/group/${groupName}/remove`, {
    params: { groupName, targetMember },
  });

export const getGroupInfo = async (groupName: string) =>
  api.get(`${BASE_URL}/group/${groupName}`);

export const getGroupMessages = async (groupName: string, username: string) =>
  api.get(`${BASE_URL}/messages/${groupName}`, { params: { username } }).then((response) => {
    let data = response.data;
    if (
      !Array.isArray(data) &&
      data &&
      typeof data === "object" &&
      "Content" in data
    ) {
      try {
        data = JSON.parse(data.Content);
      } catch {
        data = [];
      }
    }
    if (!Array.isArray(data)) data = [];
    return data;
  });

export const getGroupExpiryIn = async (groupName: string) =>
  api.get(`${BASE_URL}/group/${groupName}/expiresIn`);

export const deleteMessage = async (
  messageId: string,
  groupName: string,
  username: string,
) =>
  api.delete(`${BASE_URL}/messages/${messageId}`, {
    params: { groupName, username },
  });

export const getUserGroups = async (username: string) =>
  api.get(`${BASE_URL}/groups`, { params: { username } });

export const deleteGroup = async (groupName: string, username: string) =>
  api.delete(`${BASE_URL}/group/${groupName}`, { params: { username } });

export const checkGroupNameExists = async (groupName: string) =>
  api.get(`${BASE_URL}/group/${groupName}/checkName`);

export const updateGroupSettings = async (
  groupName: string,
  settings: { newGroupName?: string; newExpiryMinutes?: number },
  username: string,
) => {
  return api.put(`${BASE_URL}/group/${groupName}/settings`, settings, {
    params: { username },
  });
};
