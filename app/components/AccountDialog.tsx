import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { getCustomerPortalUrl, checkSubscription } from '@/lib/polar'
import Image from 'next/image'

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
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isManagingSubscription, setIsManagingSubscription] = useState(false)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [showDeactivationOptions, setShowDeactivationOptions] = useState(false)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteReason, setDeleteReason] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [userName, setUserName] = useState(user?.user_metadata?.name || 'You')
  const [profileImage, setProfileImage] = useState<string | null>(initialProfileImage || null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (user && isOpen) {
      checkUserSubscription();
      fetchProfileImage(user.id);
      loadUserName(user.id);
    }
  }, [user, isOpen]);

  // Reset all states when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setShowAdvancedSettings(false);
      setShowDeactivationOptions(false);
      setShowDeleteConfirmation(false);
      setDeleteConfirmText('');
      setDeleteReason('');
    }
  }, [isOpen]);

  const loadUserName = async (userId: string) => {
    const name = await fetchUserName(userId, supabase);
    setUserName(name);
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

  const checkUserSubscription = async () => {
    if (!user) return;
    
    try {
      const hasSubscription = await checkSubscription(user.id, user.email || '');
      setIsSubscribed(hasSubscription);
    } catch (error) {
      // console.error('Error checking subscription:', error);
      setIsSubscribed(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!user) return;
    
    setIsManagingSubscription(true);
    try {
      const portalUrl = await getCustomerPortalUrl(user.id);
      window.location.href = portalUrl;
    } catch (error) {
      console.error('Error getting customer portal URL:', error);
      alert('Failed to access subscription management. Please try again.');
    } finally {
      setIsManagingSubscription(false);
    }
  };

  const handleSignOut = async () => {
    try {
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

      // 파일 크기 체크 (3MB 제한)
      const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB
      if (file.size > MAX_FILE_SIZE) {
        alert("File size should be less than 3MB");
        setIsUploading(false);
        return;
      }

      // 이미지 확장자 체크
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        alert("Please upload a valid image file (JPEG, PNG, GIF, or WEBP)");
        setIsUploading(false);
        return;
      }

      // 이미지 압축을 위한 함수
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
              
              // 이미지 크기 제한
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
              
              // 압축 품질 조정 (0.7 = 70% 품질)
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

      // 이미지 압축 후 업로드
      let fileToUpload = file;
      try {
        if (file.size > 1 * 1024 * 1024) { // 1MB 이상이면 압축
          fileToUpload = await compressImage(file);
          console.log(`Compressed image from ${file.size} to ${fileToUpload.size} bytes`);
        }
      } catch (compressionError) {
        console.error('Error compressing image:', compressionError);
        // 압축 실패 시 원본 파일 사용
      }

      // 먼저 기존 파일 제거
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
        // 기존 파일 제거 실패해도 계속 진행
      }

      // RLS 정책 때문에 인증 세션을 통한 업로드 사용
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No active session');
        alert('You must be logged in to upload images');
        setIsUploading(false);
        return;
      }

      // 타임스탬프로 파일명 생성
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
        
        // RLS 정책 오류 특별 처리
        if (uploadError.message?.includes('row-level security') || 
            (uploadError as any).statusCode === 403 || 
            uploadError.message?.includes('Unauthorized')) {
          alert("Permission denied. Please contact administrator to set up proper access rights.");
        } else {
          alert(`Failed to upload image: ${uploadError.message || 'Unknown error'}`);
        }
        return;
      }

      // URL 가져오기 및 캐시 버스팅
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
    } catch (error) {
      console.error('Error uploading profile image:', error);
      alert(`Error uploading image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdateUserName = async () => {
    if (!user) return;

    try {
      await updateUserName(user.id, userName, supabase);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating user name:', error);
      alert(`Error updating name: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleEditToggle = () => {
    if (isEditing) {
      handleUpdateUserName();
    } else {
      setIsEditing(true);
    }
  };

  const handleDeleteAccount = async () => {
    // 확인 텍스트가 정확하지 않으면 삭제 불가
    if (deleteConfirmText !== `delete ${user.email}`) {
      alert('Please enter the confirmation text exactly as shown to proceed.');
      return;
    }
    
    // 삭제 이유를 선택하지 않으면 삭제 불가
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
        throw new Error(data.error || 'Failed to delete account')
      }

      alert(data.message || 'Your account has been deleted.')
      router.push('/login')
    } catch (error) {
      console.error('Failed to delete account:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete account. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  if (!isOpen) return null

  // 계정 삭제 확인 화면
  if (showDeleteConfirmation) {
    return (
      <div 
        className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-hidden backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) setShowDeleteConfirmation(false)
        }}
      >
        <div className="w-full max-w-2xl bg-[var(--background)] h-full flex flex-col shadow-xl">
          <div className="pt-12 px-6 pb-6 border-b border-[var(--accent)]">
            <h2 className="w-full h-[46px] flex items-center justify-center text-sm uppercase tracking-wider text-red-500">Permanently Delete Account</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              <div className="mb-8 space-y-6">
                <div className="p-4 bg-red-500/10 text-red-500 text-sm">
                  <p className="font-medium mb-2">Warning: This action cannot be undone</p>
                  <p>Deleting your account will:</p>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>Permanently delete all your conversations</li>
                    <li>Cancel any active subscriptions</li>
                    <li>Remove all your data from our servers</li>
                    <li>Prevent you from recovering this account</li>
                  </ul>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[var(--muted)] mb-2">
                      Please select a reason for deleting your account:
                    </label>
                    <select 
                      value={deleteReason}
                      onChange={(e) => setDeleteReason(e.target.value)}
                      className="w-full p-3 bg-[var(--accent)] text-sm"
                      required
                    >
                      <option value="">Select a reason...</option>
                      <option value="privacy">Privacy concerns</option>
                      <option value="not_useful">Not useful for me</option>
                      <option value="too_expensive">Too expensive</option>
                      <option value="found_alternative">Found an alternative</option>
                      <option value="temporary">Temporary break</option>
                      <option value="other">Other reason</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[var(--muted)] mb-2">
                      To confirm, please type <span className="font-medium text-red-500">{`delete ${user.email}`}</span>
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      className="w-full p-3 bg-[var(--accent)] text-sm"
                      placeholder="Type the confirmation text"
                      required
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeleting || deleteConfirmText !== `delete ${user.email}` || !deleteReason}
                  className="w-full p-4 text-xs uppercase tracking-wider text-red-500 bg-red-500/10 
                           hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Permanently Delete My Account'}
                </button>
                
                <button
                  onClick={() => setShowDeleteConfirmation(false)}
                  className="w-full p-4 text-xs uppercase tracking-wider bg-[var(--accent)] hover:opacity-90 transition-opacity"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 기본 계정 설정 화면
  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-hidden backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-2xl bg-[var(--background)] h-full flex flex-col shadow-xl">
        {/* Fixed Header */}
        <div className="pt-12 px-6 pb-6 border-b border-[var(--accent)]">
          <h2 className="w-full h-[46px] flex items-center justify-center text-sm uppercase tracking-wider hover:text-[var(--muted)] transition-colors">Account Settings</h2>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* User Info */}
            <div className="mb-8">
              <div className="space-y-6">
                <div className="flex flex-col items-center gap-4">
                  {/* 프로필 이미지 섹션 - user-insights/page.tsx 스타일 적용 */}
                  <div className="inline-block relative group">
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[var(--foreground)] flex items-center justify-center overflow-hidden z-10">
                      {profileImage ? (
                        <Image 
                          src={profileImage} 
                          alt={userName} 
                          fill 
                          sizes="96px"
                          className="object-cover"
                        />
                      ) : (
                        <span className="text-3xl font-bold text-[var(--background)]">
                          {userName.charAt(0).toUpperCase()}
                        </span>
                      )}
                      
                      {/* Edit overlay */}
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <span className="text-white text-xs">Change</span>
                      </div>
                    </div>
                    <div className="absolute inset-0 bg-[var(--foreground)] opacity-20 blur-lg rounded-full"></div>
                    
                    {isUploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full z-20">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      className="hidden"
                      accept="image/*"
                    />
                  </div>
                  
                  {/* 이름 편집 섹션 - user-insights/page.tsx 스타일 적용 */}
                  <div className="mt-4 flex items-center justify-center">
                    {isEditing ? (
                      <input
                        type="text"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        className="text-xl sm:text-2xl font-bold bg-transparent border-b border-[var(--foreground)] text-center focus:outline-none"
                        autoFocus
                        maxLength={30}
                      />
                    ) : (
                      <h2 className="text-xl sm:text-2xl font-bold">{userName}</h2>
                    )}
                    
                    <button 
                      onClick={handleEditToggle}
                      className="ml-2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                    >
                      {isEditing ? "✓" : "✎"}
                    </button>
                  </div>
                  <div className="text-sm text-[var(--muted)]">{user.email}</div>
                </div>
                <div className="h-[1px] bg-[var(--accent)]" />
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Actions</div>
                </div>
              </div>
            </div>

            {/* Account Actions */}
            <div className="space-y-2">
              <button
                onClick={handleSignOut}
                className="w-full p-4 text-xs uppercase tracking-wider bg-[var(--accent)] hover:opacity-90 transition-opacity"
              >
                Sign Out
              </button>
              
              {/* Done button */}
              <button
                onClick={onClose}
                className="w-full mt-4 p-4 text-xs uppercase tracking-wider 
                         bg-[var(--foreground)] text-[var(--background)] 
                         hover:opacity-90 transition-opacity"
              >
                Done
              </button>
              
              {/* Advanced Settings Toggle */}
              <div className="mt-16 text-center">
                <button 
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  {showAdvancedSettings ? 'Hide Advanced Settings' : 'Show Advanced Settings'}
                </button>
              </div>
              
              {/* Advanced Settings Section */}
              {showAdvancedSettings && (
                <div className="mt-4 pt-4 border-t border-[var(--accent)]">
                  <div className="space-y-4">
                    {/* 구독 관리 버튼 */}
                    {isSubscribed && (
                      <button
                        onClick={handleManageSubscription}
                        disabled={isManagingSubscription}
                        className="w-full p-3 text-xs text-[var(--muted)] bg-[var(--background)] border border-[var(--accent)] hover:bg-[var(--accent)] transition-colors"
                      >
                        {isManagingSubscription ? 'Loading...' : 'Manage Billing Settings'}
                      </button>
                    )}
                    
                    {/* 모든 채팅 삭제 버튼 */}
                    {handleDeleteAllChats && (
                      <button
                        onClick={handleDeleteAllChats}
                        className="w-full p-3 text-xs text-red-500 hover:text-red-700 bg-[var(--background)] border border-[var(--accent)] hover:bg-[var(--accent)] transition-colors flex items-center justify-center gap-2"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M3 6h18" />
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                        <span>Delete All Chats</span>
                      </button>
                    )}
                    
                    {/* 계정 삭제 버튼 */}
                    <button
                      onClick={() => setShowDeleteConfirmation(true)}
                      className="w-full p-3 text-xs text-[var(--muted)] bg-[var(--background)] border border-[var(--accent)] hover:bg-[var(--accent)] transition-colors"
                    >
                      Delete Account
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 