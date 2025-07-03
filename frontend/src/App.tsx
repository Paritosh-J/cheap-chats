import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import GroupPage from "./pages/GroupPage";
import ChatRoom from "./pages/ChatRoom";

function App() {
  return (
    <BrowserRouter>
      <Routes>`
        <Route path="/" element={<LoginPage />} />`
        <Route path="/group/:id" element={<ChatRoom />} />
        <Route path="/group" element={<GroupPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
