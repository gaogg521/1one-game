/** 从「类 DataTransfer」剪贴板数据中解析 image/*（{@link DataTransfer} / 浏览器 clipboardData 均具备 files/items） */
export function extractImageFilesFromClipboardData(
  dt: Pick<DataTransfer, "files" | "items"> | null,
): File[] {
  if (!dt) return [];
  const picked: File[] = [];
  const fl = dt.files;
  if (fl?.length) {
    for (let i = 0; i < fl.length; i += 1) {
      const f = fl.item(i);
      if (f?.type.startsWith("image/")) picked.push(f);
    }
  }
  if (picked.length > 0) return picked;

  const list = dt.items;
  if (!list?.length) return [];
  for (let i = 0; i < list.length; i += 1) {
    const it = list[i];
    if (!it || it.kind !== "file") continue;
    const f = it.getAsFile();
    if (f?.type.startsWith("image/")) picked.push(f);
  }
  return picked;
}
