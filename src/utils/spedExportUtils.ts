export const readFileAsText = (blob: Blob, encoding: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsText(blob, encoding);
  });
};

export const stringToIso88591Blob = (str: string): Blob => {
  const buf = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    buf[i] = code < 256 ? code : 63;
  }
  return new Blob([buf], { type: "text/plain;charset=iso-8859-1" });
};

const C170_CHILD_REGISTERS = [
  "C171",
  "C172",
  "C173",
  "C174",
  "C175",
  "C176",
  "C177",
  "C178",
  "C179",
];

export const filterSpedContent = async (
  contentBlob: Blob,
  removeC170: boolean
): Promise<Blob> => {
  if (!removeC170) {
    return contentBlob;
  }

  const text = await readFileAsText(contentBlob, "iso-8859-1");
  const lines = text.split(/\r?\n/);

  const removedCounts: Record<string, number> = {
    C170: 0,
  };
  C170_CHILD_REGISTERS.forEach((reg) => (removedCounts[reg] = 0));

  const filteredLines = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;

    if (trimmed.startsWith("|C170|")) {
      removedCounts["C170"]++;
      return false;
    }

    for (const childReg of C170_CHILD_REGISTERS) {
      if (trimmed.startsWith(`|${childReg}|`)) {
        removedCounts[childReg]++;
        return false;
      }
    }

    return true;
  });

  const totalRemovedFromBlockC = Object.values(removedCounts).reduce(
    (sum, count) => sum + count,
    0
  );

  if (totalRemovedFromBlockC === 0) {
    return contentBlob;
  }

  const updatedLines = updateCounters(
    filteredLines,
    removedCounts,
    totalRemovedFromBlockC
  );

  const filteredText = updatedLines.join("\r\n");
  return stringToIso88591Blob(filteredText);
};

function updateCounters(
  lines: string[],
  removedCounts: Record<string, number>,
  totalRemovedFromBlockC: number
): string[] {
  let lines9900Removed = 0;

  const result = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    if (trimmed.startsWith("|C990|")) {
      const parts = trimmed.split("|");
      if (parts.length >= 3) {
        const currentCount = parseInt(parts[2], 10) || 0;
        const newCount = Math.max(0, currentCount - totalRemovedFromBlockC);
        return `|C990|${newCount}|`;
      }
    }

    if (trimmed.startsWith("|9900|")) {
      const parts = trimmed.split("|");
      if (parts.length >= 4) {
        const regType = parts[2];
        if (removedCounts[regType] !== undefined) {
          const currentCount = parseInt(parts[3], 10) || 0;
          const newCount = currentCount - removedCounts[regType];
          if (newCount <= 0) {
            lines9900Removed++;
            return null;
          }
          return `|9900|${regType}|${newCount}|`;
        }
      }
    }

    return line;
  });

  const filteredResult = result.filter((line) => line !== null) as string[];

  return filteredResult.map((line) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("|9990|")) {
      const parts = trimmed.split("|");
      if (parts.length >= 3) {
        const currentCount = parseInt(parts[2], 10) || 0;
        const newCount = Math.max(0, currentCount - lines9900Removed);
        return `|9990|${newCount}|`;
      }
    }

    if (trimmed.startsWith("|9999|")) {
      const parts = trimmed.split("|");
      if (parts.length >= 3) {
        const currentCount = parseInt(parts[2], 10) || 0;
        const totalRemoved = totalRemovedFromBlockC + lines9900Removed;
        const newCount = Math.max(0, currentCount - totalRemoved);
        return `|9999|${newCount}|`;
      }
    }

    return line;
  });
}
