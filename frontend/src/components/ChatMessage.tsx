import React from "react";
import { BsTrash, BsReply, BsCopy } from "react-icons/bs";
import type { ChatMessageProps } from "../types";

const ChatMessageComponent: React.FC<ChatMessageProps> = ({
  message,
  isOwnMessage,
  onDelete,
  onReply,
}) => {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      // You could add a toast notification here
      console.log("Message copied to clipboard");
    } catch (err) {
      console.error("Failed to copy message:", err);
    }
  };

  const handleDelete = () => {
    if (onDelete && message.id) {
      onDelete(message.id);
    }
  };

  const handleReply = () => {
    if (onReply) {
      onReply(message);
    }
  };

  return (
    <div
      className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} mb-4`}
    >
      <div className="flex flex-col items-end">
        <div
          className={`px-4 py-3 rounded-2xl max-w-xs border shadow-lg transition-all duration-200 ${
            message.type === "CHAT"
              ? isOwnMessage
                ? "bg-blue-500/60 text-white border-black/30"
                : "bg-white/60 text-gray-900 border-gray-200/30"
              : "bg-yellow-200/60 text-gray-800 border border-dotted"
          } glassy-message-tile`}
          style={{
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            backgroundClip: "padding-box",
            border: message.type === "CHAT" ? "1.5px solid black" : undefined,
            boxShadow: "0 4px 24px 0 rgba(31, 38, 135, 0.10)",
          }}
        >
          {/* chat messages */}
          {message.type === "CHAT" ? (
            <>
              <div className="font-semibold text-xs mb-1 opacity-90 underline text-black">
                {message.sender}
              </div>
              <div
                className={`text-sm leading-relaxed ${
                  isOwnMessage
                    ? "drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,1)]"
                    : ""
                }`}
                style={{ whiteSpace: "pre-line" }}
              >
                {message.content}
              </div>
              <div className="text-[11px] text-right mt-2 text-black">
                {message.timestamp &&
                  new Date(message.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
              </div>
            </>
          ) : (
            <>
              <em className="text-[12px]">{message.content}</em>
              <div className="text-[11px] text-right mt-2 text-black">
                {message.timestamp &&
                  new Date(message.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        {message.type === "CHAT" && (
          <div className="flex gap-1 mt-1">
            {/* reply button */}
            <button
              onClick={handleReply}
              className="p-1.5 bg-gray-100 hover:bg-gray-200 border border-black/50 rounded-full transition-colors duration-150 cursor-pointer"
              title="Reply to message"
            >
              <BsReply className="w-3 h-3 text-gray-600" />
            </button>

            {/* delete button */}
            {isOwnMessage && (
              <button
                onClick={handleDelete}
                className="p-1.5 bg-red-100 hover:bg-red-200 border border-red-500 rounded-full transition-colors duration-150 cursor-pointer"
                title="Delete message"
              >
                <BsTrash className="w-3 h-3 text-red-600" />
              </button>
            )}

            {/* copy button */}
            <button
              onClick={handleCopy}
              className="p-1.5 bg-gray-100 hover:bg-gray-200 border border-black/50 rounded-full transition-colors duration-150 cursor-pointer"
              title="Copy message"
            >
              <BsCopy className="w-3 h-3 text-gray-600" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessageComponent;
