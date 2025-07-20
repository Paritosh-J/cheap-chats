import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../services/api";

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const savedUsername = localStorage.getItem("username");
    // check if username already saved in localStorage
    if (savedUsername) {
      // redirect to the group page
      navigate("/group");
    }
  }, [navigate]);

  const handleLogin = async () => {
    // if username is empty
    if (!username.trim()) {
      setError("Username cannot be empty");
      return;
    }

    try {
      // call the loginUser function from api service
      const response = await loginUser(username);
      if (response.status === 200) {
        // save username in localStorage
        localStorage.setItem("username", username);
        // redirect to group page
        navigate("/group");
      } else {
        setError("Failed to login. Please try again.");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="w-full max-w-md bg-white rounded-lg shadow dark:border dark:bg-gray-800 dark:border-gray-700 p-6 space-y-4 md:space-y-6 sm:p-8">
        <div className="text-center">
          <div className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
            Cheap Chats 🤌
          </div>
        </div>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5 dark:bg-gray-700 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          placeholder="what others call you 🫦"
          required
          autoFocus
        />
        {error && <p className="text-red-500 text-sm mb-3 text-center">{error}</p>}
        <button
          type="submit"
          className="w-full text-xl text-white bg-green-600 hover:bg-green-700 focus:ring-4 focus:outline-none focus:ring-primary-300 font-bold rounded-lg text-sm px-5 py-2.5 text-center dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-primary-800"
          onClick={handleLogin}
        >
          Get In!
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
