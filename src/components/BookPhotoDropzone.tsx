import { BookOpen, ImagePlus, Upload, X } from 'lucide-react';
import React, { useRef, useState } from 'react';

interface BookPhotoDropzoneProps {
  previewUrl: string;
  previewFailed: boolean;
  onPreviewError: () => void;
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  error: string | null;
  onError: (message: string | null) => void;
}

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
]);

const MAX_FILE_BYTES = 4 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BookPhotoDropzone({
  previewUrl,
  previewFailed,
  onPreviewError,
  selectedFile,
  onFileSelect,
  error,
  onError,
}: BookPhotoDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const validateAndSelect = (file: File | null | undefined) => {
    if (!file) return;
    const mimeOk = file.type
      ? ALLOWED_MIME.has(file.type.toLowerCase())
      : /\.(jpe?g|png|webp)$/i.test(file.name);

    if (!mimeOk) {
      onError('Please choose a JPEG, PNG, or WebP photo.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      onError('Photo must be 4 MB or smaller.');
      return;
    }

    onError(null);
    onFileSelect(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    validateAndSelect(file);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    if (!isDragging && e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) {
      onError('Please drop an image file (JPEG, PNG, or WebP).');
      return;
    }
    validateAndSelect(file);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i += 1) {
      if (items[i].kind === 'file' && items[i].type.startsWith('image/')) {
        const pastedFile = items[i].getAsFile();
        if (pastedFile) {
          e.preventDefault();
          validateAndSelect(pastedFile);
          return;
        }
      }
    }
  };

  const openFilePicker = () => {
    inputRef.current?.click();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openFilePicker();
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
      className="space-y-3"
    >
      {/* Cover Preview Frame (also accepts dropped photos) */}
      <div
        className={`relative aspect-[3/4] rounded-xl overflow-hidden border transition-colors bg-[#F3EFE6] ${
          isDragging ? 'border-[#1B4D3E] ring-2 ring-[#1B4D3E]/25' : 'border-[#E5DFD3]'
        }`}
      >
        {!previewFailed && previewUrl ? (
          <img
            src={previewUrl}
            alt="Book cover preview"
            referrerPolicy="no-referrer"
            onError={onPreviewError}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-[#5C615D]">
            <BookOpen className="w-10 h-10 text-[#1B4D3E]/70 mb-2" />
            <p className="text-xs font-medium">
              Cover preview unavailable. Drop a photo, select an editorial cover, or paste an HTTPS image URL.
            </p>
          </div>
        )}

        {isDragging && (
          <div className="absolute inset-0 bg-[#1B4D3E]/80 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center text-[#FAF7F2] pointer-events-none">
            <div className="w-12 h-12 rounded-xl bg-[#FAF7F2]/15 border border-[#FAF7F2]/30 flex items-center justify-center mb-3">
              <ImagePlus className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold">Drop photo to set book cover</p>
            <p className="text-xs text-[#FAF7F2]/80 mt-1">JPEG, PNG, or WebP up to 4 MB</p>
          </div>
        )}
      </div>

      {/* Interactive Drag-and-Drop Zone */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleInputChange}
        className="sr-only"
        aria-label="Upload book cover photo"
      />

      <div
        role="button"
        tabIndex={0}
        onClick={openFilePicker}
        onKeyDown={handleKeyDown}
        aria-label="Drag and drop a book photo here, or click to browse"
        className={`group rounded-xl border-2 border-dashed px-4 py-4 text-center transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/30 ${
          isDragging
            ? 'border-[#1B4D3E] bg-[#1B4D3E]/10'
            : 'border-[#D5CEC0] bg-[#FFFFFF] hover:border-[#1B4D3E] hover:bg-[#F3EFE6]/60'
        }`}
      >
        <div className="flex flex-col items-center gap-1.5">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
              isDragging
                ? 'bg-[#1B4D3E] text-[#FAF7F2]'
                : 'bg-[#F3EFE6] text-[#1B4D3E] group-hover:bg-[#1B4D3E] group-hover:text-[#FAF7F2]'
            }`}
          >
            <Upload className="w-4 h-4" />
          </div>
          <p className="text-sm font-semibold text-[#1C1F1D]">
            {isDragging
              ? 'Release to attach photo'
              : selectedFile
                ? 'Drop another photo or click to replace'
                : 'Drag & drop book photo, or browse'}
          </p>
          <p className="text-xs text-[#5C615D]">
            JPEG, PNG, or WebP · Max 4 MB (or paste an image)
          </p>
        </div>
      </div>

      {selectedFile && (
        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[#F3EFE6] border border-[#E5DFD3] text-xs">
          <div className="min-w-0">
            <p className="font-medium text-[#1C1F1D] truncate">{selectedFile.name}</p>
            <p className="text-[#5C615D]">{formatFileSize(selectedFile.size)} · Ready to upload</p>
          </div>
          <button
            type="button"
            onClick={() => {
              onFileSelect(null);
              onError(null);
            }}
            aria-label={`Remove ${selectedFile.name}`}
            className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[#5C615D] hover:text-[#1C1F1D] hover:bg-[#E5DFD3]/60 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
