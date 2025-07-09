# Grab Files

A Raycast extension that allows you to select multiple files from different locations and perform batch operations on them.

## Features

- **Grab files from Finder**: Select files in Finder and add them to your grabbed files list
- **Persistent storage**: Your grabbed files are saved between Raycast sessions
- **Batch operations**: Move, copy, or trash all grabbed files at once
- **Folder search**: Search for destination folders by name, similar to Raycast's Search Files extension
- **Search**: Search through your grabbed files by name or path
- **Duplicate handling**: Automatically handles duplicate filenames in destination
- **Error handling**: Graceful handling of permission errors and missing files

## Usage

### Recommended Workflow (Version 3.3)
1. **Select files in Finder** - Choose the files you want to grab
2. **Open Raycast and run "Grab Files"** - Files are automatically grabbed and appear in the list
3. **Choose your action**:
   - **Move to...** (`Cmd+M`) - Move files to a new location
   - **Copy to...** (`Cmd+Shift+C`) - Copy files to a new location
   - **Move to Trash** (`Cmd+Shift+Delete`) - Move files to the system trash
4. **Search and select** - Type part of a folder name to find matching directories (for move/copy)
5. **Files are processed** - All grabbed files are moved, copied, or trashed

### Available Actions

#### Move to... (`Cmd+M`)
- Moves all grabbed files to the selected destination
- Files are removed from their original location
- Clears the grabbed files list after successful move

#### Copy to... (`Cmd+Shift+C`)
- Copies all grabbed files to the selected destination
- Files remain in their original location
- Keeps the grabbed files list for further operations

#### Move to Trash (`Cmd+Shift+Delete`)
- Moves all grabbed files to the system trash
- Files can be recovered from the trash if needed
- Clears the grabbed files list after successful move

### Folder Search Feature
When you select "Move to..." or "Copy to...":
- **Search by name**: Type part of a folder name to find matching directories
- **Common folders**: Quick access to Desktop, Documents, Downloads, etc.
- **Deep search**: Searches through your home directory, Applications, and Users folders
- **Smart results**: Exact matches appear first, followed by partial matches
- **Keyboard shortcuts**: Use `Cmd+Return` to select a folder, `Cmd+W` to cancel

### Alternative Workflows
- **Search**: Use the search bar to filter your grabbed files

## Preferences

- **Default Destination**: Set a default folder for moving files (e.g., `~/Desktop`, `~/Documents`)

## Keyboard Shortcuts

- `Cmd+M`: Move to... (search for destination folder)
- `Cmd+Shift+C`: Copy to... (search for destination folder)
- `Cmd+Shift+Delete`: Move to Trash
- `Cmd+O`: Open destination folder
- `Cmd+Return`: Select folder in search mode
- `Cmd+W`: Cancel folder search

## How It Works

1. **File Selection**: Select files in Finder and open "Grab Files" - they're automatically added
2. **Storage**: Files are stored locally and persist between Raycast sessions
3. **Action Selection**: Choose to move, copy, or trash your files
4. **Destination Selection**: Search for any folder on your system by name (for move/copy)
5. **File Processing**: Files are processed with duplicate name handling and error recovery
6. **Cleanup**: Grabbed files are cleared after successful operations (except copy)

## Troubleshooting

- **No files grabbed**: Make sure files (not folders) are selected in Finder
- **Permission errors**: Check that you have access to both source and destination folders
- **Missing files**: Files that were moved or deleted won't appear in the list
- **Search not working**: The folder search looks in common locations; try different search terms
- **Trash not working**: Ensure you have permission to move files to the system trash