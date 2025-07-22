import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createGroup, joinGroup, getUserGroups } from "../services/api";
import { BsArrow90DegLeft, BsArrowLeft, BsArrowRight, BsBoxArrowRight, BsX } from "react-icons/bs";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import type { ChatGroup } from "../types";

const GroupPage: React.FC = () => {
  const [groupName, setGroupName] = useState("");
  const [expiry, setExpiry] = useState(60); // default expiry time in minutes
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [myGroups, setMyGroups] = useState<ChatGroup[]>([]);
  const [showGroups, setShowGroups] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);

  const username = localStorage.getItem("username");

  useEffect(() => {
    // if no username in localStorage
    if (!username) {
      // redirect to login page
      navigate("/");
    }
  }, [username, navigate]);

  // create group method
  const handleCreate = async () => {
    // if group name is empty
    if (!groupName.trim()) {
      // set error message
      setError("Group name cannot be empty");
      return;
    }

    try {
      // call createGroup function from api service
      const response = await createGroup(groupName.trim(), username!, expiry);

      if (response.status === 200) {
        // set flag to indicate just joined
        sessionStorage.setItem("justJoinedGroup", "true");
        // redirect to newly created group
        navigate(`/group/${response.data.groupName}`);
      } else {
        setError("Failed to create group. Please try again.");
      }
    } catch (err: any) {
      if (err.response && err.response.status === 409) {
        // if group already exists
        setError(
          "Group with this name already exists. Please choose a different name."
        );
      } else {
        // for any other error
        setError("An error occurred while creating the group.");
      }
    }
  };

  // join group method
  const handleJoin = async () => {
    // if group ID is empty
    if (!groupName.trim()) {
      // set error message
      setError("Group name can't be empty");
      return;
    }

    try {
      // call joinGroup function from api service
      const response = await joinGroup(groupName.trim(), username!);

      if (response.status === 200) {
        // set flag to indicate just joined
        sessionStorage.setItem("justJoinedGroup", "true");
        // redirect to the group chat room
        navigate(`/group/${response.data.groupName}`);
      } else {
        setError("Failed to join group. Please check the Group ID.");
      }
    } catch (err) {
      setError("An error occurred while joining the group.");
    }
  };

  const fetchMyGroups = async () => {
    setLoadingGroups(true);
    try {
      const response = await getUserGroups(username!);
      setMyGroups(response.data);
      setShowGroups(true);
    } catch (err) {
      setError("Failed to fetch your groups.");
    } finally {
      setLoadingGroups(false);
    }
  };

  return (
    <div className="min-h-screen bg-blue-50 dark:bg-gray-900 flex flex-col items-center justify-center px-4 py-6">
      <div className="bg-white rounded-xl shadow-md p-6 w-full max-w-sm">
        <div className="flex justify-center items-center">
          <DotLottieReact
            src="https://lottie.host/7002269e-f8c6-4ebf-9e49-93fc360d7d0a/csFyOhj0oA.lottie"
            loop
            autoplay
            style={{ width: 85, height: 85 }}
          />
          <span
            style={{
              height: 120,
              display: "flex",
              alignItems: "center",
              color: "#00bd32",
              fontWeight: "bold",
              fontSize: "2rem",
              whiteSpace: "nowrap",
            }}
          >
            {username}👋
          </span>
        </div>

        <div className="mb-5">
          <h3 className="font-medium mb-2 text-gray-700">Create a New Group</h3>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group Name"
            className="w-full mb-2 p-2 border border-gray-300 rounded"
          />
          <input
            type="number"
            value={expiry}
            onChange={(e) => setExpiry(parseInt(e.target.value, 10))}
            placeholder="Expires in (minutes)"
            className="w-full mb-2 p-2 border border-gray-300 rounded"
          />
          <button
            onClick={handleCreate}
            className="w-full bg-green-500 text-white font-bold py-2 rounded hover:bg-green-600 transition-all cursor-pointer"
          >
            <span className="drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">
              Create Group
            </span>
          </button>

          {/* My Groups Button */}
          <button
            onClick={fetchMyGroups}
            className="w-full bg-purple-500 text-white font-bold py-2 rounded mt-2 hover:bg-purple-600 transition-all cursor-pointer"
          >
            <span className="drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">
              {loadingGroups ? "Loading..." : "My Groups"}
            </span>
          </button>

          {/* My Groups List */}
          {showGroups && (
            <div className="mt-2 bg-gray-100 rounded p-2 border border-gray-300">
              {/* <h4 className="font-semibold mb-1 text-center">Your Groups</h4> */}
              {myGroups.length === 0 ? (
                <div className="text-gray-500 text-sm text-center">
                  No active groups found.
                </div>
              ) : (
                <ul>
                  {myGroups.map((group) => (
                    <li
                      key={group.groupName}
                      className="flex justify-center items-center py-1"
                    >
                      <span>#{group.groupName}</span>
                      <button
                        className="ml-2 px-2 py-1 bg-green-100 rounded-full transition-all duration-200 hover:bg-green-200 hover:scale-110 text-green-600 rounded text-xs cursor-pointer border border-green"
                        onClick={() => navigate(`/group/${group.groupName}`)}
                      >
                        <BsArrowRight className="" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex justify-center mt-4">
                <button
                  onClick={() => setShowGroups(false)}
                  className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-full transition-all duration-200 hover:scale-110 hover:cursor-pointer border border-red"
                  title="Close Groups"
                >
                  <BsX className="w-2 h-2" />
                </button>
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="text-red-500 text-sm m-1 text-center">{error}</p>
        )}

        <div>
          <h3 className="font-medium mb-2 text-gray-700">
            Join Existing Group
          </h3>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group ID"
            className="w-full mb-2 p-2 border border-gray-300 rounded"
          />
          <button
            onClick={handleJoin}
            className="w-full bg-blue-500 text-white font-bold py-2 rounded hover:bg-blue-600 transition-all cursor-pointer"
          >
            <span className="drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">
              Join Group
            </span>
          </button>
        </div>

        {/* Logout Button */}
        <div className="flex justify-center mt-4">
          <button
            onClick={() => {
              localStorage.removeItem("username");
              navigate("/");
            }}
            className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-full transition-all duration-200 hover:scale-110 hover:cursor-pointer border border-red"
            title="Logout"
          >
            <BsBoxArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupPage;
