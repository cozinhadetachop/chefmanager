import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./operacao.css";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then(registrations => Promise.all(registrations.map(registration => registration.unregister())))
    .catch(error => console.warn("Não foi possível limpar service workers antigos:", error));
}

if ("caches" in window) {
  caches.keys()
    .then(keys => Promise.all(keys.filter(key => key === "app-cache" || key.startsWith("app-cache-")).map(key => caches.delete(key))))
    .catch(error => console.warn("Não foi possível limpar caches antigos:", error));
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
