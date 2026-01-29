import { useState } from "react";
import Gerente from "./Gerente";
import Equipa from "./Equipa";

/* ===== PINs ===== */
const PIN_EQUIPA = "0000";
const PIN_GERENTE = "1234";

export default function App() {
  const [pin, setPin] = useState("");
  const [perfil, setPerfil] = useState(null);

  function entrar() {
    if (pin === PIN_EQUIPA) setPerfil("equipa");
    else if (pin === PIN_GERENTE) setPerfil("gerente");
    else alert("PIN incorreto");
    setPin("");
  }

  function logout() {
    setPerfil(null);
    setPin("");
  }

  if (!perfil) {
    return (
      <div style={{ padding: 20 }}>
        <h2>🔐 PIN</h2>
        <input
          type="password"
          value={pin}
          onChange={e => setPin(e.target.value)}
        />
        <button onClick={entrar}>Entrar</button>
      </div>
    );
  }

  if (perfil === "gerente") {
    return <Gerente onLogout={logout} />;
  }

  if (perfil === "equipa") {
    return <Equipa onLogout={logout} />;
  }

  return null;
}
