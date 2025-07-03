import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SockJS from "sockjs-client";
import { CompatClient, Stomp } from "@stomp/stompjs";
import type { ChatMessage } from "../types";
import { BsFillChatRightTextFill } from "react-icons/bs";
import { getGroupInfo } from "../services/api";
import axios from "axios";

const ChatRoom: React.FC = () => {
  const navigate = useNavigate(); // for navigation to pages

  const params = useParams<{ id?: string }>();
  const groupName = params.id;

  const [resolvedGroupName, setResolvedGroupName] = useState("Loading...");
  const username = localStorage.getItem("username");
  const [messages, setMessages] = useState<ChatMessage[]>([]); // chat messages
  const [input, setInput] = useState(""); // message input in text box
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
        const response = await axios.get(`/api/messages/${groupName}`);
        let data = response.data;
        if (!Array.isArray(data) && data && typeof data === "object" && "Content" in data) {
          try {
            data = JSON.parse(data.Content);
          } catch (e) {
            data = [];
          }
        }
        if (!Array.isArray(data)) data = [];
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

    stompClient.current.connect({}, () => {
      // Subscribe to group messages
      stompClient.current?.subscribe(
        `/topic/group/${groupName}`,
        (payload: { body: string }) => {
          const msg: ChatMessage = JSON.parse(payload.body);
          setMessages((prev) => [...prev, msg]);
        }
      );

      // create JOIN message
      const joinMsg: ChatMessage = {
        sender: username!,
        content: `${username} joined the group`,
        type: "JOIN",
        timestamp: new Date().toISOString(),
      };

      // send join message to the server
      stompClient.current?.send(
        `/app/chat/${groupName}/send`,
        {},
        JSON.stringify(joinMsg)
      );
    });

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
    };

    // send message to the server
    stompClient.current.send(
      `/app/chat/${groupName}/send`,
      {},
      JSON.stringify(msg)
    );

    // update local messages state
    setInput("");
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-screen bg-gray-200 px-2 pt-4 pb-3">
      <div className="flex items-center justify-between border border-black p-2 bg-white text-black rounded">
        <h2 className="text-xl font-bold">Cheap Chats 🤌</h2>
        <h2 className="text-xl font-bold">#{resolvedGroupName}</h2>
        <button
          onClick={() => {
            localStorage.removeItem("username");
            navigate("/");
          }}
          className="bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1 rounded"
        >
          Logout
        </button>
      </div>

      <div className="flex-1 overflow-y-auto my-3 space-y-2">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${
              msg.sender === username ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`px-3 py-2 rounded-lg max-w-xs ${
                msg.type === "CHAT"
                  ? msg.sender === username
                    ? "bg-blue-500 text-white"
                    : "bg-white text-gray-900 border"
                  : "bg-yellow-200 text-gray-800 text-sm"
              }`}
            >
              {msg.type === "CHAT" ? (
                <>
                  <div className="font-semibold text-xs mb-1">{msg.sender}</div>
                  <div>{msg.content}</div>
                  <div className="text-[10px] text-right mt-1 text-gray-500">
                    {msg.timestamp &&
                      new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                  </div>
                </>
              ) : (
                <em className="text-[12px]">{msg.content}</em>
              )}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div className="flex border border-black rounded">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          className="flex-1 p-2 rounded-l border border-gray-300 bg-white focus:outline-none"
          placeholder="your cheap shots ... 😏"
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
