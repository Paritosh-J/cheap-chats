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
  BsTrash,
  BsTrash3Fill,
} from "react-icons/bs";
import {
  getGroupInfo,
  deleteMessage,
  getGroupMessages,
  deleteGroup,
  removeMember,
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
    const handleFocus = () => {
      inputRef.current?.focus();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  // Scroll to bottom logic and show/hide button
  const handleScroll = useCallback(() => {
    const el = messageListRef.current;
    if (!el) return;
    const threshold = 150; // px from bottom
    const atBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setShowScrollToBottom(!atBottom);
  }, []);

  useEffect(() => {
    const el = messageListRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll);
    // Initial check
    handleScroll();
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Scroll to bottom function
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
    if (inputRef.current) inputRef.current.style.height = "auto";
  }, [input, stompClient, username, groupName, replyTo]);

  // Handle keydown for textarea
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    // Shift+Enter inserts newline (default behavior)
  };

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

  const handleReplyToMessage = (message: ChatMessage) => {
    setReplyTo(message);
    // Focus on input field
    const inputElement = document.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement;
    if (inputElement) {
      inputElement.focus();
    }
  };

  const cancelReply = () => {
    setReplyTo(null);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleDeleteGroup = async () => {
    try {
      await deleteGroup(groupName!, username!);
      navigate("/groups"); // or navigate to group list page
    } catch (error) {
      alert("Failed to delete group. You may not have permission.");
    }
  };

  

  return (
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

        <h2 className="text-xl font-bold">#{resolvedGroupName}</h2>

        <div className="flex items-center gap-2">
          {/* Group settings button */}
          <button
            onClick={() => {
              // navigate("/group");
            }}
            className=" p-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-600 rounded-full transition-all duration-200 hover:scale-110 hover:cursor-pointer border border-yellow"
            title="Group settings"
          >
            <BsGearFill className="w-5 h-5" />
          </button>

          {/* Group members settings button */}
          <button
            onClick={() => setShowMemberSettings(true)}
            className=" p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full transition-all duration-200 hover:scale-110 hover:cursor-pointer border border-blue"
            title="Members settings"
          >
            <BsPersonFillGear className="w-5 h-5" />
          </button>

          {isAdmin && (
            // Delete button
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

      {/* Group Members setting popup */}
      {showMemberSettings && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-xs bg-opacity-40 z-50 ">
          <div className="bg-white p-6 rounded shadow-lg max-w-xs w-full">
            <h3 className="text-lg font-bold mb-2 text-green-600 text-center">
              Members
            </h3>
            
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
                className="px-3 py-1 bg-gray-200 rounded transition-all duration-200 hover:scale-110 hover:bg-gray-300 cursor-pointer"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1 bg-red-600 text-white rounded transition-all duration-200 hover:scale-110 hover:bg-red-700 cursor-pointer"
                onClick={handleDeleteGroup}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className="flex-1 overflow-y-auto my-3 space-y-2"
        ref={messageListRef}
        style={{ position: "relative" }}
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
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}

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
