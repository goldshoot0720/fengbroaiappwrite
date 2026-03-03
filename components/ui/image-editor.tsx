'use client';

import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { RotateCw, FlipHorizontal, FlipVertical, Crop, Check, X } from 'lucide-react';

interface ImageEditorProps {
  imageUrl: string;
  onSave: (editedImageBlob: Blob, fileName: string) => Promise<void>;
  onCancel: () => void;
  fileName?: string;
}

interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function ImageEditor({ imageUrl, onSave, onCancel, fileName = 'edited-image.png' }: ImageEditorProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [flipHorizontal, setFlipHorizontal] = useState(false);
  const [flipVertical, setFlipVertical] = useState(false);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.src = url;
    });

  const getCroppedImg = async (): Promise<Blob | null> => {
    if (!croppedAreaPixels) return null;

    const image = await createImage(imageUrl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    const rotRad = (rotation * Math.PI) / 180;
    const { width: bBoxWidth, height: bBoxHeight } = croppedAreaPixels;

    canvas.width = bBoxWidth;
    canvas.height = bBoxHeight;

    ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
    ctx.rotate(rotRad);
    ctx.scale(flipHorizontal ? -1 : 1, flipVertical ? -1 : 1);
    ctx.translate(-image.width / 2, -image.height / 2);

    ctx.drawImage(image, 0, 0);

    const data = ctx.getImageData(
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height
    );

    canvas.width = croppedAreaPixels.width;
    canvas.height = croppedAreaPixels.height;

    ctx.putImageData(data, 0, 0);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const croppedImage = await getCroppedImg();
      if (croppedImage) {
        await onSave(croppedImage, fileName);
      }
    } catch (error) {
      console.error('Error saving image:', error);
      alert('儲存圖片失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 bg-gray-900 border-b border-gray-700">
        <h3 className="text-white font-medium">圖片編輯</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
            title="旋轉 90°"
          >
            <RotateCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => setFlipHorizontal(!flipHorizontal)}
            className={`p-2 rounded transition-colors ${
              flipHorizontal ? 'bg-blue-500 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
            title="水平翻轉"
          >
            <FlipHorizontal className="w-5 h-5" />
          </button>
          <button
            onClick={() => setFlipVertical(!flipVertical)}
            className={`p-2 rounded transition-colors ${
              flipVertical ? 'bg-blue-500 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
            title="垂直翻轉"
          >
            <FlipVertical className="w-5 h-5" />
          </button>
          <div className="w-px h-6 bg-gray-600 mx-2" />
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Check className="w-5 h-5" />
            {saving ? '儲存中...' : '儲存'}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors flex items-center gap-2"
          >
            <X className="w-5 h-5" />
            取消
          </button>
        </div>
      </div>

      {/* Cropper Area */}
      <div className="flex-1 relative">
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={undefined}
          onCropChange={setCrop}
          onCropComplete={onCropComplete}
          onZoomChange={setZoom}
          transform={`translate(${flipHorizontal ? '-' : ''}50%, ${flipVertical ? '-' : ''}50%) scale(${
            flipHorizontal ? -1 : 1
          }, ${flipVertical ? -1 : 1})`}
        />
      </div>

      {/* Zoom Control */}
      <div className="p-4 bg-gray-900 border-t border-gray-700">
        <div className="flex items-center gap-4 max-w-md mx-auto">
          <Crop className="w-5 h-5 text-gray-400" />
          <input
            type="range"
            value={zoom}
            min={1}
            max={3}
            step={0.1}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1"
          />
          <span className="text-white text-sm w-16 text-right">{Math.round(zoom * 100)}%</span>
        </div>
      </div>
    </div>
  );
}
