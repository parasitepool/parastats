"use client";

import { useEffect, useState } from "react";
import NotificationDetails from "../components/block-template/NotificationDetails";
import type { StratumNotification } from "../api/stratum/route";

export default function BlockTemplatePage() {
  const [notification, setNotification] = useState<StratumNotification | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "error"
  >("connecting");

  useEffect(() => {
    async function fetchStratumData() {
      try {
        const response = await fetch("/api/stratum");
        if (!response.ok) {
          throw new Error("Failed to fetch stratum data");
        }
        const data = await response.json();

        if (data.length > 0) {
          setNotification(data[0]); // Get the most recent notification
          setConnectionStatus("connected");
          setError(null);
        } else {
          setNotification(null);
          setError("No real stratum data available yet");
          setConnectionStatus("connecting"); // Show as connecting since we're waiting for real data
        }
      } catch (error) {
        console.error("Error fetching stratum data:", error);
        setError(error instanceof Error ? error.message : "Unknown error");
        setConnectionStatus("error");
      } finally {
        setLoading(false);
      }
    }

    fetchStratumData();

    // Set up interval to refresh data every 5 seconds for real-time updates
    const intervalId = setInterval(fetchStratumData, 5000);

    // Clean up the interval when component unmounts
    return () => clearInterval(intervalId);
  }, []);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case "connected":
        return "text-green-400";
      case "connecting":
        return "text-yellow-400";
      case "error":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting...";
      case "error":
        return "Connection Error";
      default:
        return "Unknown";
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center p-8">
        <div className="w-full max-w-7xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Block Template</h1>
            <p className="text-accent-2 mb-4">
              Waiting for Stratum V1 messages for pool: Parasite...
            </p>
          </div>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-3"></div>
            <span className="ml-2 text-accent-2">Loading stratum data...</span>
          </div>
        </div>
      </main>
    );
  }

  if (error && !notification) {
    return (
      <main className="flex min-h-screen flex-col items-center p-8">
        <div className="w-full max-w-7xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Block Template</h1>
            <p className="text-accent-2 mb-4">
              Waiting for Stratum V1 messages for pool: Parasite...
            </p>
          </div>
          <div className="text-center py-12">
            <p className="text-red-400 text-lg mb-2">{error}</p>
            <p className="text-sm text-accent-3">
              No mining.notify messages received yet
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <div className="w-full max-w-7xl">
        <div className="mb-4">
          <div className="flex items-center gap-4 mb-4">
            <h1 className="text-3xl font-bold mb-2">Possible Next Block Template</h1>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  connectionStatus === "connected"
                    ? "bg-green-400"
                    : connectionStatus === "connecting"
                    ? "bg-yellow-400 animate-pulse"
                    : "bg-red-400"
                }`}
              ></div>
              <span className={`text-sm ${getStatusColor()}`}>
                {getStatusText()}
              </span>
            </div>
          </div>
          {error && notification && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-3 mb-4">
              <p className="text-yellow-400 text-sm">Warning: {error}</p>
            </div>
          )}
        </div>

        {notification ? (
          <NotificationDetails
            notification={notification}
            onClose={() => {}} // No close button needed since this is the main view
            showCloseButton={false}
          />
        ) : (
          <div className="text-center py-12">
            <div className="mb-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-3 mx-auto mb-4"></div>
              <p className="text-accent-2 text-lg">
                Waiting for real Stratum V1 messages...
              </p>
              <p className="text-sm text-accent-3 mt-2">
                Connected to parasite.wtf:42069 but no mining.notify messages
                received yet
              </p>
              <p className="text-xs text-accent-3 mt-2">
                This is normal - block templates are only sent when new blocks
                are found
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
