import * as XLSX from "xlsx";

export function exportToExcel(data: Record<string, unknown>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");

  const colWidths = Object.keys(data[0] || {}).map((key) => ({
    wch: Math.max(
      key.length,
      ...data.map((row) => String(row[key] ?? "").length)
    ),
  }));
  ws["!cols"] = colWidths;

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToCSV(data: Record<string, unknown>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
