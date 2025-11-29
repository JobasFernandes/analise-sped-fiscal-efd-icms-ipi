import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { ThemeProvider } from "./contexts/ThemeProvider.jsx";
import { FilterProvider } from "./contexts/FilterContext.jsx";
import ToastProvider from "./components/ui/toast";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system">
      <FilterProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </FilterProvider>
    </ThemeProvider>
  </React.StrictMode>
);
