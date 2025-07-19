import axios from "axios";
const BASE_URL = "http://localhost:8080/api";

export const loginUser = async (username: string) =>
  axios.post(`${BASE_URL}/login`, null, { params: { username } });

export const createGroup = async (
  groupName: string,
  createdBy: string,
  expiresInMinutes: number
) =>
  axios.post(`${BASE_URL}/group`, null, {
    params: { groupName, createdBy, expiresInMinutes },
  });

export const joinGroup = async (groupName: string, username: string) =>
  axios.post(`${BASE_URL}/group/${groupName}/join`, null, {
    params: { username },
  });

export const leaveGroup = async (groupName: string, username: string) =>
  axios.post(`${BASE_URL}/group/${groupName}/leave`, null, {
    params: { username },
  });

export const removeMember = async (
  groupName: string,
  requester: string,
  target: string
) =>
  axios.delete(`${BASE_URL}/group/${groupName}/remove`, {
    params: { requester, target },
  });

export const getGroupInfo = async (groupName: string) =>
  axios.get(`${BASE_URL}/group/${groupName}`);

export const getGroupMessages = async (groupName: string) =>
  axios.get(`${BASE_URL}/messages/${groupName}`).then((response) => {
    let data = response.data;
    if (
      !Array.isArray(data) &&
      data &&
      typeof data === "object" &&
      "Content" in data
    ) {
      try {
        data = JSON.parse(data.Content);
      } catch (e) {
        data = [];
      }
    }
    if (!Array.isArray(data)) data = [];
    return data;
  });

export const deleteMessage = async (
  messageId: string,
  groupName: string,
  username: string
) =>
  axios.delete(`${BASE_URL}/messages/${messageId}`, {
    params: { groupName, username },
  });
