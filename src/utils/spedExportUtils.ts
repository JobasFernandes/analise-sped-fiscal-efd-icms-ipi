let generateAddedDocumentLines: any = null;

async function loadSpedLineGenerator() {
  if (!generateAddedDocumentLines) {
    const module = await import("./spedLineGenerator");
    generateAddedDocumentLines = module.generateAddedDocumentLines;
  }
  return generateAddedDocumentLines;
}

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

function isC100Saida(line: string): boolean {
  const parts = line.split("|");
  if (parts.length >= 3) {
    return parts[2] === "1";
  }
  return false;
}

function isC100NFCe(line: string): boolean {
  const parts = line.split("|");
  if (parts.length >= 6) {
    return parts[5] === "65";
  }
  return false;
}

function clearC100NFCeFields(line: string): string {
  const parts = line.split("|");
  const indicesToClear = [
    4, // COD_PART
    23, // VL_BC_ICMS_ST
    24, // VL_ICMS_ST
    25, // VL_IPI
    26, // VL_PIS
    27, // VL_COFINS
    28, // VL_PIS_ST
    29, // VL_COFINS_ST
  ];

  let changed = false;
  for (const idx of indicesToClear) {
    if (parts.length > idx && parts[idx] !== "") {
      parts[idx] = "";
      changed = true;
    }
  }

  return changed ? parts.join("|") : line;
}

function collectReferences(lines: string[]): {
  participants: Set<string>;
  products: Set<string>;
  units: Set<string>;
} {
  const participants = new Set<string>();
  const products = new Set<string>();
  const units = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parts = trimmed.split("|");
    const reg = parts[1];

    if (reg === "C100" && parts[4]) {
      participants.add(parts[4]);
    }

    if (reg === "C170" && parts.length >= 7) {
      if (parts[3]) products.add(parts[3]);
      if (parts[6]) units.add(parts[6]);
    }

    if (reg === "C110" && parts[4]) {
      participants.add(parts[4]);
    }

    if (reg === "1300" && parts.length >= 3) {
      if (parts[2]) products.add(parts[2]);
    }
    if (reg === "1310" && parts.length >= 3) {
      if (parts[3]) participants.add(parts[3]);
    }
    if (reg === "1320" && parts.length >= 3) {
      if (parts[3]) participants.add(parts[3]);
    }
    if (reg === "1601" && parts.length >= 3) {
      if (parts[2]) participants.add(parts[2]);
    }
  }

  return { participants, products, units };
}

/**
 * @param contentBlob
 * @param removeC170
 * @param spedId
 * @returns
 */
export const filterSpedContent = async (
  contentBlob: Blob,
  removeC170: boolean,
  spedId?: number
): Promise<Blob> => {
  const text = await readFileAsText(contentBlob, "iso-8859-1");
  const lines = text.split(/\r?\n/);

  let addedLines: string[] = [];
  let addedCounts = { C100: 0, C170: 0, C190: 0 };

  if (spedId) {
    const includeC170InAdded = !removeC170;
    const generateFn = await loadSpedLineGenerator();
    const result = await generateFn(spedId, includeC170InAdded);
    addedLines = result.lines;
    addedCounts = result.counts;
  }

  if (removeC170 && addedLines.length > 0) {
    addedLines = addedLines.map((line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("|C100|")) return line;
      if (isC100Saida(trimmed) && isC100NFCe(trimmed)) {
        return clearC100NFCeFields(line);
      }
      return line;
    });
  }

  const removedCounts: Record<string, number> = {
    C170: 0,
    "0150": 0,
    "0190": 0,
    "0200": 0,
    "0205": 0,
    "0206": 0,
  };
  C170_CHILD_REGISTERS.forEach((reg) => (removedCounts[reg] = 0));

  let inSaidaDocument = false;
  let inNFCeDocument = false;

  const firstPassLines = lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith("|C100|")) {
        inSaidaDocument = isC100Saida(trimmed);
        inNFCeDocument = isC100NFCe(trimmed);

        if (removeC170 && inSaidaDocument && inNFCeDocument) {
          return clearC100NFCeFields(line);
        }
        return line;
      }

      if (removeC170 && inSaidaDocument) {
        if (trimmed.startsWith("|C170|")) {
          removedCounts["C170"]++;
          return null;
        }

        for (const childReg of C170_CHILD_REGISTERS) {
          if (trimmed.startsWith(`|${childReg}|`)) {
            removedCounts[childReg]++;
            return null;
          }
        }
      }

      return line;
    })
    .filter((line) => line !== null) as string[];

  let secondPassLines = firstPassLines;

  if (removeC170) {
    const refs = collectReferences(firstPassLines);

    for (const addedLine of addedLines) {
      const trimmed = addedLine.trim();
      const parts = trimmed.split("|");
      const reg = parts[1];

      if (reg === "C100" && parts[4]) {
        refs.participants.add(parts[4]);
      }
      if (reg === "C170" && parts.length >= 7) {
        if (parts[3]) refs.products.add(parts[3]);
        if (parts[6]) refs.units.add(parts[6]);
      }
    }

    let currentProduct = "";
    let keepCurrentProduct = false;

    secondPassLines = firstPassLines.filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;

      const parts = trimmed.split("|");
      const reg = parts[1];

      if (reg === "0150") {
        const codPart = parts[2];
        if (!refs.participants.has(codPart)) {
          removedCounts["0150"]++;
          return false;
        }
      }

      if (reg === "0190") {
        const unid = parts[2];
        if (!refs.units.has(unid)) {
          removedCounts["0190"]++;
          return false;
        }
      }

      if (reg === "0200") {
        currentProduct = parts[2];
        keepCurrentProduct = refs.products.has(currentProduct);
        if (!keepCurrentProduct) {
          removedCounts["0200"]++;
          return false;
        }
      }

      if (reg === "0205" || reg === "0206") {
        if (!keepCurrentProduct) {
          removedCounts[reg]++;
          return false;
        }
      }

      return true;
    });
  }

  const totalRemovedFromBlockC =
    removedCounts["C170"] +
    C170_CHILD_REGISTERS.reduce((sum, reg) => sum + (removedCounts[reg] || 0), 0);

  const totalRemovedFromBlock0 =
    (removedCounts["0150"] || 0) +
    (removedCounts["0190"] || 0) +
    (removedCounts["0200"] || 0) +
    (removedCounts["0205"] || 0) +
    (removedCounts["0206"] || 0);

  const totalAddedToBlockC = addedCounts.C100 + addedCounts.C170 + addedCounts.C190;
  const netChangeBlockC = totalAddedToBlockC - totalRemovedFromBlockC;
  const netChangeBlock0 = -totalRemovedFromBlock0;

  if (netChangeBlockC === 0 && netChangeBlock0 === 0 && addedLines.length === 0) {
    return contentBlob;
  }

  const c990Index = secondPassLines.findIndex((line) =>
    line.trim().startsWith("|C990|")
  );

  let resultLines: string[];
  if (c990Index >= 0 && addedLines.length > 0) {
    resultLines = [
      ...secondPassLines.slice(0, c990Index),
      ...addedLines,
      ...secondPassLines.slice(c990Index),
    ];
  } else {
    resultLines = secondPassLines;
  }

  const updatedLines = updateCountersWithAdditions(
    resultLines,
    removedCounts,
    addedCounts,
    netChangeBlockC,
    netChangeBlock0
  );

  const filteredText = updatedLines.join("\r\n");
  return stringToIso88591Blob(filteredText);
};

function updateCountersWithAdditions(
  lines: string[],
  removedCounts: Record<string, number>,
  addedCounts: { C100: number; C170: number; C190: number },
  netChangeBlockC: number,
  netChangeBlock0: number = 0
): string[] {
  let lines9900Changed = 0;

  const existing9900Types = new Set<string>();
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("|9900|")) {
      const parts = trimmed.split("|");
      if (parts.length >= 4) {
        existing9900Types.add(parts[2]);
      }
    }
  });

  const result = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    if (trimmed.startsWith("|0990|")) {
      const parts = trimmed.split("|");
      if (parts.length >= 3) {
        const currentCount = parseInt(parts[2], 10) || 0;
        const newCount = Math.max(0, currentCount + netChangeBlock0);
        return `|0990|${newCount}|`;
      }
    }

    if (trimmed.startsWith("|C990|")) {
      const parts = trimmed.split("|");
      if (parts.length >= 3) {
        const currentCount = parseInt(parts[2], 10) || 0;
        const newCount = Math.max(0, currentCount + netChangeBlockC);
        return `|C990|${newCount}|`;
      }
    }

    if (trimmed.startsWith("|9900|")) {
      const parts = trimmed.split("|");
      if (parts.length >= 4) {
        const regType = parts[2];
        const currentCount = parseInt(parts[3], 10) || 0;
        let delta = 0;

        if (removedCounts[regType] !== undefined) {
          delta -= removedCounts[regType];
        }
        if (regType === "C100") {
          delta += addedCounts.C100;
        } else if (regType === "C170") {
          delta += addedCounts.C170;
        } else if (regType === "C190") {
          delta += addedCounts.C190;
        }

        if (delta !== 0) {
          const newCount = currentCount + delta;
          if (newCount <= 0) {
            lines9900Changed--;
            return null;
          }
          return `|9900|${regType}|${newCount}|`;
        }
      }
    }

    return line;
  });

  let filteredResult = result.filter((line) => line !== null) as string[];

  const new9900Lines: string[] = [];
  if (addedCounts.C100 > 0 && !existing9900Types.has("C100")) {
    new9900Lines.push(`|9900|C100|${addedCounts.C100}|`);
    lines9900Changed++;
  }
  if (addedCounts.C170 > 0 && !existing9900Types.has("C170")) {
    new9900Lines.push(`|9900|C170|${addedCounts.C170}|`);
    lines9900Changed++;
  }
  if (addedCounts.C190 > 0 && !existing9900Types.has("C190")) {
    new9900Lines.push(`|9900|C190|${addedCounts.C190}|`);
    lines9900Changed++;
  }

  if (new9900Lines.length > 0) {
    const idx9990 = filteredResult.findIndex((line) =>
      line.trim().startsWith("|9990|")
    );
    if (idx9990 >= 0) {
      filteredResult = [
        ...filteredResult.slice(0, idx9990),
        ...new9900Lines,
        ...filteredResult.slice(idx9990),
      ];
    }
  }

  return filteredResult.map((line) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("|9900|9900|")) {
      const parts = trimmed.split("|");
      if (parts.length >= 4) {
        const currentCount = parseInt(parts[3], 10) || 0;
        const newCount = Math.max(0, currentCount + lines9900Changed);
        return `|9900|9900|${newCount}|`;
      }
    }

    if (trimmed.startsWith("|9990|")) {
      const parts = trimmed.split("|");
      if (parts.length >= 3) {
        const currentCount = parseInt(parts[2], 10) || 0;
        const newCount = Math.max(0, currentCount + lines9900Changed);
        return `|9990|${newCount}|`;
      }
    }

    if (trimmed.startsWith("|9999|")) {
      const parts = trimmed.split("|");
      if (parts.length >= 3) {
        const currentCount = parseInt(parts[2], 10) || 0;
        const totalChange = netChangeBlockC + netChangeBlock0 + lines9900Changed;
        const newCount = Math.max(0, currentCount + totalChange);
        return `|9999|${newCount}|`;
      }
    }

    return line;
  });
}
