import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [membersList, setMembersList] = useState<string[]>([]);
  const [isNameTaken, setIsNameTaken] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [minsLeft, setMinsLeft] = useState<number>(60);
  const [newExpiryTime, setNewExpiryTime] = useState(60);

  // fetch persisted messages
  useEffect(() => {
    // if username/groupName is empty
    if (!username || !groupName) {
      // redirect to login page
      navigate("/");
      return;
    }

    // fetch group name
    const fetchGroupName = async () => {
      try {
        const response = await getGroupInfo(groupName);
        setResolvedGroupName(response.data.groupName);
        setIsAdmin(response.data.createdBy === username);
      } catch (error) {
        console.error("Failed to fetch group info:", error);
        setResolvedGroupName("Group not found!");
      }
    };

    // fetch persisted messages
    const fetchMessages = async () => {
      try {
        const data = await getGroupMessages(groupName);
        setMessages(data);
      } catch (error) {
        console.error("Failed to fetch messages:", error);
        setMessages([]);
      }
    };

    fetchGroupName();
    fetchMessages();

    // initialize SockJS and Stomp client
    const socket = new SockJS("http://localhost:8080/ws");
    stompClient.current = Stomp.over(socket);

    stompClient.current.connect(
      {},
      () => {
        console.log("WebSocket connected successfully");

        // Subscribe to group messages
        stompClient.current?.subscribe(
          `/topic/group/${groupName}`,
          (payload: { body: string }) => {
            const msg: ChatMessage = JSON.parse(payload.body);
            console.log("Received WebSocket message:", msg);

            if (msg.type === "DELETE") {
              console.log("Processing DELETE message for ID:", msg.id);
              // Remove the deleted message from the UI
              setMessages((prev) => {
                const filtered = prev.filter((m) => m.id !== msg.id);
                console.log(
                  `Removed message ${msg.id}. Messages count: ${prev.length} -> ${filtered.length}`
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
          }
        );

        // Send JOIN message only if just joined
        if (sessionStorage.getItem("justJoinedGroup") === "true") {
          const joinMsg: ChatMessage = {
            sender: username!,
            content: `${username} joined the group`,
            type: "JOIN",
            timestamp: new Date().toISOString(),
          };
          stompClient.current?.send(
            `/app/chat/${groupName}/send`,
            {},
            JSON.stringify(joinMsg)
          );
          sessionStorage.removeItem("justJoinedGroup");
        }
      },
      (error: any) => {
        console.error("WebSocket connection error:", error);
      }
    );

    // handle disconnection (leave group)
    return () => {
      if (stompClient.current?.connected) {
        // create LEAVE message
        const leaveMsg: ChatMessage = {
          sender: username!,
          content: `${username} left the group`,
          type: "LEAVE",
          timestamp: new Date().toISOString(),
        };

        // send leave message to the server
        stompClient.current.send(
          `/app/chat/${groupName}/send`,
          {},
          JSON.stringify(leaveMsg)
        );

        // disconnect the client
        stompClient.current.disconnect();
      }
    };
  }, [groupName, username, navigate]);

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
    const fetchMembers = async () => {
      try {
        const response = await getGroupInfo(groupName!);
        setMembersList(response.data.members || []);
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

  // Clean message: trim and remove leading/trailing whitespace and blank lines
  const cleanMessage = (msg: string) => {
    // Remove leading/trailing whitespace and blank lines
    return msg.replace(/^[\s\n]+|[\s\n]+$/g, "");
  };

  // Send message with cleaning
  const sendMessage = useCallback(() => {
    const cleaned = cleanMessage(input);
    if (!cleaned || !stompClient.current?.connected) return;
    const msg: ChatMessage = {
      sender: username!,
      content: cleaned,
      type: "CHAT",
      timestamp: new Date().toISOString(),
      replyTo: replyTo
        ? {
            sender: replyTo.sender,
            content: replyTo.content,
            timestamp: replyTo.timestamp,
          }
        : undefined,
    };

    // send message to the server
    stompClient.current.send(
      `/app/chat/${groupName}/send`,
      {},
      JSON.stringify(msg)
    );

    // update local messages state
    setInput("");
    setReplyTo(null);
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      focusInput();
    }
  }, [input, stompClient, username, groupName, replyTo]);

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
    try {
      console.log(
        `Attempting to delete message ${messageId} in group ${groupName} by user ${username}`
      );
      // Call backend API to delete message
      await deleteMessage(messageId.toString(), groupName!, username!);
      console.log(`Delete API call successful for message ${messageId}`);
      // The message will be removed from UI via WebSocket notification
    } catch (error) {
      console.error("Failed to delete message:", error);
      // Fallback: remove from local state if API call fails
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    }
  };

  // REPLY TO MESSAGE
  const handleReplyToMessage = (message: ChatMessage) => {
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

  // expiry timer
  useEffect(() => {
    const fetchExpiryTime = async () => {
      try {
        const response = await getGroupExpiryIn(resolvedGroupName);
        console.log("expires in:", response.data.minsLeft);
        setMinsLeft(response.data.minsLeft);
      } catch (err) {
        console.error("Failed to fetch expiry time:", err);
      }
    };

    if (resolvedGroupName !== "Loading...") fetchExpiryTime();

    // update timer every second
    const timer = setInterval(() => {
      setMinsLeft((prev) => {
        const newMinutes = prev - 1 / 60;

        if (newMinutes <= 0) {
          clearInterval(timer);
          // navigate("/group"); // Redirect when expired
          return 0;
        }

        return newMinutes;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [groupName, navigate]);

  // UPDATE GROUP
  const handleUpdateGroup = async () => {
    try {
      // update group settings
      await updateGroupSettings(groupName!, {
        newGroupName: newGroupName,
        newExpiryMinutes: newExpiryTime,
      });

      // update local state
      if (newGroupName) {
        setResolvedGroupName(newGroupName);
        navigate(`/group/${newGroupName}`);
      }

      // Refresh expiry time
      const response = await getGroupExpiryIn(newGroupName || groupName!);
      if (response.data.minsLeft) {
        setMinsLeft(response.data.minsLeft);
      }

      setShowGroupSettings(false);
      alert("Group settings updated!");
    } catch (error) {
      // group already exists
      if (
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        (error as any).response?.data?.message?.includes("already exists")
      ) {
        alert(
          "A group with this name already exists. Please choose a different name."
        );
      }

      console.error("Failed to update group settings:", error);
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
    try {
      await deleteGroup(groupName!, username!);
      navigate("/group"); // or navigate to group list page
    } catch (error) {
      alert("Failed to delete group. You may not have permission.");
    }
  };

  // REMOVE MEMBER
  const handleRemoveMember = async (targetMember: string) => {
    try {
      await removeMember(groupName!, targetMember);
      // update member list
      setMembersList((prev) =>
        prev.filter((member) => member !== targetMember)
      );
    } catch (error) {
      console.error("Failed to remove member:", error);
      alert("Failed to remove member");
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
    <div className="flex flex-col h-screen bg-gradient-to-b from-slate-50 to-green-200 px-2 pt-4 pb-3">
      <div className="flex items-center justify-between border border-black p-2 bg-white text-black rounded">
        {/* Back button */}
        <button
          onClick={() => {
            navigate("/group");
          }}
          className=" p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full transition-all duration-200 hover:scale-110 hover:cursor-pointer border border-blue"
          title="Back"
        >
          <BsArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold">#{resolvedGroupName}</h2>
          <div className="ml-3 flex items-center bg-gray-100 px-3 py-1 rounded-full border border-gray-300 timer-pulse">
            <span className="font-bold text-gray-600">
              ⏳ {formattedTimeLeft(minsLeft)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Group settings button */}
          <button
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
            onClick={() => setShowMemberSettings(true)}
            className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full transition-all duration-200 hover:scale-110 hover:cursor-pointer border border-blue"
            title="Members settings"
          >
            <BsPersonFillGear className="w-5 h-5" />
          </button>

          {isAdmin && (
            // Delete group button
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-full transition-all duration-200 hover:scale-110 hover:cursor-pointer border border-red"
              title="Delete message"
            >
              <BsTrash3Fill className="w-5 h-5" />
            </button>
          )}

          {/* Logout button */}
          <button
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
      {showGroupSettings && (
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
                <p className="text-gray-500 text-sm mt-1">
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
                Extend Expiry (default 60 minutes)
              </label>
              <input
                type="number"
                value={newExpiryTime}
                onChange={(e) => setNewExpiryTime(parseInt(e.target.value))}
                min="1"
                className="w-full p-2 border rounded"
              />
            </div>

            <div className="flex justify-center gap-2">
              <button
                onClick={handleUpdateGroup}
                disabled={
                  isNameTaken || isChecking || (!newGroupName && !newExpiryTime)
                }
                className={`flex-1 px-3 py-1 ${
                  isNameTaken || isChecking || (!newGroupName && !newExpiryTime)
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-600 hover:scale-110"
                } text-white rounded transition-all duration-200 cursor-pointer border border-black`}
              >
                Update
              </button>
              <button
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
      {showMemberSettings && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-xs bg-opacity-40 z-50 ">
          <div className="bg-white p-6 rounded-2xl shadow-lg max-w-xs w-full">
            <h3 className="text-lg font-bold mb-2 text-green-600 text-center">
              Members 😎
            </h3>
            <ul className="list-disc">
              {membersList.map((member) => (
                <li
                  key={member}
                  className="flex justify-center items-center py-1"
                >
                  <span className="text-lg">{member}</span>
                  {member !== username && (
                    <button
                      className="ml-2 px-1 py-1 bg-red-100 rounded-full transition-all duration-200 hover:bg-red-200 hover:scale-110 text-red-600 rounded text-sm cursor-pointer border border-red"
                      onClick={() => handleRemoveMember(member)}
                      title="Remove member"
                    >
                      <BsPersonFillSlash className="" />
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {/* Back button */}
            <div className="flex justify-center mt-4">
              <button
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
      {showDeleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-xs bg-opacity-40 z-50 ">
          <div className="bg-white p-6 rounded shadow-lg max-w-xs w-full">
            <h3 className="text-lg font-bold mb-2 text-red-600 text-center">
              Delete Group !?
            </h3>
            <p className="mb-4 text-gray-700 text-center">
              Sure you want to delete this group ? <br /> This action{" "}
              <span className="font-extrabold underline">
                cannot be undone!
              </span>
            </p>
            <div className="flex justify-center gap-2">
              <button
                className="flex-1 px-3 py-1 bg-gray-200 rounded transition-all duration-200 hover:scale-110 hover:bg-gray-300 cursor-pointer border border-black"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  focusInput();
                }}
              >
                Cancel
              </button>
              <button
                className="flex-1 px-3 py-1 bg-red-600 text-white rounded transition-all duration-200 hover:scale-110 hover:bg-red-700 cursor-pointer border border-black"
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
              onClick={cancelReply}
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
        {/* Scroll to Bottom Button - bottom right above send button */}
        {showScrollToBottom && (
          <button
            onClick={scrollToBottom}
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
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            className="flex-1 p-2 rounded-l border border-black bg-white focus:outline-none resize-none max-h-40 min-h-[40px]"
            placeholder={
              replyTo
                ? `Reply to ${replyTo.sender}...`
                : "your cheap shots ... 😏"
            }
            rows={1}
            style={{ overflow: "hidden" }}
          />
          <button
            onClick={sendMessage}
            className="py-2 px-6 bg-green-600 text-white border-2 border-black rounded hover:bg-green-700 transition duration-150 cursor-pointer flex items-center justify-center"
            disabled={!cleanMessage(input) || !stompClient.current?.connected}
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
