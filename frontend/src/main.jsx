import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { registerSW } from "./pwa/registerSW.js";
import "./index.css";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Renders children as-is when no Google Client ID is configured, so the app
// still runs locally without Google sign-in wired up.
function MaybeGoogleProvider({ children }) {
  if (!googleClientId || googleClientId === "your_google_oauth_client_id") return children;
  return <GoogleOAuthProvider clientId={googleClientId}>{children}</GoogleOAuthProvider>;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <MaybeGoogleProvider>
            <App />
          </MaybeGoogleProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Turns the site into an installable, offline-capable app.
registerSW();
