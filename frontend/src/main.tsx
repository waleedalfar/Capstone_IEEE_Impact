import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/roboto/500.css";
import "./design/tokens.css";
import { applyTheme, getThemePreference } from "./lib/theme";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";

applyTheme(getThemePreference());

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
