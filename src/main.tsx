import React from "react";
import { createRoot } from "react-dom/client";
import { StoreProvider } from "./store";
import { LangProvider } from "./i18n";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LangProvider>
      <StoreProvider>
        <App />
      </StoreProvider>
    </LangProvider>
  </React.StrictMode>
);
