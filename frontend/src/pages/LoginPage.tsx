import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { heartbeatSession, loginUser } from "../services/api";

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const savedUsername = localStorage.getItem("username");
    const sessionId = localStorage.getItem("sessionId");
    if (!sessionId) {
      localStorage.removeItem("username");
      return;
    }
    if (!savedUsername) return;

    void heartbeatSession()
      .then(() => navigate("/group"))
      .catch(() => {
        localStorage.removeItem("username");
      });
  }, [navigate]);

  const handleLogin = async () => {
    if (isLoggingIn) return;

    // if username is empty
    if (!username.trim() || !password) {
      setError("Enter both a username and password.");
      return;
    }

    setIsLoggingIn(true);
    setError("");
    try {
      // call the loginUser function from api service
      const response = await loginUser(username, password);
      if (response.status === 200) {
        // save username in localStorage
        localStorage.setItem("username", response.data.username);
        localStorage.setItem("sessionId", response.data.sessionId);
        // redirect to group page
        navigate("/group");
      } else {
        setError("Failed to login. Please try again.");
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const responseMessage = err.response?.data?.error;
        if (typeof responseMessage === "string") {
          setError(responseMessage);
        } else if (err.response?.status === 401) {
          setError("Incorrect password.");
        } else if (err.response?.status === 409) {
          setError("This username is already active on another device.");
        } else {
          setError("An error occurred. Please try again.");
        }
      } else {
        setError("An error occurred. Please try again.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="w-full max-w-md bg-white rounded-lg shadow dark:border dark:bg-gray-800 dark:border-gray-700 p-6 space-y-4 md:space-y-6 sm:p-8">
        <div className="text-center">
          <div className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
            Cheap Chats 🤌
          </div>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
            New username? Your account will be created automatically.
          </p>
        </div>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5 dark:bg-gray-700 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          placeholder="what others call you 🫦"
          autoComplete="username"
          maxLength={10}
          required
          autoFocus
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-gray-900 focus:border-primary-600 focus:ring-primary-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
          placeholder="Password 🔑"
          autoComplete="current-password"
          required
        />
        {error && (
          <p className="text-red-500 text-sm mb-3 text-center">{error}</p>
        )}
        <button
          type="submit"
          className="w-full rounded-lg bg-green-600 px-5 py-2.5 text-center text-sm font-bold text-white hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-primary-300 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-primary-800"
          onClick={handleLogin}
          disabled={isLoggingIn}
        >
          {isLoggingIn ? (
            <span className="inline-flex items-center justify-center gap-2">
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                aria-hidden="true"
              />
              Pushing you in...
            </span>
          ) : (
            "Get In!"
          )}
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
