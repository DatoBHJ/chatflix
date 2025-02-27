import { useState, useEffect } from 'react';
import { FileData } from '../types';

export const useFileUpload = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [fileMap, setFileMap] = useState<Map<string, FileData>>(new Map());
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = (newFiles: FileList) => {
    const newFileArray = Array.from(newFiles);
    
    const newFileEntries = newFileArray.map(file => {
      const url = URL.createObjectURL(file);
      return [file.name, { file, url }] as [string, FileData];
    });

    setFileMap(prevMap => {
      const newMap = new Map(prevMap);
      newFileEntries.forEach(([name, data]) => {
        if (prevMap.has(name)) {
          URL.revokeObjectURL(prevMap.get(name)!.url);
        }
        newMap.set(name, data);
      });
      return newMap;
    });

    setFiles(prevFiles => {
      const existingNames = new Set(prevFiles.map(f => f.name));
      const uniqueNewFiles = newFileArray.filter(file => !existingNames.has(file.name));
      return [...prevFiles, ...uniqueNewFiles];
    });
  };

  const removeFile = (fileToRemove: File) => {
    setFileMap(prevMap => {
      const newMap = new Map(prevMap);
      const fileData = newMap.get(fileToRemove.name);
      if (fileData) {
        URL.revokeObjectURL(fileData.url);
        newMap.delete(fileToRemove.name);
      }
      return newMap;
    });

    setFiles(prevFiles => prevFiles.filter(file => file !== fileToRemove));
  };

  const clearFiles = () => {
    fileMap.forEach(({ url }) => URL.revokeObjectURL(url));
    setFiles([]);
    setFileMap(new Map());
  };

  useEffect(() => {
    return () => {
      fileMap.forEach(({ url }) => URL.revokeObjectURL(url));
    };
  }, []);

  return {
    files,
    fileMap,
    dragActive,
    setDragActive,
    handleFiles,
    removeFile,
    clearFiles
  };
};

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export const isImageFile = (file: File): boolean => {
  return file.type.startsWith('image/');
};

export const isTextFile = (file: File): boolean => {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();
  const fileExt = fileName.split('.').pop() || '';
  
  return fileType.includes('text') || 
         ['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'md', 'py', 'java', 
          'c', 'cpp', 'cs', 'go', 'rb', 'php', 'swift', 'kt', 'rs'].includes(fileExt);
}; 