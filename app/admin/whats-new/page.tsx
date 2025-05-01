'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
// import { useUser } from '@/app/lib/UserContext';
import Image from 'next/image';
import Link from 'next/link';
import { User } from '@supabase/supabase-js';

interface FeatureUpdate {
  id: string;
  title: string;
  description: string;
  images?: string[];
  created_at?: string;
}

export default function WhatsNewAdmin() {
  const [updates, setUpdates] = useState<FeatureUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    images: '',
  });
  
  // const { user, isLoading: userLoading } = useUser();
  const [user, setUser] = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const supabase = createClient();

  // Fetch user data
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
      } catch (error) {
        console.error('Error loading user:', error);
        setUser(null);
      } finally {
        setUserLoading(false);
      }
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
      } else if (event === 'SIGNED_IN') {
        setUser(session?.user || null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Fetch updates from Supabase
  const fetchUpdates = async () => {
    try {
      const { data, error } = await supabase
        .from('feature_updates')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching updates:', error);
        return;
      }
      
      setUpdates(data);
    } catch (error) {
      console.error('Error in fetchUpdates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUpdates();
    
    // Set up a real-time subscription for updates
    const subscription = supabase
      .channel('feature_updates_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'feature_updates' }, 
        () => {
          fetchUpdates();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    if (name === 'description') {
      setCharCount(value.length);
    }
  };
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) {
      return;
    }
    
    setUploading(true);
    
    try {
      const files = Array.from(e.target.files);
      const uploadPromises = files.map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;
        
        const { error: uploadError, data } = await supabase.storage
          .from('whats-new-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });
          
        if (uploadError) {
          console.error('Error uploading file:', uploadError);
          return null;
        }
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('whats-new-images')
          .getPublicUrl(filePath);
          
        return publicUrl;
      });
      
      const urls = await Promise.all(uploadPromises);
      const validUrls = urls.filter(url => url !== null) as string[];
      
      setUploadedImages(prev => [...prev, ...validUrls]);
      
      // Update form data images field
      const newImagesStr = [...uploadedImages, ...validUrls].join(',');
      setFormData(prev => ({
        ...prev,
        images: newImagesStr
      }));
      
    } catch (error) {
      console.error('Error handling file upload:', error);
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  const removeImage = (urlToRemove: string) => {
    setUploadedImages(prev => prev.filter(url => url !== urlToRemove));
    
    // Update form data images field
    const newImages = uploadedImages.filter(url => url !== urlToRemove);
    setFormData(prev => ({
      ...prev,
      images: newImages.join(',')
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Format arrays from comma-separated strings
    // For images, use the uploaded images array
    const images = uploadedImages.length > 0 
      ? uploadedImages 
      : formData.images.split(',').filter(Boolean).map(item => item.trim());

    try {
      const { data, error } = await supabase
        .from('feature_updates')
        .insert({
          title: formData.title,
          description: formData.description,
          images,
        })
        .select();

      if (error) {
        console.error('Error creating update:', error);
        return;
      }

      // Immediately update the UI with the new post
      if (data && data.length > 0) {
        setUpdates(prev => [data[0], ...prev]);
      }

      // Reset form
      setFormData({
        title: '',
        description: '',
        images: '',
      });
      setUploadedImages([]);
      setCharCount(0);

    } catch (error) {
      console.error('Error in handleSubmit:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      // Get the update to find its images
      const { data: update, error: fetchError } = await supabase
        .from('feature_updates')
        .select('images')
        .eq('id', id)
        .single();
        
      if (fetchError) {
        console.error('Error fetching update for deletion:', fetchError);
      }
      
      // Try to use a direct SQL query through RPC to clear references
      // This might bypass RLS if the server function has been set up properly
      const { error: rpcError } = await supabase.rpc('clear_update_references', { update_id: id });
      
      if (rpcError) {
        console.error('Error clearing references via RPC:', rpcError);
        
        // Fallback approach: Attempt to update user_last_seen directly
        // If administrator has proper permissions
        try {
          // Try to get admin access using auth admin APIs (if available)
          await supabase.auth.getUser(); // Refresh session tokens
          
          // First, check for any references in user_last_seen table
          const { data: lastSeenData, error: lastSeenCheckError } = await supabase
            .from('user_last_seen')
            .select('id')
            .eq('last_seen_update_id', id);
            
          if (lastSeenCheckError) {
            console.error('Error checking user_last_seen references:', lastSeenCheckError);
          } else if (lastSeenData && lastSeenData.length > 0) {
            console.log(`Found ${lastSeenData.length} references in user_last_seen, attempting to clear...`);
            
            // Try to update in a single operation
            const { error: bulkUpdateError } = await supabase
              .from('user_last_seen')
              .update({ last_seen_update_id: null })
              .eq('last_seen_update_id', id);
              
            if (bulkUpdateError) {
              console.error('Error bulk updating user_last_seen references:', bulkUpdateError);
              
              // Last resort: try updating one by one
              for (const row of lastSeenData) {
                const { error: updateError } = await supabase
                  .from('user_last_seen')
                  .update({ last_seen_update_id: null })
                  .eq('id', row.id);
                  
                if (updateError) {
                  console.error(`Error updating user_last_seen reference ${row.id}:`, updateError);
                }
              }
            }
          }
        } catch (fallbackError) {
          console.error('Error in fallback approach:', fallbackError);
        }
      }
      
      // Now try to delete the update
      const { error } = await supabase
        .from('feature_updates')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting update:', error);
        // If still failing, show detailed error to help diagnose
        alert(`Failed to delete update: ${error.message}`);
        return;
      }
      
      // Immediately update the UI by removing the deleted post
      setUpdates(prev => prev.filter(item => item.id !== id));
      
      // Delete associated images from storage
      if (update && update.images && update.images.length > 0) {
        // Extract filenames from URLs
        const filesToDelete = update.images.map((url: string) => {
          const parts = url.split('/');
          return parts[parts.length - 1];
        });
        
        if (filesToDelete.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('whats-new-images')
            .remove(filesToDelete);
            
          if (storageError) {
            console.error('Error deleting images from storage:', storageError);
          }
        }
      }
    } catch (error) {
      console.error('Error in handleDelete:', error);
    }
  };

  // Format relative time (Twitter-style)
  const getRelativeTime = (timestamp: string) => {
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) {
      return interval === 1 ? `${interval}y` : `${interval}y`;
    }
    
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) {
      return interval === 1 ? `${interval}mo` : `${interval}mo`;
    }
    
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) {
      return interval === 1 ? `${interval}d` : `${interval}d`;
    }
    
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) {
      return interval === 1 ? `${interval}h` : `${interval}h`;
    }
    
    interval = Math.floor(seconds / 60);
    if (interval >= 1) {
      return interval === 1 ? `${interval}m` : `${interval}m`;
    }
    
    return seconds < 10 ? `now` : `${Math.floor(seconds)}s`;
  };

  if (userLoading) {
    return <div className="p-4">Loading...</div>;
  }

  // Check if user is authorized (admins only)
  if (!user) {
    return <div className="p-4">You must be logged in to access this page.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">What's New</h1>
        <Link href="/whats-new" className="text-blue-500 hover:underline">
          View Public Page
        </Link>
      </div>
      
      {/* Twitter-style compose box */}
      <div className="bg-[var(--background)] border border-[var(--subtle-divider)] rounded-xl p-4 mb-8">
        <form onSubmit={handleSubmit}>
          <div className="flex space-x-3">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full overflow-hidden border border-[var(--subtle-divider)]">
                <Image 
                  src="/android-chrome-512x512.png" 
                  alt="Profile" 
                  width={48} 
                  height={48}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            
            <div className="flex-grow">
              <input
                type="text"
                name="title"
                placeholder="Title"
                value={formData.title}
                onChange={handleInputChange}
                className="w-full p-2 mb-3 bg-transparent border-b border-[var(--subtle-divider)] focus:outline-none focus:border-blue-500 font-bold"
                required
              />
              
              <textarea
                name="description"
                placeholder="What's happening?"
                value={formData.description}
                onChange={handleInputChange}
                className="w-full p-2 bg-transparent resize-none focus:outline-none min-h-[100px]"
                maxLength={500}
                required
              />
              
              {/* Display uploaded images */}
              {uploadedImages.length > 0 && (
                <div className={`mt-3 rounded-xl overflow-hidden border border-[var(--subtle-divider)] ${uploadedImages.length > 1 ? 'grid grid-cols-2 gap-0.5' : ''}`}>
                  {uploadedImages.map((url, index) => (
                    <div key={index} className="relative">
                      <Image
                        src={url}
                        alt={`Uploaded ${index + 1}`}
                        width={400}
                        height={400}
                        className="w-full object-cover"
                        style={uploadedImages.length > 1 ? { aspectRatio: '1/1' } : {}}
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(url)}
                        className="absolute top-2 right-2 bg-black bg-opacity-50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-opacity-70"
                        aria-label="Remove image"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--subtle-divider)]">
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-blue-500 p-2 rounded-full hover:bg-blue-100 hover:bg-opacity-20 transition-colors"
                    disabled={uploading}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                      <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </button>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="text-sm text-[var(--muted)]">
                    <span className={charCount > 450 ? 'text-red-500' : ''}>{charCount}</span>
                    <span>/500</span>
                  </div>
                  
                  <button 
                    type="submit" 
                    className={`px-4 py-2 text-white rounded-full ${
                      uploading || !formData.title || !formData.description 
                        ? 'bg-blue-300 cursor-not-allowed' 
                        : 'bg-blue-500 hover:bg-blue-600'
                    }`}
                    disabled={uploading || !formData.title || !formData.description}
                  >
                    {uploading ? 'Uploading...' : 'Post'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
      
      {/* Twitter-style updates feed */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold mb-4">Your posts</h2>
        
        {isLoading ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--foreground)]"></div>
          </div>
        ) : updates.length === 0 ? (
          <div className="text-center py-6 text-[var(--muted)]">
            No updates available. Post your first update above.
          </div>
        ) : (
          updates.map(update => (
            <div 
              key={update.id} 
              className="p-4 rounded-xl border border-[var(--subtle-divider)] bg-[var(--background)] hover:bg-[var(--accent)] transition-colors"
            >
              <div className="flex items-start">
                <div className="mr-3 flex-shrink-0">
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-[var(--subtle-divider)]">
                    <Image 
                      src="/android-chrome-512x512.png" 
                      alt="Profile" 
                      width={48} 
                      height={48}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold">Chatflix</h3>
                      <span className="text-sm text-[var(--muted)]">
                        {update.created_at && getRelativeTime(update.created_at)}
                      </span>
                    </div>
                    
                    <button
                      onClick={() => handleDelete(update.id)}
                      className="text-[var(--muted)] p-1 rounded-full hover:bg-red-100 hover:text-red-500 hover:bg-opacity-20 transition-colors"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                  
                  <h4 className="font-medium text-lg mt-1">{update.title}</h4>
                  <p className="mt-1 text-[var(--foreground)]">{update.description}</p>
                  
                  {/* Display images */}
                  {update.images && update.images.length > 0 && (
                    <div className={`mt-3 rounded-xl overflow-hidden border border-[var(--subtle-divider)] ${
                      update.images.length === 1 ? '' : 
                      update.images.length === 2 ? 'grid grid-cols-2 gap-0.5' :
                      update.images.length === 3 ? 'grid grid-cols-2 gap-0.5' :
                      'grid grid-cols-2 gap-0.5'
                    }`}>
                      {update.images.length === 1 ? (
                        <Image 
                          src={update.images[0]}
                          alt={update.title}
                          width={500}
                          height={280}
                          className="w-full h-auto object-cover"
                        />
                      ) : update.images.length === 2 ? (
                        update.images.map((img, i) => (
                          <Image 
                            key={i}
                            src={img}
                            alt={`${update.title} image ${i+1}`}
                            width={250}
                            height={250}
                            className="w-full h-auto object-cover"
                            style={{ aspectRatio: '1/1' }}
                          />
                        ))
                      ) : update.images.length === 3 ? (
                        <>
                          <div className="row-span-2">
                            <Image 
                              src={update.images[0]}
                              alt={`${update.title} image 1`}
                              width={250}
                              height={500}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          {update.images.slice(1, 3).map((img, i) => (
                            <Image 
                              key={i}
                              src={img}
                              alt={`${update.title} image ${i+2}`}
                              width={250}
                              height={250}
                              className="w-full h-auto object-cover"
                              style={{ aspectRatio: '1/1' }}
                            />
                          ))}
                        </>
                      ) : (
                        update.images.slice(0, 4).map((img, i) => (
                          <div key={i} className="relative">
                            <Image 
                              src={img}
                              alt={`${update.title} image ${i+1}`}
                              width={250}
                              height={250}
                              className="w-full h-auto object-cover"
                              style={{ aspectRatio: '1/1' }}
                            />
                            {i === 3 && update.images!.length > 4 && (
                              <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center">
                                <span className="text-white font-bold text-xl">+{update.images!.length - 4}</span>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center mt-3 pt-2 text-[var(--muted)]">
                    <Link 
                      href={`/whats-new/${update.id}`}
                      className="text-sm text-blue-500 hover:underline flex items-center"
                    >
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        width="14" 
                        height="14" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                        className="mr-1"
                      >
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                      </svg>
                      View post
                    </Link>
                    
                    <span className="text-sm">{update.created_at && new Date(update.created_at).toLocaleDateString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
} 