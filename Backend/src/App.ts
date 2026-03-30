import { useState } from "react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function App() {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const startJarvis = async () => {
    setLoading(true);
    setStatus("");

    try {
      const res = await fetch(`${BACKEND_URL}/api/session/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();
      setStatus(data.message || "JARVIS started successfully");
    } catch (error: any) {
      console.error(error);
      setStatus("❌ Failed to start session");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Arial",
      }}
    >
      <h1>Garuda AI Assistant</h1>

      <button
        onClick={startJarvis}
        disabled={loading}
        style={{
          padding: "12px 20px",
          fontSize: "16px",
          cursor: "pointer",
          borderRadius: "8px",
          border: "none",
          backgroundColor: "#007bff",
          color: "white",
        }}
      >
        {loading ? "Starting..." : "Activate JARVIS"}
      </button>

      {status && (
        <p style={{ marginTop: "20px", fontSize: "16px" }}>{status}</p>
      )}
    </div>
  );
}