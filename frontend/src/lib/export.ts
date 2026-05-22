import { apiRequestBlob } from "@/lib/api";

export type ExportFormat = "csv" | "pdf";

/**
 * Save a Blob as a file using the standard "invisible anchor click" trick.
 * Works in all evergreen browsers; falls back to opening the blob in a new
 * tab if the anchor click is blocked (rare).
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Revoke after the click handler has had a chance to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

async function fetchAndDownload(
  path: string,
  fallbackFilename: string,
): Promise<void> {
  const res = await apiRequestBlob(path);
  if (!res.ok) {
    throw new Error(res.error ?? "Export failed");
  }
  downloadBlob(res.data.blob, res.data.filename ?? fallbackFilename);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function exportMood(format: ExportFormat): Promise<void> {
  await fetchAndDownload(
    `/api/v1/export/mood?format=${format}`,
    `mindease-mood-${today()}.${format}`,
  );
}

export async function exportChat(
  format: ExportFormat,
  conversationId?: string,
): Promise<void> {
  const qs = new URLSearchParams({ format });
  if (conversationId) qs.set("conversation_id", conversationId);
  const slug = conversationId ? `chat-${conversationId.slice(0, 8)}` : "chat";
  await fetchAndDownload(
    `/api/v1/export/chat?${qs.toString()}`,
    `mindease-${slug}-${today()}.${format}`,
  );
}

export async function exportAssessments(
  format: ExportFormat,
  userAssessmentId?: string,
): Promise<void> {
  const qs = new URLSearchParams({ format });
  if (userAssessmentId) qs.set("user_assessment_id", userAssessmentId);
  const slug = userAssessmentId
    ? `assessment-${userAssessmentId.slice(0, 8)}`
    : "assessments";
  await fetchAndDownload(
    `/api/v1/export/assessments?${qs.toString()}`,
    `mindease-${slug}-${today()}.${format}`,
  );
}

export async function exportAll(): Promise<void> {
  await fetchAndDownload(
    `/api/v1/export/all?format=pdf`,
    `mindease-export-${today()}.pdf`,
  );
}
