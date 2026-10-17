import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import GroupPage from "./pages/GroupPage";
import ChatRoom from "./pages/ChatRoom";
import { useChat } from "./context/ChatContext";

function App() {
  const { toast } = useChat();

  return (
    <BrowserRouter>
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-19 left-1/2 z-[2147483647] -translate-x-1/2 rounded-lg border px-4 py-2 font-medium shadow-xl ${
            toast.type === "success"
              ? "border-green-300 bg-green-100 text-green-900"
              : "border-red-300 bg-red-100 text-red-900"
          }`}
        >
          {toast.emphasizedUser &&
          toast.msg.startsWith(toast.emphasizedUser) ? (
            <>
              <strong className="underline">{toast.emphasizedUser}</strong>
              {toast.msg.slice(toast.emphasizedUser.length)}
            </>
          ) : (
            toast.msg
          )}
        </div>
      )}
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/group/:id" element={<ChatRoom />} />
        <Route path="/group" element={<GroupPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
