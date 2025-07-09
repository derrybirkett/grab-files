import {
  ActionPanel,
  Action,
  List,
  showToast,
  Toast,
  getPreferenceValues,
  LocalStorage,
  open,
  getSelectedFinderItems,
  showHUD,
  getApplications,
  closeMainWindow,
  popToRoot,
} from "@raycast/api";
import { useState, useEffect } from "react";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

interface GrabbedFile {
  path: string;
  name: string;
  size: number;
  dateModified: Date;
}

interface Preferences {
  defaultDestination?: string;
}

interface FolderItem {
  path: string;
  name: string;
  isDirectory: boolean;
  depth: number;
}

export default function Command() {
  const [grabbedFiles, setGrabbedFiles] = useState<GrabbedFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [isFolderSearchMode, setIsFolderSearchMode] = useState(false);
  const [isCopyMode, setIsCopyMode] = useState(false);
  const [folderSearchResults, setFolderSearchResults] = useState<FolderItem[]>([]);
  const [isFolderSearchLoading, setIsFolderSearchLoading] = useState(false);
  const preferences = getPreferenceValues<Preferences>();

  // Load grabbed files from storage and check for new files from Finder on component mount
  useEffect(() => {
    loadGrabbedFiles();
    // Automatically try to grab files from Finder when the extension opens
    autoGrabFilesFromFinder();
  }, []);

  // Auto-grab files when the component mounts (after loading existing files)
  useEffect(() => {
    if (!isLoading) {
      autoGrabFilesFromFinder();
    }
  }, [isLoading]);

  // Handle folder search when in folder search mode
  useEffect(() => {
    if (isFolderSearchMode && searchText) {
      searchFolders(searchText);
    } else if (isFolderSearchMode) {
      // Show common directories when no search text
      setFolderSearchResults(getCommonDirectories());
    }
  }, [searchText, isFolderSearchMode]);

  const getCommonDirectories = (): FolderItem[] => {
    const homeDir = os.homedir();
    const commonDirs = [
      { name: "Desktop", path: path.join(homeDir, "Desktop") },
      { name: "Documents", path: path.join(homeDir, "Documents") },
      { name: "Downloads", path: path.join(homeDir, "Downloads") },
      { name: "Pictures", path: path.join(homeDir, "Pictures") },
      { name: "Music", path: path.join(homeDir, "Music") },
      { name: "Movies", path: path.join(homeDir, "Movies") },
      { name: "Applications", path: "/Applications" },
      { name: "Home", path: homeDir },
    ];

    return commonDirs
      .filter(dir => fs.existsSync(dir.path))
      .map(dir => ({
        path: dir.path,
        name: dir.name,
        isDirectory: true,
        depth: 0,
      }));
  };

  const searchFolders = async (query: string) => {
    setIsFolderSearchLoading(true);
    try {
      const results: FolderItem[] = [];
      const homeDir = os.homedir();
      
      // Search in common locations
      const searchPaths = [
        homeDir,
        "/Applications",
        "/Users",
      ];

      for (const searchPath of searchPaths) {
        if (fs.existsSync(searchPath)) {
          await searchDirectory(searchPath, query.toLowerCase(), results, 0);
        }
      }

      // Sort results by relevance (exact matches first, then partial matches)
      results.sort((a, b) => {
        const aExact = a.name.toLowerCase() === query.toLowerCase();
        const bExact = b.name.toLowerCase() === query.toLowerCase();
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return a.name.localeCompare(b.name);
      });

      // Limit results to avoid performance issues
      setFolderSearchResults(results.slice(0, 50));
    } catch (error) {
      console.error("Error searching folders:", error);
      setFolderSearchResults([]);
    } finally {
      setIsFolderSearchLoading(false);
    }
  };

  const searchDirectory = async (
    dirPath: string, 
    query: string, 
    results: FolderItem[], 
    depth: number,
    maxDepth: number = 3
  ) => {
    if (depth > maxDepth || results.length >= 50) return;

    try {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        if (results.length >= 50) break;
        
        const itemPath = path.join(dirPath, item);
        
        try {
          const stats = fs.statSync(itemPath);
          
          if (stats.isDirectory()) {
            // Check if directory name matches query
            if (item.toLowerCase().includes(query)) {
              results.push({
                path: itemPath,
                name: item,
                isDirectory: true,
                depth,
              });
            }
            
            // Recursively search subdirectories
            if (depth < maxDepth) {
              await searchDirectory(itemPath, query, results, depth + 1, maxDepth);
            }
          }
        } catch {
          // Skip inaccessible directories
          continue;
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  };

  const loadGrabbedFiles = async () => {
    try {
      const stored = await LocalStorage.getItem<string>("grabbedFiles");
      if (stored) {
        const files = JSON.parse(stored).map((file: any) => ({
          ...file,
          dateModified: new Date(file.dateModified),
        }));
        setGrabbedFiles(files);
      }
    } catch (error) {
      console.error("Error loading grabbed files:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const autoGrabFilesFromFinder = async () => {
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

      if (newFiles.length > 0) {
        // Filter out duplicates
        const existingPaths = new Set(grabbedFiles.map(f => f.path));
        const uniqueNewFiles = newFiles.filter(f => !existingPaths.has(f.path));
        
        if (uniqueNewFiles.length > 0) {
          const updatedFiles = [...grabbedFiles, ...uniqueNewFiles];
          setGrabbedFiles(updatedFiles);
          await saveGrabbedFiles(updatedFiles);

          await showToast({
            style: Toast.Style.Success,
            title: `Grabbed ${uniqueNewFiles.length} file${uniqueNewFiles.length === 1 ? "" : "s"}`,
            message: `Total: ${updatedFiles.length} grabbed files`,
          });
        }
      }
    } catch (error) {
      // Silently fail for auto-grab - user can manually add files if needed
      console.log("No files selected in Finder or error occurred:", error);
    }
  };

  const saveGrabbedFiles = async (files: GrabbedFile[]) => {
    try {
      await LocalStorage.setItem("grabbedFiles", JSON.stringify(files));
    } catch (error) {
      console.error("Error saving grabbed files:", error);
    }
  };

  const addFilesFromFinder = async () => {
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

      // Filter out duplicates
      const existingPaths = new Set(grabbedFiles.map(f => f.path));
      const uniqueNewFiles = newFiles.filter(f => !existingPaths.has(f.path));
      
      const updatedFiles = [...grabbedFiles, ...uniqueNewFiles];
      setGrabbedFiles(updatedFiles);
      await saveGrabbedFiles(updatedFiles);

      await showToast({
        style: Toast.Style.Success,
        title: `Added ${uniqueNewFiles.length} file${uniqueNewFiles.length === 1 ? "" : "s"}`,
        message: `Total: ${updatedFiles.length} grabbed files`,
      });
    } catch (error) {
      console.error("Error adding files:", error);
      await showToast({
        style: Toast.Style.Failure,
        title: "Error adding files",
        message: "Please make sure files are selected in Finder",
      });
    }
  };

  const removeFile = async (filePath: string) => {
    const updatedFiles = grabbedFiles.filter(f => f.path !== filePath);
    setGrabbedFiles(updatedFiles);
    await saveGrabbedFiles(updatedFiles);
    
    await showToast({
      style: Toast.Style.Success,
      title: "File removed",
      message: "File removed from grabbed files",
    });
  };

  const clearAllFiles = async () => {
    setGrabbedFiles([]);
    await saveGrabbedFiles([]);
    
    await showToast({
      style: Toast.Style.Success,
      title: "Cleared all files",
      message: "All grabbed files have been removed",
    });
  };

  const startFolderSearch = () => {
    if (grabbedFiles.length === 0) {
      showToast({
        style: Toast.Style.Failure,
        title: "No files to move",
        message: "Please grab some files first",
      });
      return;
    }
    
    setIsFolderSearchMode(true);
    setSearchText("");
    setFolderSearchResults(getCommonDirectories());
  };

  const exitFolderSearch = () => {
    setIsFolderSearchMode(false);
    setIsCopyMode(false);
    setSearchText("");
    setFolderSearchResults([]);
  };

  const moveFilesToDestination = async (destination: string) => {
    try {
      // Expand tilde to home directory
      const expandedDestination = destination.startsWith("~") 
        ? destination.replace("~", process.env.HOME || "")
        : destination;

      // Ensure destination exists
      if (!fs.existsSync(expandedDestination)) {
        fs.mkdirSync(expandedDestination, { recursive: true });
      }

      let successCount = 0;
      let errorCount = 0;

      for (const file of grabbedFiles) {
        try {
          // Check if file still exists
          if (!fs.existsSync(file.path)) {
            errorCount++;
            continue;
          }

          const destinationPath = path.join(expandedDestination, file.name);
          
          // Handle duplicate names
          let finalDestinationPath = destinationPath;
          let counter = 1;
          while (fs.existsSync(finalDestinationPath)) {
            const ext = path.extname(file.name);
            const nameWithoutExt = path.basename(file.name, ext);
            finalDestinationPath = path.join(expandedDestination, `${nameWithoutExt} (${counter})${ext}`);
            counter++;
          }

          fs.renameSync(file.path, finalDestinationPath);
          successCount++;
        } catch (error) {
          console.error(`Error moving file ${file.path}:`, error);
          errorCount++;
        }
      }

      // Clear grabbed files after successful move
      if (successCount > 0) {
        setGrabbedFiles([]);
        await saveGrabbedFiles([]);
      }

      await showToast({
        style: Toast.Style.Success,
        title: `Moved ${successCount} file${successCount === 1 ? "" : "s"}`,
        message: errorCount > 0 ? `${errorCount} files failed to move` : "All files moved successfully",
      });

      if (successCount > 0) {
        await showHUD(`✅ Moved ${successCount} file${successCount === 1 ? "" : "s"}`);
      }

      // Exit folder search mode after successful move
      if (isFolderSearchMode) {
        exitFolderSearch();
      }
    } catch (error) {
      console.error("Error moving files:", error);
      await showToast({
        style: Toast.Style.Failure,
        title: "Error moving files",
        message: "Please check the destination path and permissions",
      });
    }
  };

  const copyFilesToDestination = async (destination: string) => {
    try {
      // Expand tilde to home directory
      const expandedDestination = destination.startsWith("~") 
        ? destination.replace("~", process.env.HOME || "")
        : destination;

      // Ensure destination exists
      if (!fs.existsSync(expandedDestination)) {
        fs.mkdirSync(expandedDestination, { recursive: true });
      }

      let successCount = 0;
      let errorCount = 0;

      for (const file of grabbedFiles) {
        try {
          // Check if file still exists
          if (!fs.existsSync(file.path)) {
            errorCount++;
            continue;
          }

          const destinationPath = path.join(expandedDestination, file.name);
          
          // Handle duplicate names
          let finalDestinationPath = destinationPath;
          let counter = 1;
          while (fs.existsSync(finalDestinationPath)) {
            const ext = path.extname(file.name);
            const nameWithoutExt = path.basename(file.name, ext);
            finalDestinationPath = path.join(expandedDestination, `${nameWithoutExt} (${counter})${ext}`);
            counter++;
          }

          // Copy file instead of moving
          fs.copyFileSync(file.path, finalDestinationPath);
          successCount++;
        } catch (error) {
          console.error(`Error copying file ${file.path}:`, error);
          errorCount++;
        }
      }

      await showToast({
        style: Toast.Style.Success,
        title: `Copied ${successCount} file${successCount === 1 ? "" : "s"}`,
        message: errorCount > 0 ? `${errorCount} files failed to copy` : "All files copied successfully",
      });

      if (successCount > 0) {
        await showHUD(`✅ Copied ${successCount} file${successCount === 1 ? "" : "s"}`);
      }

      // Exit folder search mode after successful copy
      if (isFolderSearchMode) {
        exitFolderSearch();
      }
    } catch (error) {
      console.error("Error copying files:", error);
      await showToast({
        style: Toast.Style.Failure,
        title: "Error copying files",
        message: "Please check the destination path and permissions",
      });
    }
  };

  const moveFilesToTrash = async () => {
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const file of grabbedFiles) {
        try {
          // Check if file still exists
          if (!fs.existsSync(file.path)) {
            errorCount++;
            continue;
          }

          // Move file to trash using macOS trash command
          const { execSync } = require('child_process');
          execSync(`mv "${file.path}" ~/.Trash/`);
          successCount++;
        } catch (error) {
          console.error(`Error moving file ${file.path} to trash:`, error);
          errorCount++;
        }
      }

      // Clear grabbed files after successful move to trash
      if (successCount > 0) {
        setGrabbedFiles([]);
        await saveGrabbedFiles([]);
      }

      await showToast({
        style: Toast.Style.Success,
        title: `Moved ${successCount} file${successCount === 1 ? "" : "s"} to Trash`,
        message: errorCount > 0 ? `${errorCount} files failed to move` : "All files moved to Trash",
      });

      if (successCount > 0) {
        await showHUD(`🗑️ Moved ${successCount} file${successCount === 1 ? "" : "s"} to Trash`);
      }
    } catch (error) {
      console.error("Error moving files to trash:", error);
      await showToast({
        style: Toast.Style.Failure,
        title: "Error moving files to trash",
        message: "Please check file permissions",
      });
    }
  };

  const startCopySearch = () => {
    if (grabbedFiles.length === 0) {
      showToast({
        style: Toast.Style.Failure,
        title: "No files to copy",
        message: "Please grab some files first",
      });
      return;
    }
    
    setIsCopyMode(true);
    setIsFolderSearchMode(true);
    setSearchText("");
    setFolderSearchResults(getCommonDirectories());
  };

  const openDestination = async () => {
    const destination = preferences.defaultDestination || "~/Desktop";
    const expandedPath = destination.startsWith("~") 
      ? destination.replace("~", process.env.HOME || "")
      : destination;
    
    try {
      await open(expandedPath);
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Error opening destination",
        message: "Please check the path in preferences",
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const filteredFiles = grabbedFiles.filter(file =>
    file.name.toLowerCase().includes(searchText.toLowerCase()) ||
    file.path.toLowerCase().includes(searchText.toLowerCase())
  );

  // If in folder search mode, show folder search interface
  if (isFolderSearchMode) {
    return (
      <List
        isLoading={isFolderSearchLoading}
        searchBarPlaceholder="Search for destination folder..."
        searchText={searchText}
        onSearchTextChange={setSearchText}
        actions={
          <ActionPanel>
            <Action
              title="Cancel"
              icon="xmark"
              onAction={exitFolderSearch}
              shortcut={{ modifiers: ["cmd"], key: "w" }}
            />
          </ActionPanel>
        }
      >
        <List.Section title={isCopyMode ? "Select Destination Folder (Copy)" : "Select Destination Folder (Move)"}>
          {folderSearchResults.map((folder) => (
            <List.Item
              key={folder.path}
              icon="📁"
              title={folder.name}
              subtitle={folder.path}
              accessories={[
                { text: `${grabbedFiles.length} file${grabbedFiles.length === 1 ? "" : "s"} to ${isCopyMode ? "copy" : "move"}` },
              ]}
              actions={
                <ActionPanel>
                  <Action
                    title={`${isCopyMode ? "Copy" : "Move"} ${grabbedFiles.length} File${grabbedFiles.length === 1 ? "" : "s"} Here`}
                    icon={isCopyMode ? "doc-on-doc" : "arrow-right"}
                    onAction={() => isCopyMode ? copyFilesToDestination(folder.path) : moveFilesToDestination(folder.path)}
                    shortcut={{ modifiers: ["cmd"], key: "return" }}
                  />
                  <Action
                    title="Cancel"
                    icon="xmark"
                    onAction={exitFolderSearch}
                    shortcut={{ modifiers: ["cmd"], key: "w" }}
                  />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      </List>
    );
  }

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search grabbed files..."
      searchText={searchText}
      onSearchTextChange={setSearchText}
      actions={
        <ActionPanel>
          {grabbedFiles.length > 0 && (
            <>
              <Action
                title="Move to..."
                icon="arrow-right"
                onAction={startFolderSearch}
                shortcut={{ modifiers: ["cmd"], key: "m" }}
              />
              <Action
                title="Copy to..."
                icon="doc-on-doc"
                onAction={startCopySearch}
                shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
              />
              <Action
                title="Move to Trash"
                icon="trash"
                onAction={moveFilesToTrash}
                shortcut={{ modifiers: ["cmd", "shift"], key: "delete" }}
                style={Action.Style.Destructive}
              />
            </>
          )}
          <Action
            title="Open Destination"
            icon="folder"
            onAction={openDestination}
            shortcut={{ modifiers: ["cmd"], key: "o" }}
          />
        </ActionPanel>
      }
    >
      {grabbedFiles.length === 0 ? (
        <List.EmptyView
          icon="📁"
          title="No files grabbed"
          description="Select files in Finder and open this extension to grab them"
        />
      ) : (
        <>
          <List.Section title={`Grabbed Files (${grabbedFiles.length})`}>
            {filteredFiles.map((file) => (
              <List.Item
                key={file.path}
                icon="📄"
                title={file.name}
                subtitle={file.path}
                accessories={[
                  { text: formatFileSize(file.size) },
                  { text: file.dateModified.toLocaleDateString() },
                ]}
                actions={
                  <ActionPanel>
                    <Action
                      title="Move to..."
                      icon="arrow-right"
                      onAction={startFolderSearch}
                      shortcut={{ modifiers: ["cmd"], key: "m" }}
                    />
                    <Action
                      title="Copy to..."
                      icon="doc-on-doc"
                      onAction={startCopySearch}
                      shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                    />
                    <Action
                      title="Move to Trash"
                      icon="trash"
                      onAction={moveFilesToTrash}
                      shortcut={{ modifiers: ["cmd", "shift"], key: "delete" }}
                      style={Action.Style.Destructive}
                    />
                  </ActionPanel>
                }
              />
            ))}
          </List.Section>
        </>
      )}
    </List>
  );
}
