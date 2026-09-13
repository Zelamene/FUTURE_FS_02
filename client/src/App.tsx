import { useEffect, useState } from "react";

export default function App() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch((e) => setHealth({ error: e.message }));
  }, []);

  return <pre>{JSON.stringify(health, null, 2)}</pre>;
}