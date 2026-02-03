'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { MessageSquare, Highlighter, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

// Dynamically import react-pdf components to avoid SSR issues
const Document = dynamic(
  () => import('react-pdf').then((mod) => mod.Document),
  { ssr: false }
);
const Page = dynamic(
  () => import('react-pdf').then((mod) => mod.Page),
  { ssr: false }
);

// Configure PDF.js worker
let pdfjs: any;
if (typeof window !== 'undefined') {
  import('react-pdf').then((module) => {
    pdfjs = module.pdfjs;
    pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
  });
}

interface Annotation {
  id: string;
  type: 'comment' | 'highlight';
  page: number;
  x: number;
  y: number;
  text?: string;
  color: string;
}

interface PDFViewerProps {
  url: string;
  fileName?: string;
}

export function PDFViewer({ url, fileName }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [annotationMode, setAnnotationMode] = useState<'none' | 'comment' | 'highlight'>('none');

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  const handlePageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (annotationMode === 'none') return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    if (annotationMode === 'comment') {
      const text = prompt('輸入註解：');
      if (text) {
        const newAnnotation: Annotation = {
          id: Date.now().toString(),
          type: 'comment',
          page: pageNumber,
          x,
          y,
          text,
          color: '#3b82f6',
        };
        setAnnotations([...annotations, newAnnotation]);
      }
    } else if (annotationMode === 'highlight') {
      const newAnnotation: Annotation = {
        id: Date.now().toString(),
        type: 'highlight',
        page: pageNumber,
        x,
        y,
        color: '#fbbf24',
      };
      setAnnotations([...annotations, newAnnotation]);
    }

    setAnnotationMode('none');
  };

  const goToPreviousPage = () => setPageNumber(Math.max(1, pageNumber - 1));
  const goToNextPage = () => setPageNumber(Math.min(numPages, pageNumber + 1));
  const zoomIn = () => setScale(Math.min(2.0, scale + 0.1));
  const zoomOut = () => setScale(Math.max(0.5, scale - 0.1));

  const pageAnnotations = annotations.filter((a) => a.page === pageNumber);

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAnnotationMode(annotationMode === 'comment' ? 'none' : 'comment')}
            className={`p-2 rounded transition-colors ${
              annotationMode === 'comment'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="新增註解"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
          <button
            onClick={() => setAnnotationMode(annotationMode === 'highlight' ? 'none' : 'highlight')}
            className={`p-2 rounded transition-colors ${
              annotationMode === 'highlight'
                ? 'bg-yellow-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="螢光筆"
          >
            <Highlighter className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={zoomOut}
            className="p-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
            title="縮小"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="text-white text-sm">{Math.round(scale * 100)}%</span>
          <button
            onClick={zoomIn}
            className="p-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
            title="放大"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousPage}
            disabled={pageNumber <= 1}
            className="p-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-white text-sm">
            {pageNumber} / {numPages}
          </span>
          <button
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
            className="p-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* PDF Display */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-4">
        <div className="relative" onClick={handlePageClick}>
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              </div>
            }
          >
            <Page pageNumber={pageNumber} scale={scale} />
          </Document>

          {/* Annotations Overlay */}
          {pageAnnotations.map((annotation) => (
            <div
              key={annotation.id}
              className="absolute cursor-pointer"
              style={{
                left: `${annotation.x}%`,
                top: `${annotation.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              title={annotation.text}
            >
              {annotation.type === 'comment' && (
                <div className="relative">
                  <MessageSquare
                    className="w-6 h-6"
                    style={{ color: annotation.color }}
                  />
                  {annotation.text && (
                    <div className="absolute left-8 top-0 bg-white text-gray-900 p-2 rounded shadow-lg text-xs w-48 z-10 hidden hover:block">
                      {annotation.text}
                    </div>
                  )}
                </div>
              )}
              {annotation.type === 'highlight' && (
                <div
                  className="w-16 h-6 opacity-50 rounded"
                  style={{ backgroundColor: annotation.color }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {annotationMode !== 'none' && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          {annotationMode === 'comment' ? '點擊 PDF 新增註解' : '點擊 PDF 新增螢光標記'}
        </div>
      )}
    </div>
  );
}
