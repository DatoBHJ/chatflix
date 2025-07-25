import { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { clearAllSubscriptionCache } from '@/lib/utils'
import Image from 'next/image'
import { ThemeToggle } from './ThemeToggle'
import {
  User,
  Settings,
  FileText,
  MessageSquare,
  LogOut,
  LifeBuoy,
  Users,
  PaintBucket,
  Database
} from 'lucide-react'
import Link from 'next/link'
import { useHomeStarryNight } from '@/app/hooks/useHomeStarryNight'
import { getSidebarTranslations } from '../lib/sidebarTranslations'

// 다크모드 감지 훅
function useDarkMode() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const updateTheme = () => {
      const root = document.documentElement
      const theme = root.getAttribute('data-theme')
      
      setIsDark(
        theme === 'dark' || 
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) ||
        (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)
      )
    }

    updateTheme()

    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['data-theme'] 
    })

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', updateTheme)

    return () => {
      observer.disconnect()
      mediaQuery.removeEventListener('change', updateTheme)
    }
  }, [])

  return isDark
}

// Export these functions to be used elsewhere
export const fetchUserName = async (userId: string, supabase: any) => {
  try {
    // First try to get name from all_user table
    const { data, error } = await supabase
      .from('all_user')
      .select('name')
      .eq('id', userId)
      .single();

    if (error) {
      // If not found in all_user, use name from auth metadata
      const { data: { user } } = await supabase.auth.getUser();
      return user?.user_metadata?.name || 'You';
    } else if (data) {
      return data.name;
    }
    return 'You';
  } catch (error) {
    console.error('Error fetching user name:', error);
    const { data: { user } } = await supabase.auth.getUser();
    return user?.user_metadata?.name || 'You';
  }
};

export const updateUserName = async (userId: string, userName: string, supabase: any) => {
  try {
    // First update the auth metadata
    const { error: authError } = await supabase.auth.updateUser({
      data: { name: userName }
    });

    if (authError) {
      console.error('Error updating user name in auth:', authError);
      throw new Error(authError.message);
    }

    // Then check if user exists in all_user table
    const { data: userData, error: userCheckError } = await supabase
      .from('all_user')
      .select('id')
      .eq('id', userId)
      .single();

    if (userCheckError && userCheckError.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error checking if user exists:', userCheckError);
      throw new Error(userCheckError.message);
    }

    // If user exists in all_user table, update it
    if (userData) {
      const { error: updateError } = await supabase
        .from('all_user')
        .update({ name: userName })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating user name in all_user:', updateError);
        throw new Error(updateError.message);
      }
    } else {
      // If user doesn't exist in all_user table, insert it
      const { error: insertError } = await supabase
        .from('all_user')
        .insert([{ id: userId, name: userName }]);

      if (insertError) {
        console.error('Error inserting user name to all_user:', insertError);
        throw new Error(insertError.message);
      }
    }

    // 🚀 Immediately update memory bank (runs in the background)
    try {
      const response = await fetch('/api/memory-bank/update-personal-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trigger: 'name_change' }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Personal info memory updated immediately:', result.message);
      } else {
        const error = await response.json();
        console.warn('⚠️ Failed to update memory immediately:', error.message);
        // The overall process continues even if this fails
      }
    } catch (memoryError) {
      console.warn('⚠️ Memory update failed but name change succeeded:', memoryError);
      // Memory update failure does not stop the entire process
    }

    return true;
  } catch (error) {
    console.error('Error updating user name:', error);
    throw error;
  }
};

interface AccountDialogProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
  profileImage?: string | null;
  handleDeleteAllChats?: () => Promise<void>;
}

export function AccountDialog({ user, isOpen, onClose, profileImage: initialProfileImage, handleDeleteAllChats }: AccountDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [showDeactivationOptions, setShowDeactivationOptions] = useState(false)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteReason, setDeleteReason] = useState('')

  const [userName, setUserName] = useState(user?.user_metadata?.name || 'You')
  const [originalUserName, setOriginalUserName] = useState(user?.user_metadata?.name || 'You')
  const [profileImage, setProfileImage] = useState<string | null>(initialProfileImage || null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState('account')
  const [isMobile, setIsMobile] = useState(false)
  const [mobileView, setMobileView] = useState<string | null>(null)
  const isDarkMode = useDarkMode()
  const { isEnabled: isStarryNightEnabled, toggle: toggleStarryNight } = useHomeStarryNight()
  const [translations, setTranslations] = useState({
    profile: 'Profile',
    appearance: 'Appearance',
    dataControls: 'Data Controls',
    settings: 'Settings',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
    starryNightBackground: 'Home Screen Starry Night Effect',
    deleteAllChats: 'Delete All Chats',
    delete: 'Delete',
    deleteAccount: 'Delete Account',
    permanentlyDelete: 'Permanently Delete',
    permanentlyDeleteAccount: 'Permanently Delete Account',
    thisActionCannotBeUndone: 'This action cannot be undone.',
    goBack: 'Go back',
    close: 'Close',
    theNameChatflixWillCallYou: 'The name Chatflix will call you',
    enterYourName: 'Enter your name',
    changeProfilePicture: 'Change profile picture',
    logOut: 'Log Out'
  });

  useEffect(() => {
    setTranslations(getSidebarTranslations());
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (user?.id && isOpen) {
      fetchProfileImage(user.id);
      loadUserName(user.id);
    }
  }, [user?.id, isOpen]);

  // Reset all states when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setShowAdvancedSettings(false);
      setShowDeactivationOptions(false);
      setShowDeleteConfirmation(false);
      setDeleteConfirmText('');
      setDeleteReason('');
      setMobileView(null);
    }
  }, [isOpen]);

  const loadUserName = async (userId: string) => {
    const name = await fetchUserName(userId, supabase);
    setUserName(name);
    setOriginalUserName(name);
  };

  const fetchProfileImage = async (userId: string) => {
    try {
      // Try to get profile image from storage
      const { data: profileData, error: profileError } = await supabase
        .storage
        .from('profile-pics')
        .list(`${userId}`);

      if (profileError) {
        console.error('Error fetching profile image:', profileError);
        return;
      }

      // If profile image exists, get public URL
      if (profileData && profileData.length > 0) {
        try {
          const { data } = supabase
            .storage
            .from('profile-pics')
            .getPublicUrl(`${userId}/${profileData[0].name}`);
          
          setProfileImage(data.publicUrl);
        } catch (error) {
          console.error('Error getting public URL for profile image:', error);
        }
      }
    } catch (error) {
      console.error('Error fetching profile image:', error);
    }
  };



  const handleSignOut = async () => {
    try {
      // Clear subscription cache before signing out
      clearAllSubscriptionCache()
      
      await supabase.auth.signOut()
      router.push('/login')
    } catch (error) {
      console.error('Error signing out:', error)
      alert('Failed to sign out. Please try again.')
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    try {
      setIsUploading(true);

      // Check file size (3MB limit)
      const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB
      if (file.size > MAX_FILE_SIZE) {
        alert("File size should be less than 3MB");
        setIsUploading(false);
        return;
      }

      // Check image extension
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        alert("Please upload a valid image file (JPEG, PNG, GIF, or WEBP)");
        setIsUploading(false);
        return;
      }

      // Function for image compression
      const compressImage = async (file: File, maxSizeMB = 1): Promise<File> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = (event) => {
            const img = document.createElement('img');
            img.src = event.target?.result as string;
            img.onload = () => {
              const canvas = document.createElement('canvas');
              let width = img.width;
              let height = img.height;
              
              // Image size limit
              const MAX_WIDTH = 800;
              const MAX_HEIGHT = 800;
              
              if (width > height) {
                if (width > MAX_WIDTH) {
                  height = Math.round(height * MAX_WIDTH / width);
                  width = MAX_WIDTH;
                }
              } else {
                if (height > MAX_HEIGHT) {
                  width = Math.round(width * MAX_HEIGHT / height);
                  height = MAX_HEIGHT;
                }
              }
              
              canvas.width = width;
              canvas.height = height;
              
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0, width, height);
              
              // Adjust compression quality (0.7 = 70% quality)
              const quality = 0.7;
              canvas.toBlob(
                (blob) => {
                  if (!blob) {
                    reject(new Error('Canvas to Blob conversion failed'));
                    return;
                  }
                  const newFile = new File([blob], file.name, {
                    type: file.type,
                    lastModified: Date.now(),
                  });
                  resolve(newFile);
                },
                file.type,
                quality
              );
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

      // Upload after image compression
      let fileToUpload = file;
      try {
        if (file.size > 1 * 1024 * 1024) { // Compress if larger than 1MB
          fileToUpload = await compressImage(file);
          console.log(`Compressed image from ${file.size} to ${fileToUpload.size} bytes`);
        }
      } catch (compressionError) {
        console.error('Error compressing image:', compressionError);
        // Use original file if compression fails
      }

      // First, remove existing files
      try {
        const { data: existingFiles } = await supabase.storage
          .from('profile-pics')
          .list(`${user.id}`);

        if (existingFiles && existingFiles.length > 0) {
          await supabase.storage
            .from('profile-pics')
            .remove(existingFiles.map(f => `${user.id}/${f.name}`));
        }
      } catch (error) {
        console.error('Error removing existing files:', error);
        // Continue even if removing existing files fails
      }

      // Use authenticated session for upload due to RLS policy
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No active session');
        alert('You must be logged in to upload images');
        setIsUploading(false);
        return;
      }

      // Generate filename with timestamp
      const timestamp = new Date().getTime();
      const fileExt = file.name.split('.').pop();
      const fileName = `profile_${timestamp}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-pics')
        .upload(filePath, fileToUpload, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.error('Error uploading profile image:', uploadError);
        
        // Special handling for RLS policy errors
        if (uploadError.message?.includes('row-level security') || 
            (uploadError as any).statusCode === 403 || 
            uploadError.message?.includes('Unauthorized')) {
          alert("Permission denied. Please contact administrator to set up proper access rights.");
        } else {
          alert(`Failed to upload image: ${uploadError.message || 'Unknown error'}`);
        }
        return;
      }

      // Get URL and cache busting
      const { data } = supabase.storage
        .from('profile-pics')
        .getPublicUrl(filePath);

      if (!data || !data.publicUrl) {
        alert('Failed to get uploaded image URL');
        return;
      }

      const cacheBustedUrl = `${data.publicUrl}?t=${Date.now()}`;
      setProfileImage(cacheBustedUrl);
      
      console.log('Image upload successful');
      
      // 🚀 Immediately update memory on profile image change (optional)
      try {
        const response = await fetch('/api/memory-bank/update-personal-info', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ trigger: 'profile_image' }),
        });

        if (response.ok) {
          console.log('✅ Profile image change reflected in memory');
        }
      } catch (error) {
        console.warn('⚠️ Memory update failed for profile image:', error);
      }
    } catch (error) {
      console.error('Error uploading profile image:', error);
      alert(`Error uploading image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdateUserName = async () => {
    if (!user) return;

    // Don't make an API request if the name hasn't changed
    if (userName.trim() === originalUserName.trim()) {
      return;
    }

    try {
      await updateUserName(user.id, userName, supabase);
      setOriginalUserName(userName); // Update original name on success
    } catch (error) {
      console.error('Error updating user name:', error);
      alert(`Error updating name: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeleteAccount = async () => {
    // Cannot delete if confirmation text is incorrect
    if (deleteConfirmText !== `delete ${user.email}`) {
      alert('Please enter the confirmation text exactly as shown to proceed.');
      return;
    }
    
    // Cannot delete if a reason is not selected
    if (!deleteReason) {
      alert('Please select a reason for deleting your account.');
      return;
    }
    
    setIsDeleting(true)
    try {
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: deleteReason }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        // Handle specific error cases
        if (data.action === 'cancel_subscription' && data.portalUrl) {
          const userConfirmed = confirm(
            `${data.message}\n\nWould you like to open the billing portal to cancel your subscription now?`
          );
          
          if (userConfirmed) {
            window.open(data.portalUrl, '_blank');
          }
          return;
        } else if (data.action === 'contact_support') {
          alert(`${data.message}\n\nPlease contact our support team for assistance.`);
          return;
        }
        
        throw new Error(data.error || 'Failed to delete account')
      }

      // Show success message with any warnings
      let successMessage = data.message || 'Your account has been deleted.';
      if (data.warnings && data.warnings.length > 0) {
        successMessage += '\n\nWarnings:\n' + data.warnings.join('\n');
      }
      
      alert(successMessage);
      router.push('/login')
    } catch (error) {
      console.error('Failed to delete account:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete account. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const renderMobileList = () => {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          <div className="space-y-1">
            <button 
              onClick={() => setMobileView('account')}
              className="w-full flex items-center justify-between p-4 hover:bg-[var(--accent)] rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <User size={20} />
                <span className="text-base">{translations.profile}</span>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            
            <button 
              onClick={() => setMobileView('appearance')}
              className="w-full flex items-center justify-between p-4 hover:bg-[var(--accent)] rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <PaintBucket size={20} />
                <span className="text-base">{translations.appearance}</span>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            

            
            <button 
              onClick={() => setMobileView('data-controls')}
              className="w-full flex items-center justify-between p-4 hover:bg-[var(--accent)] rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <Database size={20} />
                <span className="text-base">{translations.dataControls}</span>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            
            <div className="my-6 h-[1px] bg-[var(--accent)]" />
            
            <button 
              onClick={handleSignOut}
              className="w-full flex items-center justify-between p-4 hover:bg-red-500/10 rounded-lg transition-colors text-red-500"
            >
              <div className="flex items-center gap-3">
                <LogOut size={20} />
                <span className="text-base">{translations.logOut}</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderContentByTab = (tab: string) => {
    switch (tab) {
            case 'account':
        return (
          <div className="p-8 sm:py-20 h-full flex flex-col items-center">
            {/* Profile Section - Centered */}
            <div className="flex flex-col items-center gap-6 w-full max-w-sm">
              {/* Profile Image */}
              <div className="relative group">
                <div className="relative w-24 h-24 rounded-full bg-[var(--foreground)] flex items-center justify-center overflow-hidden">
                  {profileImage ? (
                    <Image src={profileImage} alt={userName} fill sizes="96px" className="object-cover" />
                  ) : (
                    <span className="text-3xl font-bold text-[var(--background)]">{userName.charAt(0).toUpperCase()}</span>
                  )}
                  
                  {isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                
                {/* Edit Button - Bottom right of profile picture */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#007AFF] hover:bg-[#0056CC] rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110"
                  title={translations.changeProfilePicture}
                >
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="white" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path>
                    <circle cx="12" cy="13" r="3"></circle>
                  </svg>
                </button>
                
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
              </div>

              {/* Name Input Area */}
              <div className="w-full">
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full text-xl font-medium text-center bg-[var(--accent)] border border-[var(--accent)] rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:border-transparent transition-all"
                  maxLength={30}
                  onBlur={handleUpdateUserName}
                  onKeyDown={(e) => e.key === 'Enter' && handleUpdateUserName()}
                  placeholder={translations.enterYourName}
                />
                
                {/* Description Text */}
                <p className="text-center text-sm text-[var(--muted)] mt-2">
                  {translations.theNameChatflixWillCallYou}
                </p>
              </div>
            </div>
          </div>
        )
      case 'appearance':
        return (
          <div className="p-6 sm:py-20 h-full flex flex-col">
            <div className="space-y-6">
              {/* Theme Card Section */}
              <div className="grid grid-cols-3 gap-4">
                <button 
                  className="flex flex-col items-center justify-center p-6 bg-[var(--accent)] rounded-2xl border border-[var(--accent)]"
                  onClick={() => {
                    localStorage.setItem('theme', 'light');
                    document.documentElement.setAttribute('data-theme', 'light');
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-2">
                    <circle cx="12" cy="12" r="4"></circle>
                    <path d="M12 2v2"></path>
                    <path d="M12 20v2"></path>
                    <path d="m4.93 4.93 1.41 1.41"></path>
                    <path d="m17.66 17.66 1.41 1.41"></path>
                    <path d="M2 12h2"></path>
                    <path d="M20 12h2"></path>
                    <path d="m6.34 17.66-1.41 1.41"></path>
                    <path d="m19.07 4.93-1.41 1.41"></path>
                  </svg>
                  <span className="text-sm font-medium">{translations.light}</span>
                </button>
                
                <button 
                  className="flex flex-col items-center justify-center p-6 bg-[var(--accent)] rounded-2xl border border-[var(--accent)]"
                  onClick={() => {
                    localStorage.setItem('theme', 'dark');
                    document.documentElement.setAttribute('data-theme', 'dark');
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-2">
                    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
                  </svg>
                  <span className="text-sm font-medium">{translations.dark}</span>
                </button>
                
                <button 
                  className="flex flex-col items-center justify-center p-6 bg-[var(--accent)] rounded-2xl border border-[var(--accent)]"
                  onClick={() => {
                    localStorage.removeItem('theme');
                    document.documentElement.setAttribute('data-theme', 'system');
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-2">
                    <rect width="20" height="14" x="2" y="3" rx="2"></rect>
                    <line x1="8" x2="16" y1="21" y2="21"></line>
                    <line x1="12" x2="12" y1="17" y2="21"></line>
                  </svg>
                  <span className="text-sm font-medium">{translations.system}</span>
                </button>
              </div>
              
              {/* 다크모드일 때만 별 효과 토글 표시 */}
              {isDarkMode && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-base">{translations.starryNightBackground}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isStarryNightEnabled}
                      onChange={toggleStarryNight}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#007AFF] shadow-inner"></div>
                  </label>
                </div>
              )}

            </div>
          </div>
        )

      case 'data-controls':
        return (
          <div className="p-6 sm:py-20 h-full flex flex-col">
            <div className="space-y-6">
                              {handleDeleteAllChats && (
                  <div className="flex items-center justify-between">
                    <h3 className="text-base text-[var(--foreground)]">
                      {translations.deleteAllChats}
                    </h3>
                    <button
                      onClick={handleDeleteAllChats}
                      className="px-4 py-2 bg-[var(--accent)] text-[var(--foreground)] text-sm font-medium rounded-lg"
                    >
                      {translations.delete}
                    </button>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <h3 className="text-base text-[var(--foreground)]">
                    {translations.deleteAccount}
                  </h3>
                  <button
                    onClick={() => setShowDeleteConfirmation(true)}
                    className="px-4 py-2 bg-[var(--accent)] text-red-600 dark:text-red-400 text-sm font-medium rounded-lg"
                  >
                    {translations.permanentlyDelete}
                  </button>
                </div>
            </div>
          </div>
        )
      default:
        return null
    }
  };

  const renderContent = () => {
    return renderContentByTab(activeTab);
  }

  if (!isOpen) return null

  // Account Deletion Confirmation Screen
  if (showDeleteConfirmation) {
    const confirmationText = `delete ${user.email}`;
    return ReactDOM.createPortal(
      <div 
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-hidden backdrop-blur-sm"
        onClick={() => setShowDeleteConfirmation(false)}
      >
        <div 
          className="w-full max-w-lg bg-[var(--background)] rounded-2xl flex flex-col shadow-xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="p-6 border-b border-[var(--accent)]">
            <h2 className="text-lg font-semibold text-red-500">{translations.permanentlyDeleteAccount}</h2>
            <p className="text-sm text-[var(--muted)] mt-1">{translations.thisActionCannotBeUndone}</p>
          </div>
          
          <div className="p-6">
            <div className="mb-6 space-y-4">
              <div className="p-4 bg-red-500/10 text-red-500 text-sm rounded-lg">
                <p>Deleting your account will permanently remove all conversations, subscription information, and data.</p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-[var(--muted)] mb-2">
                    Please select a reason for deletion:
                  </label>
                  <select 
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    className="w-full p-3 bg-[var(--accent)] text-sm rounded-md"
                    required
                  >
                    <option value="">Select...</option>
                    <option value="privacy">Privacy concerns</option>
                    <option value="not_useful">No longer useful</option>
                    <option value="too_expensive">Cost issues</option>
                    <option value="found_alternative">Found an alternative</option>
                    <option value="temporary">Temporary deactivation</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs uppercase tracking-wider text-[var(--muted)] mb-2">
                    To confirm, please type <span className="font-medium text-red-500">{confirmationText}</span>.
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="w-full p-3 bg-[var(--accent)] text-sm rounded-md"
                    placeholder="Enter the text shown above"
                    required
                  />
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirmation(false)}
                className="flex-1 p-3 text-sm bg-[var(--accent)] hover:opacity-90 transition-opacity rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting || deleteConfirmText !== confirmationText || !deleteReason}
                className="flex-1 p-3 text-sm text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 rounded-md"
              >
                {isDeleting ? 'Deleting...' : translations.permanentlyDeleteAccount}
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.getElementById('portal-root')!
    );
  }

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 overflow-hidden backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div 
        className="w-full bg-[var(--background)] flex flex-col shadow-xl overflow-hidden rounded-t-2xl sm:rounded-2xl sm:w-[800px] sm:h-[600px] h-[85vh] border border-[var(--accent)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="sm:hidden text-center pt-4 pb-2 shrink-0">
          <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto" />
        </div>
        
        {/* Mobile Layout */}
        {isMobile ? (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="relative flex items-center justify-center py-4 border-b border-[var(--accent)] shrink-0">
              {mobileView && (
                <button 
                  onClick={() => setMobileView(null)}
                  className="absolute left-4 p-2 hover:bg-[var(--accent)] rounded-lg transition-colors"
                  aria-label={translations.goBack}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5" />
                    <path d="M12 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <h2 className="text-lg font-semibold">
                {mobileView ? 
                  (mobileView === 'account' ? translations.profile :
                   mobileView === 'appearance' ? translations.appearance :
                   mobileView === 'data-controls' ? translations.dataControls : translations.settings)
                  : translations.settings}
              </h2>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {mobileView ? renderContentByTab(mobileView) : renderMobileList()}
            </div>
          </div>
        ) : (
          /* Desktop Layout */
          <div className="flex flex-col sm:flex-row flex-1 min-h-0">
            {/* Sidebar */}
            <div className="w-full sm:w-56 sm:bg-[var(--accent)] p-4 flex flex-col border-b sm:border-b-0 sm:border-r border-[var(--accent)]">
              <h2 className="text-lg font-semibold mb-6 px-2 hidden sm:block">{translations.settings}</h2>
              <nav className="flex sm:flex-col gap-1 overflow-x-auto pb-2 sm:pb-0 -mx-4 px-4">
                <button onClick={() => setActiveTab('account')} className={`flex items-center gap-3 px-2 py-2 rounded-md text-sm shrink-0 ${activeTab === 'account' ? 'bg-[var(--accent)]' : 'hover:bg-[var(--accent)]'}`}>
                  <User size={16} /> <span className="hidden sm:inline">{translations.profile}</span>
                </button>
                <button onClick={() => setActiveTab('appearance')} className={`flex items-center gap-3 px-2 py-2 rounded-md text-sm shrink-0 ${activeTab === 'appearance' ? 'bg-[var(--accent)]' : 'hover:bg-[var(--accent)]'}`}>
                  <PaintBucket size={16} /> <span className="hidden sm:inline">{translations.appearance}</span>
                </button>

                <button onClick={() => setActiveTab('data-controls')} className={`flex items-center gap-3 px-2 py-2 rounded-md text-sm shrink-0 ${activeTab === 'data-controls' ? 'bg-[var(--accent)]' : 'hover:bg-[var(--accent)]'}`}>
                  <Database size={16} /> <span className="hidden sm:inline">{translations.dataControls}</span>
                </button>
              </nav>
              <div className="mt-auto hidden sm:block">
                <button onClick={handleSignOut} className="flex items-center gap-3 px-2 py-2 rounded-md text-sm w-full text-left text-red-500 hover:bg-red-500/10">
                  <LogOut size={16} /> {translations.logOut}
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 flex flex-col overflow-y-auto relative">
              {/* Close Button - Top right */}
              <button 
                onClick={onClose} 
                className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center"
                title={translations.close}
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className="text-[var(--muted)]"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
              
              <div className="flex-1">
                {renderContent()}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )

  // Handle portal usage in SSR environment
  if (typeof window === 'object') {
    const portalRoot = document.getElementById('portal-root');
    if (portalRoot) {
      return ReactDOM.createPortal(modalContent, portalRoot);
    }
  }

  // If document is not available or portal-root is not found (e.g., SSR)
  return modalContent;
} 
