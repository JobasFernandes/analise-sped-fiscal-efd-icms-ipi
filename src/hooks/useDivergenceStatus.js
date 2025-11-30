import { useState, useEffect } from "react";
import { db } from "../db";

export function useDivergenceStatus(accessKey) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessKey) {
      setLoading(false);
      return;
    }

    const loadStatus = async () => {
      try {
        const record = await db.divergences.where({ accessKey }).first();
        setStatus(record || null);
      } catch (error) {
        console.error("Failed to load divergence status", error);
      } finally {
        setLoading(false);
      }
    };

    loadStatus();
  }, [accessKey]);

  const updateStatus = async (newStatus, comment = "") => {
    try {
      const existing = await db.divergences.where({ accessKey }).first();
      const now = new Date().toISOString();

      if (existing) {
        await db.divergences.update(existing.id, {
          status: newStatus,
          comment,
          updatedAt: now,
        });
      } else {
        await db.divergences.add({
          accessKey,
          type: "SPED_XML_CFOP",
          status: newStatus,
          comment,
          updatedAt: now,
        });
      }

      const updated = await db.divergences.where({ accessKey }).first();
      setStatus(updated);
    } catch (error) {
      console.error("Failed to update divergence status", error);
      throw error;
    }
  };

  return { status, loading, updateStatus };
}
