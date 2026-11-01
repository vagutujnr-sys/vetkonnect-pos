import fs from "fs";
import path from "path";

export const dataRoot = path.join(process.cwd(), "data");

export function ensureDataDirs() {
  for (const dir of [
    dataRoot,
    path.join(dataRoot, "images", "patients"),
    path.join(dataRoot, "documents"),
    path.join(dataRoot, "audio"),
    path.join(dataRoot, "backups"),
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function patientImagePath(patientId: string, ext = "jpg") {
  return path.join(dataRoot, "images", "patients", `${patientId}.${ext}`);
}
