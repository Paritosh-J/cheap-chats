import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from "react";
import type { Group } from "../types";

interface ChatContextType {
  username: string;
  groups: Group[];
  toast: { msg: string; type: "success" | "error" } | null;
  showToast: (msg: string, type: "success" | "error") => void;
  setUsername: (username: string) => void;
  handleCreateGroup: (name: string, duration: number) => void;
  handleAddMember: (groupId: string, member: string) => void;
  handleRemoveMember: (groupId: string, member: string) => void;
  handleLeaveGroup: (groupId: string) => void;
  saveGroup: (group: Group) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [username, setUsername] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error") => {
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
      setToast({ msg, type });
      toastTimeout.current = setTimeout(() => {
        setToast(null);
        toastTimeout.current = null;
      }, 3000); // 3 seconds
  }, []);

  useEffect(
    () => () => {
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
    },
    [],
  );

  const handleCreateGroup = (name: string, duration: number) => {
    const newGroup: Group = {
      id: crypto.randomUUID(),
      name,
      creator: username,
      members: [username],
      messages: [],
      expiresAt: Date.now() + duration * 3600 * 1000,
      createdAt: Date.now(),
    };
    setGroups((prev) => [...prev, newGroup]);
    showToast("Group created successfully", "success");
  };

  const handleAddMember = (groupId: string, member: string) => {
    setGroups((prev) =>
      prev.map((group) =>
        group.id === groupId
          ? { ...group, members: [...group.members, member] }
          : group,
      ),
    );
    showToast(`${member} added ✅`, "success");
  };

  const handleRemoveMember = (groupId: string, member: string) => {
    setGroups((prev) =>
      prev.map((group) =>
        group.id === groupId
          ? { ...group, members: group.members.filter((m) => m !== member) }
          : group,
      ),
    );
    showToast(`${member} kicked out🩴`, "success");
  };

  const handleLeaveGroup = (groupId: string) => {
    setGroups((prev) => prev.filter((group) => group.id !== groupId));
    showToast("You left the group👋", "success");
  };

  const saveGroup = (group: Group) => {
    setGroups((prev) => [...prev, group]);
  };

  return (
    <ChatContext.Provider
      value={{
        username,
        setUsername,
        groups,
        toast,
        showToast,
        handleCreateGroup,
        handleAddMember,
        handleRemoveMember,
        handleLeaveGroup,
        saveGroup,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined)
    throw new Error("useChat must be used within a ChatProvider");
  return context;
};
