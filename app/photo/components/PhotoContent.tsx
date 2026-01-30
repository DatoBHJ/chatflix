'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Trash2, Upload, Check, X, RectangleHorizontal } from 'lucide-react';
import { CustomBackground, DefaultBackground, PhotoContentProps } from './types';

import { DEFAULT_BACKGROUNDS } from '../constants/backgrounds';

export default function PhotoContent({ 
  user, 
  currentBackground, 
  backgroundType, 
  backgroundId, 
  onBackgroundChange 
}: PhotoContentProps) {
  const [activeTab, setActiveTab] = useState<'default' | 'custom'>('default');
  const [customBackgrounds, setCustomBackgrounds] = useState<CustomBackground[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedBackground, setSelectedBackground] = useState<string>('');
  const [selectedType, setSelectedType] = useState<'default' | 'custom'>('default');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const router = useRouter();

  // Load user's custom backgrounds
  const loadCustomBackgrounds = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_background_settings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading custom backgrounds:', error);
        return;
      }

      const backgrounds: CustomBackground[] = [];
      for (const bg of data || []) {
        // Check if URL is still valid, refresh if needed
        let url = bg.background_url;
        if (bg.url_expires_at && new Date(bg.url_expires_at) < new Date()) {
          // URL expired, generate new one
          const { data: signedData, error: signedError } = await supabase.storage
            .from('background-images')
            .createSignedUrl(bg.background_path, 24 * 60 * 60);
          
          if (signedData?.signedUrl) {
            url = signedData.signedUrl;
            // Update the URL in database
            await supabase
              .from('user_background_settings')
              .update({
                background_url: url,
                url_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
              })
              .eq('id', bg.id);
          }
        }

        backgrounds.push({
          id: bg.id,
          path: bg.background_path,
          url: url,
          name: bg.name || 'Custom Background',
          created_at: bg.created_at
        });
      }

      setCustomBackgrounds(backgrounds);
    } catch (error) {
      console.error('Error loading custom backgrounds:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, supabase]);

  // Initialize selected background - don't auto-select anything
  useEffect(() => {
    // Don't auto-select any background, let user choose
    setSelectedBackground('');
    setSelectedType('default');
    setActiveTab('default');
  }, []);

  // Load backgrounds on mount
  useEffect(() => {
    loadCustomBackgrounds();
  }, [loadCustomBackgrounds]);

  // Image compression function
  const compressImage = async (file: File, maxSizeMB = 2): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = document.createElement('img');
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Calculate new dimensions
          let { width, height } = img;
          const maxDimension = 1920; // Max width/height
          
          if (width > height && width > maxDimension) {
            height = (height * maxDimension) / width;
            width = maxDimension;
          } else if (height > maxDimension) {
            width = (width * maxDimension) / height;
            height = maxDimension;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          ctx?.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob((blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Failed to compress image'));
            }
          }, file.type, 0.8);
        };
        img.onerror = () => {
          reject(new Error('Error loading image'));
        };
      };
      reader.onerror = () => {
        reject(new Error('Error reading file'));
      };
    });
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    setIsUploading(true);
    try {
      // Compress image if needed
      let fileToUpload = file;
      if (file.size > 2 * 1024 * 1024) { // Compress if larger than 2MB
        fileToUpload = await compressImage(file);
        console.log(`Compressed image from ${file.size} to ${fileToUpload.size} bytes`);
      }

      // Generate unique filename
      const timestamp = new Date().getTime();
      const fileExt = file.name.split('.').pop();
      const fileName = `background_${timestamp}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('background-images')
        .upload(filePath, fileToUpload, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        alert('Failed to upload image. Please try again.');
        return;
      }

      // Generate signed URL
      const { data: signedData, error: signedError } = await supabase.storage
        .from('background-images')
        .createSignedUrl(filePath, 24 * 60 * 60);

      if (signedError || !signedData?.signedUrl) {
        console.error('Failed to create signed URL:', signedError);
        alert('Failed to process uploaded image. Please try again.');
        return;
      }

      // Save to database
      const { data: insertData, error: insertError } = await supabase
        .from('user_background_settings')
        .insert({
          user_id: user.id,
          background_path: filePath,
          background_url: signedData.signedUrl,
          url_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          name: file.name
        })
        .select()
        .single();

      if (insertError) {
        console.error('Database error:', insertError);
        alert('Failed to save image. Please try again.');
        return;
      }

      // Add to local state
      const newBackground: CustomBackground = {
        id: insertData.id,
        path: filePath,
        url: signedData.signedUrl,
        name: file.name,
        created_at: insertData.created_at
      };

      setCustomBackgrounds(prev => [newBackground, ...prev]);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle background selection
  const handleBackgroundSelect = (backgroundId: string, type: 'default' | 'custom') => {
    setSelectedBackground(backgroundId);
    setSelectedType(type);
  };

  // Handle apply background
  const handleApplyBackground = async () => {
    if (!user?.id) return;

    try {
      // Save preference to database
      const response = await fetch('/api/background/set-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          backgroundType: selectedType,
          backgroundId: selectedBackground
        })
      });

      if (!response.ok) {
        console.error('Failed to save preference');
        alert('Failed to save background preference. Please try again.');
        return;
      }

      // Update local state
      if (selectedType === 'default') {
        const defaultBg = DEFAULT_BACKGROUNDS.find(bg => bg.id === selectedBackground);
        if (defaultBg) {
          onBackgroundChange(defaultBg.url, 'default', selectedBackground);
        }
      } else {
        const customBg = customBackgrounds.find(bg => bg.id === selectedBackground);
        if (customBg) {
          onBackgroundChange(customBg.url, 'custom', customBg.id);
        }
      }
      
      // Redirect back to home
      router.push('/');
    } catch (error) {
      console.error('Error applying background:', error);
      alert('Failed to apply background. Please try again.');
    }
  };

  // Handle delete custom background
  const handleDeleteBackground = async (backgroundId: string) => {
    if (!user?.id) return;
    
    setIsDeleting(backgroundId);
    try {
      const background = customBackgrounds.find(bg => bg.id === backgroundId);
      if (!background) return;

      // Check if this image is set as current background in user_preferences
      const { data: preference } = await supabase
        .from('user_preferences')
        .select('id, selected_background_id, selected_background_type')
        .eq('user_id', user.id)
        .single()

      if (preference && 
          preference.selected_background_type === 'custom' && 
          preference.selected_background_id === backgroundId) {
        // Reset to default background
        await supabase
          .from('user_preferences')
          .update({
            selected_background_type: 'default',
            selected_background_id: 'default-1'
          })
          .eq('user_id', user.id)
      }

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('background-images')
        .remove([background.path]);

      if (storageError) {
        console.error('Storage deletion error:', storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('user_background_settings')
        .delete()
        .eq('id', backgroundId)
        .eq('user_id', user.id);

      if (dbError) {
        console.error('Database deletion error:', dbError);
        alert('Failed to delete image. Please try again.');
        return;
      }

      // Remove from local state
      setCustomBackgrounds(prev => prev.filter(bg => bg.id !== backgroundId));
      
      // If this was the selected background, reset selection
      if (selectedBackground === backgroundId) {
        setSelectedBackground('');
        setSelectedType('default');
      }

    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete image. Please try again.');
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="w-full">
      {/* Tabs */}
      <div className="flex border-b border-[var(--subtle-divider)] mb-6">
        <button
          onClick={() => setActiveTab('default')}
          className={`flex-1 py-3 px-4 text-sm font-medium transition-colors cursor-pointer ${
            activeTab === 'default' 
              ? 'text-[var(--foreground)] border-b-2 border-[var(--foreground)]' 
              : 'text-[var(--muted)] hover:text-[var(--foreground)]'
          }`}
        >
          Default Backgrounds
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={`flex-1 py-3 px-4 text-sm font-medium transition-colors cursor-pointer ${
            activeTab === 'custom' 
              ? 'text-[var(--foreground)] border-b-2 border-[var(--foreground)]' 
              : 'text-[var(--muted)] hover:text-[var(--foreground)]'
          }`}
        >
          My Photos
        </button>
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto">
        {activeTab === 'default' ? (
          <div className="grid grid-cols-2 gap-4">
            {DEFAULT_BACKGROUNDS.map((bg) => (
              <div
                key={bg.id}
                className={`relative aspect-video rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                  selectedBackground === bg.id && selectedType === 'default'
                    ? 'border-blue-500 ring-2 ring-blue-500/50'
                    : 'border-[var(--subtle-divider)] hover:border-[var(--foreground)]'
                }`}
                onClick={() => handleBackgroundSelect(bg.id, 'default')}
              >
                <img
                  src={bg.url}
                  alt={bg.name}
                  className="w-full h-full object-cover"
                />
                {selectedBackground === bg.id && selectedType === 'default' && (
                  <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                    <Check size={24} className="text-white" />
                  </div>
                )}
                <div className="absolute bottom-2 left-2 right-2">
                  <p className="text-white text-sm font-medium bg-black/50 rounded px-2 py-1">
                    {bg.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {/* Upload Button */}
            <div className="mb-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full py-3 px-4 rounded-lg border-2 border-dashed border-[var(--subtle-divider)] hover:border-[var(--foreground)] transition-colors flex items-center justify-center gap-2 text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer"
              >
                <Upload size={20} />
                {isUploading ? (
                  <div className="w-4 h-4 border-2 border-[var(--muted)] border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Upload New Photo'
                )}
              </button>
            </div>

            {/* Custom Backgrounds Grid */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-[var(--muted)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : customBackgrounds.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-[var(--muted)]">No custom photos yet. Upload some to get started!</div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {customBackgrounds.map((bg) => (
                  <div
                    key={bg.id}
                    className={`relative aspect-video rounded-lg overflow-hidden cursor-pointer border-2 transition-all group ${
                      selectedBackground === bg.id && selectedType === 'custom'
                        ? 'border-blue-500 ring-2 ring-blue-500/50'
                        : 'border-[var(--subtle-divider)] hover:border-[var(--foreground)]'
                    }`}
                    onClick={() => handleBackgroundSelect(bg.id, 'custom')}
                  >
                    <img
                      src={bg.url}
                      alt={bg.name}
                      className="w-full h-full object-cover"
                    />
                    {selectedBackground === bg.id && selectedType === 'custom' && (
                      <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                        <Check size={24} className="text-white" />
                      </div>
                    )}
                    
                    {/* Delete Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBackground(bg.id);
                      }}
                      disabled={isDeleting === bg.id}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      {isDeleting === bg.id ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 size={16} className="text-white" />
                      )}
                    </button>
                    
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="text-white text-sm font-medium bg-black/50 rounded px-2 py-1 truncate">
                        {bg.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 p-4 border-t border-[var(--subtle-divider)] mt-6">
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={handleApplyBackground}
          disabled={!selectedBackground}
          className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-[var(--muted)] disabled:cursor-not-allowed text-white rounded-lg transition-colors cursor-pointer"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
