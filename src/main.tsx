import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { DownloadPage } from "./pages/DownloadPage";
import "./styles.css";

// Tiny location-based router. CF Pages serves index.html for unknown paths
// so this works without any server-side route config.
const Root = window.location.pathname === "/download" ? DownloadPage : App;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
