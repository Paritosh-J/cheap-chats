import { useEffect, useState, type FC, type FormEvent } from "react";
import { useChat } from "../context/ChatContext";
import { useNavigate } from "react-router-dom";
import { Clock, LogOut, MessageCircle, Plus, Users } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface CreateGroupModalProps {
  onClose: () => void;
  onCreateGroup: (name: string, duration: number) => void;
  newGroupName: string;
  setNewGroupName: (name: string) => void;
}

const CreateGroupModal: FC<CreateGroupModalProps> = ({
  onClose,
  onCreateGroup,
  newGroupName,
  setNewGroupName,
}) => {
  const [duration, setDuration] = useState(1);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newGroupName.trim();
    if (name && duration > 0) onCreateGroup(name, duration);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.form
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-900 p-6"
        initial={{ scale: 0.95, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 12 }}
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 className="mb-5 text-xl font-semibold">Create a group</h2>
        <label className="mb-2 block text-sm text-white/60" htmlFor="group-name">
          Group name
        </label>
        <input
          id="group-name"
          autoFocus
          value={newGroupName}
          onChange={(event) => setNewGroupName(event.target.value)}
          className="mb-4 w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 focus:border-indigo-500 focus:outline-none"
          maxLength={30}
          required
        />
        <label className="mb-2 block text-sm text-white/60" htmlFor="duration">
          Duration (hours)
        </label>
        <input
          id="duration"
          type="number"
          min={1}
          value={duration}
          onChange={(event) => setDuration(Number(event.target.value))}
          className="mb-6 w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 focus:border-indigo-500 focus:outline-none"
          required
        />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-zinc-800 py-3 hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 rounded-xl bg-indigo-600 py-3 font-medium hover:bg-indigo-500"
          >
            Create
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
};

const HomePage: FC = () => {
  const { username, setUsername, groups, showToast, handleCreateGroup } = useChat();
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [joinGroupId, setJoinGroupId] = useState("");
  const [now, setNow] = useState(0);

  const sortedGroups = [...groups].sort((a, b) => b.createdAt - a.createdAt);

  useEffect(() => {
    const updateTime = () => setNow(Date.now());
    updateTime();
    const interval = setInterval(updateTime, 60_000);
    return () => clearInterval(interval);
  }, []);

  const handleJoin = () => {
    const id = joinGroupId.trim();
    if (!id) {
      showToast("Please enter a Group ID ⚠️", "error");
      return;
    }
    navigate(`/group/${id}`);
    setJoinGroupId("");
    setShowJoinInput(false);
  };

  if (!username) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 text-center bg-gradient-to-b from-zinc-950 to-black">
        <div className="mb-12">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-indigo-500/10 rounded-full">
              <MessageCircle size={64} className="text-indigo-400" />
            </div>
          </div>
          <h1 className="text-6xl font-bold tracking-tighter mb-3">
            CHEAP CHATS
          </h1>
          <p className="text-xl text-white/60">
            Temporary group chats. No accounts. Real-time.
          </p>
        </div>

        <div className="w-full max-w-xs">
          <div className="text-sm text-white/50 mb-3">CHOOSE YOUR USERNAME</div>
          <input
            type="text"
            placeholder="Enter unique username"
            className="w-full bg-zinc-900 border border-white/20 focus:border-indigo-500 rounded-2xl px-6 py-4 text-xl placeholder:text-white/40 focus:outline-none mb-4"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const val = (e.target as HTMLInputElement).value;
                if (val.trim()) setUsername(val);
              }
            }}
          />
          <button
            onClick={() => {
              const input = document.querySelector("input") as HTMLInputElement;
              if (input && input.value.trim()) setUsername(input.value);
            }}
            className="w-full py-4 bg-white text-black font-semibold rounded-2xl flex items-center justify-center gap-2 hover:bg-white/90 transition"
          >
            START CHATTING
          </button>
          <div className="mt-8 text-[10px] text-white/30">
            No sign-up. No tracking. Just fun temporary groups.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-zinc-950/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="text-2xl font-bold tracking-[-2px]">CHEAP CHATS</div>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-4 py-1 rounded-full bg-white/5 text-xs text-white/60 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> LIVE
          </div>
          <button 
            onClick={() => {
              sessionStorage.removeItem("username");
              window.location.reload();
            }}
            className="text-white/70 hover:text-white transition"
          >
            <LogOut size={19} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="mb-10">
          <div className="flex justify-between items-center mb-4">
            <div>
              <div className="text-xs uppercase tracking-[3px] text-white/40">WELCOME BACK</div>
              <div className="text-4xl font-semibold tracking-tight">{username}</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-4 mb-10">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="h-28 flex flex-col items-center justify-center bg-zinc-900 hover:bg-zinc-800 border border-white/10 rounded-3xl transition group"
          >
            <Plus className="mb-3 text-indigo-400 group-hover:scale-110 transition" size={36} />
            <div className="font-medium">Create Group</div>
            <div className="text-xs text-white/40">New temporary room</div>
          </button>

          <button 
            onClick={() => setShowJoinInput(!showJoinInput)}
            className="h-28 flex flex-col items-center justify-center bg-zinc-900 hover:bg-zinc-800 border border-white/10 rounded-3xl transition group"
          >
            <Users className="mb-3 text-indigo-400 group-hover:scale-110 transition" size={36} />
            <div className="font-medium">Join Group</div>
            <div className="text-xs text-white/40">Enter ID or link</div>
          </button>
        </div>

        {showJoinInput && (
          <div className="mb-9">
            <div className="flex gap-3">
              <input
                type="text"
                value={joinGroupId}
                onChange={(e) => setJoinGroupId(e.target.value)}
                placeholder="PASTE GROUP ID HERE"
                className="flex-1 bg-zinc-900 border border-white/10 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:border-white/30 placeholder:text-white/30"
              />
              <button 
                onClick={handleJoin}
                className="px-8 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-sm font-medium flex items-center"
              >
                JOIN
              </button>
            </div>
            <div className="text-[10px] text-white/40 mt-2 pl-1">Example: 9f8a2c1d-...</div>
          </div>
        )}

        {/* My Groups */}
        <div>
          <div className="flex items-center justify-between mb-5 px-1">
            <div className="uppercase text-xs tracking-[2px] text-white/40">ACTIVE GROUPS</div>
            <div className="text-xs text-white/40">{groups.length}</div>
          </div>

          {sortedGroups.length > 0 ? (
            <div className="space-y-3">
              {sortedGroups.map((group) => {
                const remainingMinutes = Math.max(
                  0,
                  Math.ceil((group.expiresAt - now) / 60_000),
                );
                const h = Math.floor(remainingMinutes / 60);
                const m = remainingMinutes % 60;

                return (
                  <motion.div
                    key={group.id}
                    whileHover={{ scale: 1.01 }}
                    onClick={() => navigate(`/group/${group.id}`)}
                    className="group bg-zinc-900 border border-white/10 rounded-3xl p-5 flex justify-between items-center cursor-pointer active:scale-[0.985]"
                  >
                    <div className="flex-1 pr-4">
                      <div className="font-semibold text-lg mb-0.5 tracking-tight">
                        {group.name}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/50">
                        <span>by {group.creator}</span>
                        <span className="inline-block w-0.5 h-0.5 bg-white/50 rounded-full" />
                        <span>{group.members.length} members</span>
                      </div>
                    </div>

                    <div className="text-right text-xs">
                      <div className="flex items-center justify-end gap-1 text-emerald-400 mb-1">
                        <Clock size={13} /> {h}h {m}m
                      </div>
                      <div className="text-[10px] text-white/40">
                        expires soon
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 text-center">
              <div className="mx-auto w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-5">
                <Users className="text-white/30" size={34} />
              </div>
              <div className="font-medium mb-1">No active groups yet</div>
              <div className="text-sm text-white/50 max-w-[240px] mx-auto">Create a group or join one using an invite link</div>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateGroupModal 
            onClose={() => setShowCreateModal(false)} 
            onCreateGroup={(name, duration) => {
              handleCreateGroup(name, duration);
              setShowCreateModal(false);
              setNewGroupName("");
            }} 
            newGroupName={newGroupName} 
            setNewGroupName={setNewGroupName} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default HomePage;
