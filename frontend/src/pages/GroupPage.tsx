import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createGroup, joinGroup } from "../services/api";
import { BsBoxArrowRight } from "react-icons/bs";

const GroupPage: React.FC = () => {
  const [groupName, setGroupName] = useState("");
  const [expiry, setExpiry] = useState(60); // default expiry time in minutes
  const [error, setError] = useState("");
  const navigate = useNavigate();

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
        sessionStorage.setItem('justJoinedGroup', 'true');
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
        sessionStorage.setItem('justJoinedGroup', 'true');
        // redirect to the group chat room
        navigate(`/group/${response.data.groupName}`);
      } else {
        setError("Failed to join group. Please check the Group ID.");
      }
    } catch (err) {
      setError("An error occurred while joining the group.");
    }
  };

  return (
    <div className="min-h-screen bg-blue-50 dark:bg-gray-900 flex flex-col items-center justify-center px-4 py-6">
      <div className="bg-white rounded-xl shadow-md p-6 w-full max-w-sm">
        <h2 className="text-2xl font-semibold text-blue-600 mb-4 text-center">
          Welcome, {username} 👋
        </h2>

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
            className="w-full bg-green-500 text-white py-2 rounded hover:bg-green-600 transition-all"
          >
            Create Group
          </button>
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
            className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 transition-all"
          >
            Join Group
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
