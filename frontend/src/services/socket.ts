import { io } from "socket.io-client";

const socket = io("http://localhost:8080/ws", {
  transports: ["websocket"],
  autoConnect: false,
});

export default socket;
