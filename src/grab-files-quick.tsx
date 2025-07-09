import {
  showToast,
  Toast,
  getSelectedFinderItems,
  LocalStorage,
} from "@raycast/api";
import * as fs from "fs";
import * as path from "path";

interface GrabbedFile {
  path: string;
  name: string;
  size: number;
  dateModified: Date;
}

export default async function Command() {
  try {
    const selectedItems = await getSelectedFinderItems();
    const newFiles: GrabbedFile[] = [];

    for (const item of selectedItems) {
      // Check if it's a file (not a folder)
      try {
        const stats = fs.statSync(item.path);
        if (stats.isFile()) {
          newFiles.push({
            path: item.path,
            name: path.basename(item.path),
            size: stats.size,
            dateModified: stats.mtime,
          });
        }
      } catch {
        // Skip files that can't be accessed
        continue;
      }
    }

    if (newFiles.length === 0) {
      await showToast({
        style: Toast.Style.Failure,
        title: "No files selected",
        message: "Please select files in Finder first",
      });
      return;
    }

    // Load existing grabbed files
    let existingFiles: GrabbedFile[] = [];
    try {
      const stored = await LocalStorage.getItem<string>("grabbedFiles");
      if (stored) {
        existingFiles = JSON.parse(stored).map((file: { path: string; name: string; size: number; dateModified: string }) => ({
          ...file,
          dateModified: new Date(file.dateModified),
        }));
      }
    } catch (error) {
      console.error("Error loading existing files:", error);
    }

    // Filter out duplicates
    const existingPaths = new Set(existingFiles.map(f => f.path));
    const uniqueNewFiles = newFiles.filter(f => !existingPaths.has(f.path));
    
    if (uniqueNewFiles.length === 0) {
      await showToast({
        style: Toast.Style.Success,
        title: "Files already grabbed",
        message: "All selected files are already in your grabbed files list",
      });
      return;
    }

    // Save updated files
    const updatedFiles = [...existingFiles, ...uniqueNewFiles];
    await LocalStorage.setItem("grabbedFiles", JSON.stringify(updatedFiles));

    await showToast({
      style: Toast.Style.Success,
      title: `Grabbed ${uniqueNewFiles.length} file${uniqueNewFiles.length === 1 ? "" : "s"}`,
      message: `Total: ${updatedFiles.length} grabbed files`,
    });

  } catch (error) {
    console.error("Error grabbing files:", error);
    await showToast({
      style: Toast.Style.Failure,
      title: "Error grabbing files",
      message: "Please make sure files are selected in Finder",
    });
  }
} 