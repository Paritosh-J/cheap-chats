import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SockJS from "sockjs-client";
import { CompatClient, Stomp } from "@stomp/stompjs";
import type { ChatMessage } from "../types";
import { BsFillChatRightTextFill } from "react-icons/bs";
import { getGroupInfo, deleteMessage, getGroupMessages } from "../services/api";
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
        if (sessionStorage.getItem('justJoinedGroup') === 'true') {
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
          sessionStorage.removeItem('justJoinedGroup');
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

  const sendMessage = () => {
    // if input is empty or stompClient is not connected
    if (!input.trim() || !stompClient.current?.connected) return;

    // create chat message
    const msg: ChatMessage = {
      sender: username!,
      content: input,
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
    setReplyTo(null); // clear reply
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

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-slate-50 to-green-200 px-2 pt-4 pb-3">
      <div className="flex items-center justify-between border border-black p-2 bg-white text-black rounded">
        <h2 className="text-xl font-bold">Cheap Chats 🤌</h2>
        <h2 className="text-xl font-bold">#{resolvedGroupName}</h2>
        <button
          onClick={() => {
            localStorage.removeItem("username");
            navigate("/");
          }}
          className="bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1 rounded border border-black"
        >
          Logout
        </button>
      </div>

      <div className="flex-1 overflow-y-auto my-3 space-y-2">
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
        <div className="mb-2 p-2 bg-gray-200 rounded-lg">
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

      <div className="flex">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          className="flex-1 p-2 rounded-l border border-gray-300 bg-white focus:outline-none"
          placeholder={
            replyTo
              ? `Reply to ${replyTo.sender}...`
              : "your cheap shots ... 😏"
          }
        />
        <button
          onClick={sendMessage}
          className="py-2 px-6 bg-green-600 text-white rounded hover:bg-green-700 transition duration-150 cursor-pointer"
          disabled={!input.trim() || !stompClient.current?.connected}
        >
          <BsFillChatRightTextFill />
        </button>
      </div>
    </div>
  );
};

export default ChatRoom;
