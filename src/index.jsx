import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./operacao.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js")
      .catch(error => console.warn("Não foi possível ativar o modo offline:", error));
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
