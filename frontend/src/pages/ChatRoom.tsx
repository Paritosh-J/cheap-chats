import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useChat } from "../context/ChatContext";
import SockJS from "sockjs-client";
import { CompatClient, Stomp } from "@stomp/stompjs";
import type { ChatMessage } from "../types";
import { FiArrowDown, FiSend } from "react-icons/fi";
import {
  BsArrowLeft,
  BsBoxArrowRight,
  BsGearFill,
  BsPersonFillGear,
  BsPersonFillSlash,
  BsTrash3Fill,
  BsX,
} from "react-icons/bs";
import {
  getGroupInfo,
  deleteMessage,
  getGroupMessages,
  deleteGroup,
  removeMember,
  updateGroupSettings,
  checkGroupNameExists,
  getGroupExpiryIn,
} from "../services/api";
import ChatMessageComponent from "../components/ChatMessage";

const ChatRoom: React.FC = () => {
  const { showToast } = useChat();
  const navigate = useNavigate(); // for navigation to pages

  const params = useParams<{ id?: string }>();
  const groupName = params.id;

  const [resolvedGroupName, setResolvedGroupName] = useState("Loading...");
  const username = localStorage.getItem("username");
  const [messages, setMessages] = useState<ChatMessage[]>([]); // chat messages
  const [input, setInput] = useState(""); // message input in text box
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null); // reply to message
  const stompClient = useRef<CompatClient | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const messageListRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMemberSettings, setShowMemberSettings] = useState(false);
  const [memberPendingRemoval, setMemberPendingRemoval] = useState<
    string | null
  >(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [membersList, setMembersList] = useState<string[]>([]);
  const membershipChanges = useRef(new Map<string, "JOIN" | "LEAVE">());
  const [isKickedOut, setIsKickedOut] = useState(false);
  const [groupStatusName, setGroupStatusName] = useState<string | null>(null);
  const kickedOutRef = useRef(false);
  const [isNameTaken, setIsNameTaken] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [expiryAt, setExpiryAt] = useState<number | null>(null);
  const [expiryLoadFailed, setExpiryLoadFailed] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [newExpiryTime, setNewExpiryTime] = useState(60);
  const [isGroupExpired, setIsGroupExpired] = useState(false);
  const isReadOnly = isKickedOut || groupStatusName !== groupName;
  const minsLeft =
    expiryAt === null ? null : Math.max(0, (expiryAt - currentTime) / 60_000);

  // fetch persisted messages
  useEffect(() => {
    // if username/groupName is empty
    if (!username || !groupName) {
      // redirect to login page
      navigate("/");
      return;
    }

    kickedOutRef.current = false;

    // fetch group name
    const fetchGroupName = async () => {
      try {
        const response = await getGroupInfo(groupName);
        setResolvedGroupName(response.data.groupName);
        setIsAdmin(response.data.createdBy === username);
        const wasKickedOut = Boolean(response.data.kickedMembers?.[username!]);
        kickedOutRef.current = wasKickedOut;
        setIsKickedOut(wasKickedOut);
        setGroupStatusName(groupName);
      } catch (error) {
        console.error("Failed to fetch group info:", error);
        setResolvedGroupName("Group not found!");
        setGroupStatusName(groupName);
      }
    };

    // fetch persisted messages
    const fetchMessages = async () => {
      try {
        const data: ChatMessage[] = await getGroupMessages(
          groupName,
          username!,
        );
        setMessages((currentMessages) => {
          const fetchedIds = new Set(
            data
              .map((message) => message.id)
              .filter((id): id is number => id !== undefined),
          );
          const fetchedClientIds = new Set(
            data
              .map((message) => message.clientMessageId)
              .filter((id): id is string => id !== undefined),
          );
          const messagesReceivedWhileLoading = currentMessages.filter(
            (message) => {
              if (message.id !== undefined) return !fetchedIds.has(message.id);
              if (message.clientMessageId !== undefined) {
                return !fetchedClientIds.has(message.clientMessageId);
              }
              return Boolean(message.pending);
            },
          );
          return [...data, ...messagesReceivedWhileLoading];
        });
      } catch (error) {
        console.error("Failed to fetch messages:", error);
        setMessages([]);
      }
    };

    fetchGroupName();
    fetchMessages();

    // initialize SockJS and Stomp client
    // const socket = new SockJS("http://localhost:8080/ws");
    const backendUrl =
      import.meta.env.VITE_BACKEND_URL || "http://localhost:8080";
    const socket = new SockJS(`${backendUrl}/ws`);
    stompClient.current = Stomp.over(socket);

    stompClient.current.connect(
      {},
      () => {
        console.log("WebSocket connected successfully");

        stompClient.current?.subscribe(
          `/topic/user/${username}`,
          (payload: { body: string }) => {
            const event: ChatMessage = JSON.parse(payload.body);
            if (event.type !== "MESSAGE_REJECTED" || !event.clientMessageId) {
              return;
            }
            setMessages((previousMessages) =>
              previousMessages.filter(
                (message) => message.clientMessageId !== event.clientMessageId,
              ),
            );
            showToast(event.content || "Message could not be sent", "error");
          },
        );

        // Subscribe to group messages
        stompClient.current?.subscribe(
          `/topic/group/${groupName}`,
          (payload: { body: string }) => {
            const msg: ChatMessage = JSON.parse(payload.body);
            console.log("Received WebSocket message:", msg);

            if (msg.type === "GROUP_UPDATED") {
              if (msg.expiresAtEpochMillis) {
                setExpiryAt(msg.expiresAtEpochMillis);
                setCurrentTime(Date.now());
                setIsGroupExpired(msg.expiresAtEpochMillis <= Date.now());
              }
              const updatedGroupName = msg.groupName;
              if (updatedGroupName && updatedGroupName !== groupName) {
                setResolvedGroupName(updatedGroupName);
                navigate(`/group/${updatedGroupName}`);
              }
              if (msg.sender !== username) {
                showToast(msg.content || "Group settings updated", "success");
              }
              return;
            }

            if (msg.type === "GROUP_EXPIRED") {
              setIsGroupExpired(true);
              setExpiryAt(Date.now());
              showToast("This group has expired", "error");
              stompClient.current?.disconnect();
              return;
            }

            if (msg.type === "GROUP_DELETED") {
              if (msg.sender !== username) {
                showToast("This group was deleted", "error");
              }
              navigate("/group");
              return;
            }

            if (msg.type === "KICKED_OUT") {
              membershipChanges.current.set(msg.sender, "LEAVE");
              setMessages((previousMessages) => {
                if (
                  previousMessages.some(
                    (message) =>
                      message.type === "KICKED_OUT" &&
                      message.sender === msg.sender &&
                      message.timestamp === msg.timestamp,
                  )
                ) {
                  return previousMessages;
                }
                return [...previousMessages, msg];
              });
              setMembersList((previousMembers) =>
                previousMembers.filter((member) => member !== msg.sender),
              );
              if (msg.sender === username) {
                kickedOutRef.current = true;
                setIsKickedOut(true);
                setInput("");
                setReplyTo(null);
                setShowGroupSettings(false);
                setShowMemberSettings(false);
                setShowDeleteConfirm(false);
                showToast(
                  `${username} was removed from this group`,
                  "error",
                  username!,
                );
              } else {
                showToast(msg.content, "error", msg.sender);
              }
              return;
            }

            if (
              kickedOutRef.current &&
              ["CHAT", "DELETE", "JOIN", "LEAVE"].includes(msg.type)
            ) {
              return;
            }

            if (msg.type === "CHAT" && msg.clientMessageId) {
              setMessages((previousMessages) => {
                const optimisticIndex = previousMessages.findIndex(
                  (message) => message.clientMessageId === msg.clientMessageId,
                );
                if (optimisticIndex === -1) {
                  if (
                    msg.id &&
                    previousMessages.some((message) => message.id === msg.id)
                  ) {
                    return previousMessages;
                  }
                  return [...previousMessages, { ...msg, pending: false }];
                }

                return previousMessages.map((message, index) =>
                  index === optimisticIndex
                    ? { ...msg, pending: false }
                    : message,
                );
              });
              return;
            }

            if (msg.type === "JOIN" || msg.type === "LEAVE") {
              membershipChanges.current.set(msg.sender, msg.type);
              setMembersList((previousMembers) => {
                if (msg.type === "JOIN") {
                  return previousMembers.includes(msg.sender)
                    ? previousMembers
                    : [...previousMembers, msg.sender];
                }
                return previousMembers.filter(
                  (member) => member !== msg.sender,
                );
              });
              showToast(
                msg.content,
                msg.type === "JOIN" ? "success" : "error",
                msg.sender,
              );
            }

            if (msg.type === "DELETE") {
              console.log("Processing DELETE message for ID:", msg.id);
              // Remove the deleted message from the UI
              setMessages((prev) => {
                const filtered = prev.filter((m) => m.id !== msg.id);
                console.log(
                  `Removed message ${msg.id}. Messages count: ${prev.length} -> ${filtered.length}`,
                );
                return filtered;
              });
            } else {
              // Add new message to the UI only if not already present
              setMessages((prev) => {
                if (msg.id && prev.some((m) => m.id === msg.id)) {
                  return prev;
                }
                return [...prev, msg];
              });
            }
          },
        );

        sessionStorage.removeItem("justJoinedGroup");
      },
      (error: any) => {
        console.error("WebSocket connection error:", error);
      },
    );

    // Disconnecting from the room does not mean the user left the group.
    return () => {
      if (stompClient.current?.connected) {
        stompClient.current.disconnect();
      }
    };
  }, [groupName, username, navigate, showToast]);

  // Focus input when window regains focus
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // FOCUS ON MESSAGE INPUT
  const focusInput = () => {
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  // FETCH GROUP MEMBERS
  useEffect(() => {
    membershipChanges.current.clear();
    const fetchMembers = async () => {
      try {
        const response = await getGroupInfo(groupName!);
        const members = new Set<string>(response.data.members || []);
        membershipChanges.current.forEach((eventType, member) => {
          if (eventType === "JOIN") members.add(member);
          else members.delete(member);
        });
        setMembersList([...members]);
      } catch (error) {
        console.error("Failed to fetch group members:", error);
        setMembersList([]);
      }
    };

    if (groupName) {
      fetchMembers();
    }
  }, [groupName]);

  // SCROLL TO BOTTOM DISPLAY THRESHOLD
  const handleScroll = useCallback(() => {
    const el = messageListRef.current;
    if (!el) return;
    const threshold = 150; // px from bottom
    const atBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setShowScrollToBottom(!atBottom);
  }, []);

  // SCROLL EVENT LISTENER
  useEffect(() => {
    const el = messageListRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll);
    // Initial check
    handleScroll();
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // SCROLL TO BOTTOM
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    focusInput();
  };

  // Auto-expand textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  };

  // trim and remove leading/trailing whitespace and blank lines
  const cleanMessage = (msg: string) => {
    // Remove leading/trailing whitespace and blank lines
    return msg.replace(/^[\s\n]+|[\s\n]+$/g, "");
  };

  // Send message with cleaning
  const sendMessage = useCallback(() => {
    const cleaned = cleanMessage(input);
    if (!cleaned || !stompClient.current?.connected || isReadOnly) return;
    const msg: ChatMessage = {
      sender: username!,
      content: cleaned,
      type: "CHAT",
      timestamp: new Date().toISOString(),
      clientMessageId: crypto.randomUUID(),
      pending: true,
      replyTo: replyTo
        ? {
            sender: replyTo.sender,
            content: replyTo.content,
            timestamp: replyTo.timestamp,
          }
        : undefined,
    };

    setMessages((previousMessages) => [...previousMessages, msg]);
    try {
      stompClient.current.send(
        `/app/chat/${groupName}/send`,
        {},
        JSON.stringify(msg),
      );
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessages((previousMessages) =>
        previousMessages.filter(
          (message) => message.clientMessageId !== msg.clientMessageId,
        ),
      );
      showToast("Message could not be sent", "error");
      return;
    }

    setInput("");
    setReplyTo(null);
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      focusInput();
    }
  }, [input, stompClient, username, groupName, replyTo, isReadOnly, showToast]);

  // Handle keydown for textarea
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    // Shift+Enter inserts newline (default behavior)
  };

  // DELETE MESSAGE
  const handleDeleteMessage = async (messageId: number) => {
    if (isReadOnly) return;
    try {
      console.log(
        `Attempting to delete message ${messageId} in group ${groupName} by user ${username}`,
      );
      // Call backend API to delete message
      await deleteMessage(messageId.toString(), groupName!, username!);
      console.log(`Delete API call successful for message ${messageId}`);
    } catch (error) {
      console.error("Failed to delete message:", error);
      showToast("Could not delete message", "error");
    }
  };

  // REPLY TO MESSAGE
  const handleReplyToMessage = (message: ChatMessage) => {
    if (isReadOnly) return;
    setReplyTo(message);
    // Focus on input field
    focusInput();
  };

  // CANCEL REPLY TO MESSAGE
  const cancelReply = () => {
    setReplyTo(null);
    focusInput();
  };

  // SCROLL INTO VIEW
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // return FORMATTED TIME LEFT
  const formattedTimeLeft = (minutes: number): string => {
    // console.log("inside formatTimeLeft");

    const hrs = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    const secs = Math.floor((minutes * 60) % 60);

    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    } else {
      return `${mins}m ${secs}s`;
    }
  };

  useEffect(() => {
    if (expiryAt === null) return;
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [expiryAt]);

  // expiry timer
  useEffect(() => {
    if (
      resolvedGroupName === "Loading..." ||
      resolvedGroupName === "Group not found!" ||
      !groupName ||
      !username
    ) {
      return;
    }

    setExpiryAt(null);
    setExpiryLoadFailed(false);
    setIsGroupExpired(false);
    let isActive = true;
    const fetchExpiryTime = async () => {
      try {
        const response = await getGroupExpiryIn(resolvedGroupName);
        if (!isActive) return;

        const createdAt = Number(response.data.createdAtEpochMillis);
        const expiryDuration = Number(response.data.expiryDurationMinutes);
        const deadline = createdAt + expiryDuration * 60_000;
        if (
          !Number.isFinite(createdAt) ||
          !Number.isFinite(expiryDuration) ||
          expiryDuration <= 0 ||
          !Number.isFinite(deadline)
        ) {
          throw new Error(
            "Backend returned invalid group creation or expiry data",
          );
        }
        setExpiryLoadFailed(false);
        setExpiryAt(deadline);
        setCurrentTime(Date.now());

        if (response.data.isExpired || deadline <= Date.now()) {
          setIsGroupExpired(true);
          deleteGroup(groupName, username).catch((error) => {
            console.error("Failed to delete expired group", error);
          });
          return;
        }

        setIsGroupExpired(false);
      } catch (err) {
        console.error("Failed to fetch expiry time:", err);
        if (isActive) setExpiryLoadFailed(true);
      }
    };

    void fetchExpiryTime();

    return () => {
      isActive = false;
    };
  }, [resolvedGroupName, groupName, username]);

  useEffect(() => {
    if (expiryAt === null || minsLeft !== 0 || isGroupExpired) return;
    setIsGroupExpired(true);
    deleteGroup(groupName!, username!).catch((error) => {
      console.error("Failed to delete expired group", error);
    });
  }, [expiryAt, minsLeft, isGroupExpired, groupName, username]);

  // UPDATE GROUP
  const handleUpdateGroup = async () => {
    if (isReadOnly) return;
    if (newExpiryTime <= 0) {
      alert("Expiry time must be greater than zero.");
      return;
    }

    setIsUpdatingSettings(true);
    try {
      const requestedGroupName = newGroupName.trim();
      const settings = {
        newGroupName: requestedGroupName || groupName!,
        newExpiryMinutes: newExpiryTime,
      };
      const updateResponse = await updateGroupSettings(
        groupName!,
        settings,
        username!,
      );
      if (!updateResponse.data.updated) {
        throw new Error("The backend did not apply the group settings.");
      }
      showToast("Group settings updated", "success");

      // update local state
      const updatedGroupName = requestedGroupName || groupName!;
      if (updatedGroupName !== groupName) {
        setResolvedGroupName(updatedGroupName);
        navigate(`/group/${updatedGroupName}`);
      }

      setShowGroupSettings(false);

      // Refresh expiry time
      const response = await getGroupExpiryIn(updatedGroupName);
      const createdAt = Number(response.data.createdAtEpochMillis);
      const expiryDuration = Number(response.data.expiryDurationMinutes);
      const deadline = createdAt + expiryDuration * 60_000;
      if (
        !Number.isFinite(createdAt) ||
        !Number.isFinite(expiryDuration) ||
        expiryDuration <= 0 ||
        !Number.isFinite(deadline)
      ) {
        throw new Error(
          "Backend returned invalid group creation or expiry data",
        );
      }
      setExpiryLoadFailed(false);
      setExpiryAt(deadline);
      setCurrentTime(Date.now());
      setIsGroupExpired(response.data.isExpired || deadline <= Date.now());
      setNewGroupName("");
    } catch (error) {
      // group already exists
      if (
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        (error as any).response?.data?.message?.includes("already exists")
      ) {
        alert(
          "A group with this name already exists. Please choose a different name.",
        );
      }

      console.error("Failed to update group settings:", error);
      showToast("Could not update group settings", "error");
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  // CHECK FOR EXISTING GROUP NAME
  const checkGroupName = useCallback(async (name: string) => {
    if (!name) {
      setIsNameTaken(false);
      return;
    }

    setIsChecking(true);
    try {
      const response = await checkGroupNameExists(name);
      setIsNameTaken(response.data.exists);
    } catch (error) {
      console.error("Failed to check group name:", error);
    } finally {
      setIsChecking(false);
    }
  }, []);

  // DELETE GROUP
  const handleDeleteGroup = async () => {
    if (isReadOnly) return;
    try {
      await deleteGroup(groupName!, username!);
      showToast("Group deleted", "success");
      navigate("/group"); // or navigate to group list page
    } catch (error) {
      showToast("Could not delete group", "error");
      alert("Failed to delete group. You may not have permission.");
    }
  };

  // REMOVE MEMBER
  const handleRemoveMember = async (targetMember: string) => {
    if (isReadOnly) return;
    setIsRemovingMember(true);
    try {
      await removeMember(groupName!, targetMember);
      // update member list
      setMembersList((prev) =>
        prev.filter((member) => member !== targetMember),
      );
      membershipChanges.current.set(targetMember, "LEAVE");
      setMemberPendingRemoval(null);
    } catch (error) {
      console.error("Failed to remove member:", error);
      showToast(`Could not remove ${targetMember}`, "error");
      alert("Failed to remove member");
    } finally {
      setIsRemovingMember(false);
    }
  };

  // Add debounce to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      if (newGroupName && newGroupName !== resolvedGroupName) {
        checkGroupName(newGroupName);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [newGroupName, checkGroupName, resolvedGroupName]);

  return (
    // <div className="flex flex-col h-screen px-2 pt-4 pb-3 chatroom-background relative">
    <div className="flex flex-col h-screen bg-white px-2 pt-4 pb-3">
      {/* Group DEAD stamp */}
      {isGroupExpired ? (
        <div className="dead-stamp" area-hidden="true">
          DEAD
        </div>
      ) : isKickedOut ? (
        <div className="dead-stamp kicked-out-stamp" area-hidden="true">
          KICKED OUT
        </div>
      ) : null}

      <div className="flex items-center justify-between border border-black p-2 bg-white text-black rounded">
        {/* Back button */}
        <button
          id="back-button"
          onClick={() => {
            navigate("/group");
          }}
          className=" p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full transition-all duration-200 hover:scale-110 hover:cursor-pointer border border-blue"
          title="Back"
        >
          <BsArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-4">
          <h2
            className={`text-xl font-bold ${
              isGroupExpired ? "text-red-600" : ""
            }`}
          >
            #{isGroupExpired ? "DEAD" : resolvedGroupName}
          </h2>
          <div className="ml-3 flex items-center bg-gray-100 px-3 py-1 rounded-full border border-gray-300 timer-pulse">
            <span className="font-bold text-gray-600">
              ⏳
              {minsLeft !== null
                ? ` ${formattedTimeLeft(minsLeft)}`
                : expiryLoadFailed
                  ? " Timer unavailable - restart backend"
                  : " Loading..."}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Group settings button */}
          <button
            id="group-settings-button"
            disabled={isReadOnly}
            onClick={() => {
              setShowGroupSettings(true);
            }}
            className=" p-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-600 rounded-full transition-all duration-200 hover:scale-110 hover:cursor-pointer border border-yellow"
            title="Group settings"
          >
            <BsGearFill className="w-5 h-5" />
          </button>

          {/* Group members settings button */}
          <button
            id="group-members-button"
            disabled={isReadOnly}
            onClick={() => setShowMemberSettings(true)}
            className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full transition-all duration-200 hover:scale-110 hover:cursor-pointer border border-blue"
            title="Members settings"
          >
            <BsPersonFillGear className="w-5 h-5" />
          </button>

          {isAdmin && (
            // Delete group button
            <button
              id="delete-group-button"
              disabled={isReadOnly}
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-full transition-all duration-200 hover:scale-110 hover:cursor-pointer border border-red"
              title="Delete message"
            >
              <BsTrash3Fill className="w-5 h-5" />
            </button>
          )}

          {/* Logout button */}
          <button
            id="logout-button"
            disabled={isReadOnly}
            onClick={() => {
              localStorage.removeItem("username");
              navigate("/");
            }}
            className=" p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-full transition-all duration-200 hover:scale-110 hover:cursor-pointer border border-red"
            title="Logout"
          >
            <BsBoxArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Group settings popup */}
      {showGroupSettings && !isReadOnly && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-xs z-50">
          <div className="bg-white p-6 rounded-2xl shadow-lg max-w-xs w-full">
            <h3 className="text-lg font-bold mb-2 text-green-600 text-center">
              Group Settings{" "}
              <span className="drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">
                ⚙️
              </span>
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Group Name
              </label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder={resolvedGroupName}
                className={`w-full p-2 border rounded ${
                  isNameTaken ? "border-red-500" : ""
                }`}
              />
              {isChecking && (
                <p className="text-gray-500 text-sm mt-1 text-center">
                  Checking availability...
                </p>
              )}
              {isNameTaken && !isChecking && (
                <p className="text-center text-red-500 text-sm mt-1">
                  This name already exists!
                </p>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Expiry duration from creation (minutes)
              </label>
              <input
                type="number"
                value={newExpiryTime}
                onChange={(e) =>
                  setNewExpiryTime(
                    e.target.value === "" ? 0 : Number(e.target.value),
                  )
                }
                min="1"
                className="w-full p-2 border rounded"
              />
            </div>

            <div className="flex justify-center gap-2">
              <button
                id="update-group-button"
                onClick={handleUpdateGroup}
                disabled={
                  isUpdatingSettings ||
                  isNameTaken ||
                  isChecking ||
                  (!newGroupName.trim() && newExpiryTime <= 0)
                }
                className={`flex-1 px-3 py-1 ${
                  isUpdatingSettings ||
                  isNameTaken ||
                  isChecking ||
                  (!newGroupName.trim() && newExpiryTime <= 0)
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-600 hover:scale-110"
                } text-white rounded transition-all duration-200 cursor-pointer border border-black`}
              >
                {isUpdatingSettings ? "Updating..." : "Update"}
              </button>
              <button
                id="cancel-group-settings-button"
                onClick={() => {
                  setShowGroupSettings(false);
                  focusInput();
                }}
                className="flex-1 px-3 py-1 bg-gray-200 rounded transition-all duration-200 hover:scale-110 hover:bg-gray-300 cursor-pointer border border-black"
              >
                Cancel
              </button>
            </div>

            {/* Back button */}
            <div className="flex justify-center mt-4">
              <button
                id="back-to-chat-screen-from-group-settings-button"
                onClick={() => {
                  setShowGroupSettings(false);
                  focusInput();
                }}
                className=" p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full transition-all duration-200 hover:scale-110 hover:cursor-pointer border border-blue"
                title="Back"
              >
                <BsArrowLeft className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Members setting popup */}
      {showMemberSettings && !isReadOnly && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-xs bg-opacity-40 z-50 ">
          <div className="bg-white p-6 rounded-2xl shadow-lg max-w-xs w-full">
            <h3 className="text-lg font-bold mb-2 text-green-600 text-center">
              Members 😎
            </h3>
            <ul className="list-disc">
              {membersList.map((member) => (
                <li
                  key={member}
                  className="relative flex justify-center items-center py-1"
                >
                  <span className="text-lg">{member}</span>
                  {member !== username && (
                    <button
                      id="remove-member-button"
                      className="ml-2 px-1 py-1 bg-red-100 rounded-full transition-all duration-200 hover:bg-red-200 hover:scale-110 text-red-600 rounded text-sm cursor-pointer border border-red"
                      onClick={() => setMemberPendingRemoval(member)}
                      title="Remove member"
                    >
                      <BsPersonFillSlash className="" />
                    </button>
                  )}
                  {memberPendingRemoval === member && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 p-4 backdrop-blur-sm">
                      <div
                        role="alertdialog"
                        aria-label={`Remove ${member} from group`}
                        className="w-[35%] rounded-xl border border-gray-300 bg-white p-5 text-center text-sm text-gray-800 shadow-xl"
                      >
                        <p className="mb-4">
                          Remove{" "}
                          <span style={{ fontWeight: "bold" }}>{member}</span>{" "}
                          from this group?
                        </p>
                        <div className="flex justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => setMemberPendingRemoval(null)}
                            disabled={isRemovingMember}
                            className="min-w-20 rounded border border-gray-500 px-3 py-1.5 hover:bg-gray-100 cursor-pointer disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRemoveMember(member)}
                            disabled={isRemovingMember}
                            className="min-w-20 rounded border border-red-700 bg-red-600 px-3 py-1.5 text-white hover:bg-red-700 cursor-pointer disabled:opacity-50"
                          >
                            {isRemovingMember ? "Removing..." : "Remove"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {/* Back button */}
            <div className="flex justify-center mt-4">
              <button
                id="back-to-chat-screen-from-members-button"
                onClick={() => {
                  setShowMemberSettings(false);
                  focusInput();
                }}
                className=" p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full transition-all duration-200 hover:scale-110 hover:cursor-pointer border border-blue"
                title="Back"
              >
                <BsArrowLeft className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Confirmation Popup */}
      {showDeleteConfirm && !isReadOnly && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-xs bg-opacity-40 z-50 ">
          <div className="bg-white p-6 rounded shadow-lg max-w-xs w-full">
            <h3 className="text-lg font-bold mb-2 text-red-600 text-center">
              Delete Group ??
            </h3>
            <p className="mb-4 text-gray-700 text-center">
              Sure you want to delete this group ? <br /> This action{" "}
              <span className="font-extrabold underline">
                cannot be undone!
              </span>
            </p>
            <div className="flex justify-center gap-3">
              <button
                id="cancel-delete-group-button"
                className="min-w-24 px-3 py-1 bg-gray-200 rounded transition-all duration-200 hover:scale-110 hover:bg-gray-300 cursor-pointer border border-black"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  focusInput();
                }}
              >
                Cancel
              </button>
              <button
                id="confirm-delete-group-button"
                className="min-w-24 px-3 py-1 bg-red-600 text-white rounded transition-all duration-200 hover:scale-110 hover:bg-red-700 cursor-pointer border border-black"
                onClick={handleDeleteGroup}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className="flex-1 overflow-y-auto my-3 space-y-2 messages-container"
        ref={messageListRef}
        style={{
          scrollbarWidth: "thin",
        }}
      >
        {messages.map((msg, idx) => (
          <ChatMessageComponent
            key={msg.id || idx}
            message={msg}
            isOwnMessage={msg.sender === username}
            onDelete={handleDeleteMessage}
            onReply={handleReplyToMessage}
            username={username!}
            isReadOnly={isReadOnly}
          />
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Reply Preview */}
      {replyTo && (
        <div className="mb-2 p-2 bg-gray-200 rounded-lg border border-solid">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-600">
              Replying to{" "}
              <span className="font-semibold">{replyTo.sender}</span>:{" "}
              {replyTo.content.substring(0, 50)}
              {replyTo.content.length > 50 ? "..." : ""}
            </div>
            <button
              id="cancel-reply-button"
              onClick={cancelReply}
              disabled={isReadOnly}
              className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-full transition-all duration-200 hover:scale-110 hover:cursor-pointer border border-red"
              title="Close Groups"
            >
              <BsX className="w-2 h-2" />
            </button>
          </div>
        </div>
      )}

      {/* Message input field */}
      <div className="flex flex-col" style={{ position: "relative" }}>
        <p className="mb-1 text-center text-[11px] font-light text-gray-600">
          This group will{" "}
          <span style={{ fontWeight: "bold" }}>vanish from "My Groups"</span>{" "}
          once timer expires!
        </p>
        {/* Scroll to Bottom Button - bottom right above send button */}
        {showScrollToBottom && (
          <button
            id="scroll-to-bottom-button"
            onClick={scrollToBottom}
            disabled={isReadOnly}
            className="fixed md:absolute right-15 md:right-4 bottom-17 p-2 bg-black text-white rounded-full shadow-lg border-2 border-white  hover:bg-white hover:text-black hover:border-1 hover:border-black transition z-20 hover:scale-110 cursor-pointer"
            style={{
              boxShadow: "0 2px 8px rgba(14, 8, 8, 0.15)",
              transition: "opacity 0.3s, transform 0.3s",
            }}
            aria-label="Scroll to Bottom"
          >
            <FiArrowDown size={28} />
          </button>
        )}
        <div className="flex">
          <textarea
            id="message-input"
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            // className="flex-1 p-2 rounded-l border border-black bg-white focus:outline-none resize-none max-h-40 min-h-[40px]"
            className={`flex-1 p-2 rounded-l border border-black bg-white focus:outline-none resize-none max-h-40 min-h-[40px] ${
              isGroupExpired || isReadOnly ? "cursor-not-allowed" : ""
            }`}
            placeholder={
              isKickedOut
                ? "You were removed from this group"
                : isGroupExpired
                  ? "Group has expired ... 💀😵🪦"
                  : replyTo
                    ? `Reply to ${replyTo.sender}...`
                    : "your cheap shots ... 😏"
            }
            rows={1}
            style={{ overflow: "hidden" }}
            disabled={isGroupExpired || isReadOnly}
          />
          <button
            onClick={sendMessage}
            className={`py-2 px-6 ${
              isGroupExpired || isReadOnly
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700"
            } text-white border-2 border-black rounded transition duration-150 flex items-center justify-center`}
            disabled={
              !cleanMessage(input) ||
              !stompClient.current?.connected ||
              isGroupExpired ||
              isReadOnly
            }
            aria-label="Send Message"
          >
            <FiSend size={25} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatRoom;
