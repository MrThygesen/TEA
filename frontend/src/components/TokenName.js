import React, { useEffect, useState } from "react";
import { useTeaContracts } from "../hooks/useTeaContracts";

export default function TokenName() {
  const contracts = useTeaContracts();
  const [name, setName] = useState("");

  useEffect(() => {
    async function fetchName() {
      try {
        if (contracts.teaToken) {
          const tokenName = await contracts.teaToken.name();
          setName(tokenName);
        }
      } catch (error) {
        console.error("Failed to read token name:", error);
        setName("Error");
      }
    }

    fetchName();
  }, [contracts]);

  return <div><strong>TEA Token Name:</strong> {name}</div>;
}

