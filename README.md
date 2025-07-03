# 💬 Cheap Chats

A lightweight, mobile-first real-time group chat app powered by **React + Vite + TailwindCSS** and **Spring Boot + WebSocket**. Create temporary chat groups, invite friends via links, and enjoy anonymous banter — because cheap talks matter 😏.

---

## 🚀 Features

✨ Real-time messaging with WebSockets (STOMP + SockJS)  
🎯 Create temporary chat groups with expiration  
🔗 Shareable group invite links (no registration!)  
🙋‍♂️ Join/leave groups with live broadcast  
👑 Admin can remove members (but can’t be removed)  
📱 Clean, mobile-first UI (no desktop layout needed!)

---

## 🏗️ Tech Stack

### Frontend
- ⚡ React + Vite + TypeScript
- 🎨 TailwindCSS
- 🔌 Socket.IO / STOMP Client

### Backend
- ☕ Spring Boot 3
- 📡 WebSocket (STOMP Protocol)
- 💾 Spring Data JPA + H2 (or PostgreSQL)
- 🔐 RESTful APIs

---

## 📁 Project Structure

```
cheap-chats/
├── cheap-chats-frontend/   # Vite + React + Tailwind
├── cheap-chats-backend/    # Spring Boot + WebSocket
```

---

## 🛠️ Local Setup

### ✅ Prerequisites
- Node.js (v18+)
- Java 17+
- Maven

### 🖥️ Frontend
```bash
cd cheap-chats-frontend
npm install
npm run dev
```

### 🔧 Backend
```bash
cd cheap-chats-backend
./mvnw spring-boot:run
```

---

## 🔗 API Endpoints

```
POST /api/login?username=raj
POST /api/group?name=devs&createdBy=raj&expiresInMinutes=60
POST /api/group/devs/join?username=sid
GET  /api/group/devs
```

---

## ▶️ Sample Flow

1. User logs in with a unique username.
2. Creates a group with name + expiry (e.g. `devs`, 60 mins).
3. Group link is shared as `/group/devs`
4. Friends join using link or by name.
5. All join/leave/chat messages broadcast live.
