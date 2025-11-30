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

export const filterSpedContent = async (
  contentBlob: Blob,
  removeC170: boolean
): Promise<Blob> => {
  if (!removeC170) {
    return contentBlob;
  }

  const text = await readFileAsText(contentBlob, "iso-8859-1");
  const lines = text.split(/\r?\n/);
  const filteredLines = lines.filter((line) => !line.startsWith("|C170|"));
  const filteredText = filteredLines.join("\r\n");

  return stringToIso88591Blob(filteredText);
};
