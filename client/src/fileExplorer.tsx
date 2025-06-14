import { useEffect, useState } from 'preact/hooks';
import { filer, useFiler } from './core/fileStore';
import { MetaData } from './core/fileTypes';

interface FileExplorerProps {
  title: string;
}

interface FileStats {
  totalFiles: number;
  totalSize: number;
  fileTypes: Record<string, number>;
}

export function FileExplorer({ title }: FileExplorerProps) {
  const files = useFiler();
  const [selectedFile, setSelectedFile] = useState<MetaData | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'date'>('name');
  const [filterType, setFilterType] = useState<string>('all');
  const [stats, setStats] = useState<FileStats>({ totalFiles: 0, totalSize: 0, fileTypes: {} });

  useEffect(() => {
    // Calculate file statistics
    const fileTypes: Record<string, number> = {};
    let totalSize = 0;

    files.forEach(file => {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'unknown';
      fileTypes[extension] = (fileTypes[extension] || 0) + 1;
      totalSize += file.size || 0;
    });

    setStats({
      totalFiles: files.length,
      totalSize,
      fileTypes
    });
  }, [files]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString() + ' ' + new Date(timestamp).toLocaleTimeString();
  };

  const getFileIcon = (filename: string): string => {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
        return '🖼️';
      case 'mp4':
      case 'mkv':
      case 'avi':
      case 'mov':
        return '🎬';
      case 'mp3':
      case 'wav':
      case 'flac':
      case 'ogg':
        return '🎵';
      case 'pdf':
        return '📄';
      case 'torrent':
        return '🌊';
      case 'zip':
      case 'rar':
      case '7z':
        return '📦';
      default:
        return '📁';
    }
  };

  const sortedFiles = [...files].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'size':
        return (b.size || 0) - (a.size || 0);
      case 'date':
        // Since MetaData doesn't have timestamp, sort by name as fallback
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });

  const filteredFiles = sortedFiles.filter(file => {
    if (filterType === 'all') return true;
    const extension = file.name.split('.').pop()?.toLowerCase();
    return extension === filterType;
  });

  const handleFileClick = (file: MetaData) => {
    setSelectedFile(file);
  };

  const handleDownload = (file: MetaData) => {
    filer.exportFile(file.hash);
  };

  const clearOPFS = async () => {
    if (confirm('Are you sure you want to clear all files from OPFS? This cannot be undone.')) {
      try {
        const directory = await navigator.storage.getDirectory();
        // @ts-ignore
        for await (const [name, handle] of directory.entries()) {
          await directory.removeEntry(name);
        }
        // Clear the database
        filer.db.files.clear();
        await filer.save();
        filer.dispatch('importedFile'); // Trigger UI update
        alert('OPFS cleared successfully');
      } catch (error) {
        console.error('Error clearing OPFS:', error);
        alert('Error clearing OPFS');
      }
    }
  };

  return (
    <div className="file-explorer w-full max-w-6xl mx-auto p-4 bg-gray-900 rounded-lg">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {viewMode === 'list' ? '⊞' : '☰'}
          </button>
          <button
            onClick={clearOPFS}
            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Clear OPFS
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="bg-gray-800 p-3 rounded">
          <div className="text-sm text-gray-400">Total Files</div>
          <div className="text-lg font-bold text-white">{stats.totalFiles}</div>
        </div>
        <div className="bg-gray-800 p-3 rounded">
          <div className="text-sm text-gray-400">Total Size</div>
          <div className="text-lg font-bold text-white">{formatFileSize(stats.totalSize)}</div>
        </div>
        <div className="bg-gray-800 p-3 rounded">
          <div className="text-sm text-gray-400">File Types</div>
          <div className="text-sm text-white">
            {Object.entries(stats.fileTypes).map(([type, count]) => (
              <span key={type} className="mr-2">{type}: {count}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div>
          <label className="text-sm text-gray-400 mr-2">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy((e.target as HTMLSelectElement).value as 'name' | 'size' | 'date')}
            className="bg-gray-800 text-white px-2 py-1 rounded"
          >
            <option value="name">Name</option>
            <option value="size">Size</option>
            <option value="date">Date</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-400 mr-2">Filter:</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType((e.target as HTMLSelectElement).value)}
            className="bg-gray-800 text-white px-2 py-1 rounded"
          >
            <option value="all">All Files</option>
            {Object.keys(stats.fileTypes).map(type => (
              <option key={type} value={type}>{type.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* File List/Grid */}
      {filteredFiles.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          No files found. Drop some files to get started!
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-4 gap-4' : 'space-y-2'}>
          {filteredFiles.map(file => (
            <div
              key={file.hash}
              className={`
                ${viewMode === 'grid' 
                  ? 'bg-gray-800 p-4 rounded cursor-pointer hover:bg-gray-700 text-center' 
                  : 'bg-gray-800 p-3 rounded cursor-pointer hover:bg-gray-700 flex items-center justify-between'
                }
                ${selectedFile?.hash === file.hash ? 'ring-2 ring-blue-500' : ''}
              `}
              onClick={() => handleFileClick(file)}
            >
              {viewMode === 'grid' ? (
                <div>
                  <div className="text-4xl mb-2">{getFileIcon(file.name)}</div>
                  <div className="text-sm text-white truncate">{file.name}</div>
                  <div className="text-xs text-gray-400">{formatFileSize(file.size || 0)}</div>
                </div>
              ) : (
                <>
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">{getFileIcon(file.name)}</span>
                    <div>
                      <div className="text-white font-medium">{file.name}</div>
                      <div className="text-xs text-gray-400">
                        {formatFileSize(file.size || 0)} • {file.fileType}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(file);
                    }}
                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                  >
                    Download
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* File Details Panel */}
      {selectedFile && (
        <div className="mt-6 bg-gray-800 p-4 rounded">
          <h3 className="text-lg font-bold text-white mb-3">File Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-400">Name</div>
              <div className="text-white">{selectedFile.name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Size</div>
              <div className="text-white">{formatFileSize(selectedFile.size || 0)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Hash</div>
              <div className="text-white font-mono text-xs break-all">{selectedFile.hash}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">File Type</div>
              <div className="text-white">{selectedFile.fileType}</div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => handleDownload(selectedFile)}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Download File
            </button>
            <button
              onClick={() => setSelectedFile(null)}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Close Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
