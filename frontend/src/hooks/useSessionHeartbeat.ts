import { useEffect } from "react";
import { heartbeatSession } from "../services/api";

export function useSessionHeartbeat() {
  useEffect(() => {
    if (!localStorage.getItem("sessionId")) return;

    const heartbeat = () => {
      void heartbeatSession().catch((error: unknown) => {
        console.error("Failed to refresh login session:", error);
      });
    };

    heartbeat();
    const intervalId = window.setInterval(heartbeat, 30_000);
    document.addEventListener("visibilitychange", heartbeat);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", heartbeat);
    };
  }, []);
}
