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
          className={`fixed top-19 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2 text-white shadow-lg ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.msg}
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
