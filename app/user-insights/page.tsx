'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Image from 'next/image';
import { fetchUserName, updateUserName } from '@/app/components/AccountDialog';

export default function UserInsightsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [animateIn, setAnimateIn] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [userName, setUserName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.push('/login');
          return;
        }
        
        setCurrentUserId(user.id);
        const name = await fetchUserName(user.id, supabase);
        setUserName(name);
        await fetchProfileImage(user.id);
        await loadUserInsights(user.id, name);
      } catch (error) {
        console.error('Authentication error:', error);
      } finally {
        setIsLoading(false);
        // Trigger animations after loading
        setTimeout(() => setAnimateIn(true), 100);
      }
    };

    checkAuth();
  }, []);

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

  const handleUpdateUserName = async () => {
    if (!currentUserId) return;

    try {
      await updateUserName(currentUserId, userName, supabase);
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUserId) return;

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
          .list(`${currentUserId}`);

        if (existingFiles && existingFiles.length > 0) {
          await supabase.storage
            .from('profile-pics')
            .remove(existingFiles.map(f => `${currentUserId}/${f.name}`));
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
      const filePath = `${currentUserId}/${fileName}`;

      const { error: uploadError, data: uploadData } = await supabase.storage
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

  const loadUserInsights = async (userId: string, displayName: string) => {
    try {
      // Get user's profile data from active_user_profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('active_user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
        
      if (profileError && profileError.code !== 'PGRST116') { // Ignore "not found" errors
        console.error('Profile data error:', profileError);
      }

      // Get user's chat statistics
      const { data: chatStats, error: chatError } = await supabase.rpc('query_db', {
        sql_query: `
          SELECT 
            COUNT(*) as total_messages,
            COUNT(DISTINCT chat_session_id) as total_sessions,
            COUNT(DISTINCT model) as models_used,
            MIN(created_at) as first_chat,
            MAX(created_at) as last_chat,
            EXTRACT(DAY FROM NOW() - MIN(created_at)) as days_since_first_chat
          FROM messages 
          WHERE user_id = '${userId}'
        `
      });

      if (chatError) {
        console.error('Chat stats error:', chatError);
        return;
      }

      // Get user's percentile rank based on actual message distribution
      const { data: userPercentile, error: percentileError } = await supabase.rpc('query_db', {
        sql_query: `
          WITH user_message_counts AS (
            SELECT 
              user_id,
              COUNT(*) as message_count
            FROM messages
            GROUP BY user_id
          ),
          total_users AS (
            SELECT COUNT(*) as count FROM user_message_counts
          ),
          user_data AS (
            SELECT
              message_count,
              (SELECT count FROM total_users) as total_users
            FROM user_message_counts
            WHERE user_id = '${userId}'
          ),
          user_rank AS (
            SELECT
              COUNT(*) as users_below
            FROM user_message_counts
            WHERE message_count < (SELECT message_count FROM user_data)
          )
          SELECT
            CASE
              WHEN (SELECT message_count FROM user_data) IS NULL THEN 0
              WHEN (SELECT message_count FROM user_data) = 0 THEN 0
              ELSE 
                GREATEST(0.1, 100 - ROUND(
                  (SELECT users_below FROM user_rank)::numeric * 100.0 / 
                  (SELECT total_users FROM user_data)::numeric,
                  1
                ))
            END as top_percentile,
            (SELECT message_count FROM user_data) as message_count,
            (SELECT total_users FROM user_data) as total_users,
            (SELECT users_below FROM user_rank) as users_below
        `
      });

      if (percentileError) {
        console.error('Percentile calculation error:', percentileError);
      }

      // Get user's favorite models
      const { data: modelStats, error: modelError } = await supabase.rpc('query_db', {
        sql_query: `
          SELECT 
            model,
            COUNT(*) as usage_count,
            ROUND(AVG(LENGTH(content))) as avg_response_length
          FROM messages
          WHERE user_id = '${userId}' AND role = 'assistant'
          GROUP BY model
          ORDER BY usage_count DESC
          LIMIT 3
        `
      });

      if (modelError) {
        console.error('Model stats error:', modelError);
        return;
      }

      // Get hour of day activity
      const { data: hourlyStats, error: hourError } = await supabase.rpc('query_db', {
        sql_query: `
          SELECT 
            EXTRACT(HOUR FROM created_at) as hour,
            COUNT(*) as message_count
          FROM messages
          WHERE user_id = '${userId}'
          GROUP BY EXTRACT(HOUR FROM created_at)
          ORDER BY message_count DESC
          LIMIT 1
        `
      });

      if (hourError) {
        console.error('Hourly stats error:', hourError);
        return;
      }
      
      // Get average session length
      const { data: sessionStats, error: sessionError } = await supabase.rpc('query_db', {
        sql_query: `
          WITH session_messages AS (
            SELECT 
              chat_session_id,
              COUNT(*) as message_count
            FROM messages
            WHERE user_id = '${userId}'
            GROUP BY chat_session_id
          )
          SELECT 
            ROUND(AVG(message_count), 1) as avg_session_length,
            MAX(message_count) as longest_session
          FROM session_messages
        `
      });

      if (sessionError) {
        console.error('Session stats error:', sessionError);
        return;
      }
      
      // Get day of week activity for all days
      const { data: allDaysOfWeek, error: allDaysError } = await supabase.rpc('query_db', {
        sql_query: `
          SELECT 
            EXTRACT(DOW FROM created_at) as day_of_week,
            COUNT(*) as message_count
          FROM messages
          WHERE user_id = '${userId}'
          GROUP BY day_of_week
          ORDER BY day_of_week
        `
      });
      
      if (allDaysError) {
        console.error('All days stats error:', allDaysError);
        return;
      }

      // Get weekend vs weekday pattern
      const { data: weekdayPattern, error: weekdayError } = await supabase.rpc('query_db', {
        sql_query: `
          SELECT 
            CASE 
              WHEN EXTRACT(DOW FROM created_at) IN (0, 6) THEN 'weekend'
              ELSE 'weekday'
            END as day_type,
            COUNT(*) as message_count
          FROM messages
          WHERE user_id = '${userId}'
          GROUP BY day_type
        `
      });
      
      if (weekdayError) {
        console.error('Weekday pattern error:', weekdayError);
        return;
      }

      // Get question vs statement ratio
      const { data: questionRatio, error: questionError } = await supabase.rpc('query_db', {
        sql_query: `
          SELECT 
            CASE 
              WHEN content LIKE '%?%' THEN 'question'
              ELSE 'statement'
            END as message_type,
            COUNT(*) as count
          FROM messages
          WHERE user_id = '${userId}' AND role = 'user'
          GROUP BY message_type
        `
      });
      
      if (questionError) {
        console.error('Question ratio error:', questionError);
        return;
      }

      // Get response length distribution
      const { data: responseLengths, error: responseLengthError } = await supabase.rpc('query_db', {
        sql_query: `
          WITH categories AS (
            SELECT 
              CASE 
                WHEN LENGTH(content) < 500 THEN 'short'
                WHEN LENGTH(content) BETWEEN 500 AND 2000 THEN 'medium'
                ELSE 'long'
              END as response_length
            FROM messages
            WHERE user_id = '${userId}' AND role = 'assistant'
          )
          SELECT 
            response_length,
            COUNT(*) as count
          FROM categories
          GROUP BY response_length
          ORDER BY 
            CASE 
              WHEN response_length = 'short' THEN 1
              WHEN response_length = 'medium' THEN 2
              ELSE 3
            END
        `
      });
      
      if (responseLengthError) {
        console.error('Response length error:', responseLengthError);
        return;
      }
      
      // Get model diversity and usage patterns
      const { data: modelDiversity, error: diversityError } = await supabase.rpc('query_db', {
        sql_query: `
          WITH model_diversity AS (
            SELECT 
              COUNT(DISTINCT model) as unique_models,
              COUNT(*) as total_model_messages,
              COUNT(DISTINCT CASE 
                WHEN model LIKE '%gpt-4%' OR model LIKE '%GPT-4%' THEN 'gpt4'
                WHEN model LIKE '%gpt-3.5%' OR model LIKE '%GPT-3.5%' THEN 'gpt35'
                WHEN model LIKE '%claude%' OR model LIKE '%Claude%' THEN 'claude'
                WHEN model LIKE '%palm%' OR model LIKE '%PaLM%' THEN 'palm'
                WHEN model LIKE '%llama%' OR model LIKE '%Llama%' THEN 'llama'
                ELSE model
              END) as model_families_used
            FROM messages
            WHERE user_id = '${userId}' AND role = 'assistant'
          ),
          model_usage AS (
            SELECT 
              model,
              COUNT(*) as usage_count
            FROM messages
            WHERE user_id = '${userId}' AND role = 'assistant'
            GROUP BY model
          ),
          primary_model AS (
            SELECT 
              model,
              usage_count
            FROM model_usage
            ORDER BY usage_count DESC
            LIMIT 1
          )
          SELECT 
            md.unique_models,
            md.model_families_used,
            md.total_model_messages,
            ROUND((md.unique_models::numeric / GREATEST(1, (SELECT COUNT(DISTINCT model) FROM messages WHERE role = 'assistant'))) * 100, 1) as model_exploration_score,
            pm.model as primary_model,
            pm.usage_count as primary_model_count,
            ROUND((pm.usage_count::numeric / md.total_model_messages) * 100, 1) as primary_model_percentage
          FROM model_diversity md, primary_model pm
        `
      });
      
      if (diversityError) {
        console.error('Model diversity error:', diversityError);
        return;
      }
      
      setUserData({
        profileData: profileData || null,
        chatStats: chatStats?.[0] || {},
        modelStats: modelStats || [],
        hourlyStats: hourlyStats?.[0] || {},
        sessionStats: sessionStats?.[0] || {},
        userPercentile: userPercentile?.[0] || { top_percentile: 0 },
        displayName: displayName,
        allDaysOfWeek: allDaysOfWeek || [],
        weekdayPattern: weekdayPattern || [],
        questionRatio: questionRatio || [],
        responseLengths: responseLengths || [],
        modelDiversity: modelDiversity?.[0] || {}
      });
    } catch (error) {
      console.error('Error loading user insights:', error);
      setUserData({
        profileData: null,
        chatStats: {},
        modelStats: [],
        hourlyStats: {},
        sessionStats: {},
        userPercentile: { top_percentile: 0 },
        displayName: displayName,
        allDaysOfWeek: [],
        weekdayPattern: [],
        questionRatio: [],
        responseLengths: [],
        modelDiversity: {}
      });
    }
  };

  // Format date nicely
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    // Convert to local timezone
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
  };

  // Format time with AM/PM
  const formatHour = (hour: number) => {
    // UTC 시간을 사용자의 로컬 시간대로 변환
    const now = new Date();
    now.setUTCHours(hour, 0, 0, 0);
    const localHour = now.getHours();
    
    const period = localHour >= 12 ? 'PM' : 'AM';
    const displayHour = localHour % 12 || 12; // Convert 0 to 12 for 12 AM
    return `${displayHour} ${period}`;
  };

  // Get appropriate emoji for the time of day
  const getTimeEmoji = (hour: number) => {
    // UTC 시간을 사용자의 로컬 시간대로 변환
    const now = new Date();
    now.setUTCHours(hour, 0, 0, 0);
    const localHour = now.getHours();
    
    if (localHour >= 5 && localHour < 12) return '🌅';
    if (localHour >= 12 && localHour < 18) return '☀️';
    if (localHour >= 18 && localHour < 22) return '🌆';
    return '🌙';
  };
  
  // Get day of week name
  const getDayOfWeek = (day: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day];
  };
  
  // Get day of week emoji
  const getDayEmoji = (day: number) => {
    const emojis = ['🌞', '💼', '📊', '📋', '🎯', '🎉', '🏖️'];
    return emojis[day];
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <div className="text-xl mb-4">Creating Your Chatflix Recap</div>
          <div className="relative w-48 h-1 mx-auto overflow-hidden rounded-full bg-[var(--accent)]">
            <div className="absolute top-0 bottom-0 left-0 w-1/2 bg-gradient-to-r from-[var(--foreground)] to-[var(--foreground)] opacity-30 animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-xl">There was a problem loading your data.</div>
      </div>
    );
  }

  // Extract data for easier access
  const { 
    total_messages = 0,
    total_sessions = 0, 
    models_used = 0,
    first_chat,
    last_chat,
    days_since_first_chat = 0
  } = userData.chatStats;
  
  const favoriteModels = userData.modelStats;
  const mostActiveHour = userData.hourlyStats.hour || 12;
  const { avg_session_length = 0, longest_session = 0 } = userData.sessionStats;
  const { top_percentile = 0, message_count = 0 } = userData.userPercentile || {};
  const displayName = userData.displayName || "You";
  
  // Process days of week data
  const allDaysData = userData.allDaysOfWeek || [];
  const daysOfWeekData = Array(7).fill(0);
  const maxDayCount = allDaysData.length > 0 
    ? Math.max(...allDaysData.map((d: any) => parseInt(d.message_count))) 
    : 0;
  
  // Find most active day
  let mostActiveDay = 0;
  let maxCount = 0;
  
  allDaysData.forEach((day: any) => {
    const dayNumber = parseInt(day.day_of_week);
    const count = parseInt(day.message_count);
    daysOfWeekData[dayNumber] = count;
    
    if (count > maxCount) {
      maxCount = count;
      mostActiveDay = dayNumber;
    }
  });
  
  // Process weekday vs weekend data
  const weekdayData = userData.weekdayPattern;
  const weekdayCount = weekdayData.find((item: any) => item.day_type === 'weekday')?.message_count || 0;
  const weekendCount = weekdayData.find((item: any) => item.day_type === 'weekend')?.message_count || 0;
  const totalCount = weekdayCount + weekendCount;
  const weekdayPercentage = totalCount > 0 ? Math.round((weekdayCount / totalCount) * 100) : 0;
  const weekendPercentage = totalCount > 0 ? Math.round((weekendCount / totalCount) * 100) : 0;
  
  // Process question vs statement data
  const questionData = userData.questionRatio;
  const questionCount = questionData.find((item: any) => item.message_type === 'question')?.count || 0;
  const statementCount = questionData.find((item: any) => item.message_type === 'statement')?.count || 0;
  const totalMessageTypes = questionCount + statementCount;
  const questionPercentage = totalMessageTypes > 0 ? Math.round((questionCount / totalMessageTypes) * 100) : 0;
  
  // Process response length data
  const responseLengthData = userData.responseLengths;
  const shortResponses = responseLengthData.find((item: any) => item.response_length === 'short')?.count || 0;
  const mediumResponses = responseLengthData.find((item: any) => item.response_length === 'medium')?.count || 0;
  const longResponses = responseLengthData.find((item: any) => item.response_length === 'long')?.count || 0;
  const totalResponses = shortResponses + mediumResponses + longResponses;
  
  // Model diversity data
  const {
    unique_models = 0,
    model_families_used = 0,
    model_exploration_score = 0,
    primary_model = '',
    primary_model_percentage = 0
  } = userData.modelDiversity || {};
  
  // Calculate model diversity level (for display)
  const getModelDiversityLevel = (score: number) => {
    if (score >= 80) return 'Connoisseur';
    if (score >= 60) return 'Adventurer';
    if (score >= 40) return 'Experimenter';
    if (score >= 20) return 'Casual';
    return 'Loyalist';
  };
  
  const modelDiversityLevel = getModelDiversityLevel(model_exploration_score);

  // 다양성 유형 설명을 위한 함수 추가
  const getModelVarietyDescription = (level: string) => {
    switch(level) {
      case 'Connoisseur':
        return 'You love trying different AI models and have experienced most of what Chatflix offers';
      case 'Adventurer':
        return 'You regularly explore new models and enjoy a wide range of AI experiences';
      case 'Experimenter':
        return 'You occasionally try new models while keeping some favorites';
      case 'Casual':
        return 'You stick with a few models you like but try new ones sometimes';
      case 'Loyalist':
        return 'You have your favorite models and prefer to stick with what works for you';
      default:
        return '';
    }
  };
  
  // Models tried와 AI families 차이 설명을 위한 함수 수정
  const getModelFamilyExplanation = (models: number, families: number) => {
    const diff = models - families;
    if (diff <= 0) {
      if (models > 0 && families > 0) {
        return "You're exploring the core capabilities of each AI family - quality over quantity!";
      }
      return '';
    }
    
    if (diff >= 3) {
      return "You're a Chatflix pioneer! You've been around long enough to experience multiple model versions and updates.";
    } else if (diff > 0) {
      return "You've witnessed model evolutions! Your experience spans across different versions of our AI models.";
    }
    
    return '';
  };

  return (
    <div className="min-h-screen pt-20 sm:pt-24 md:pt-28 pb-10 bg-[var(--background)]">
      {/* Chatflix Logo Header */}
      <div className="max-w-5xl mx-auto px-4 mb-6 sm:mb-8 text-center">
        <div className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 text-[var(--foreground)] tracking-tight uppercase relative inline-block">
          CHATFLIX
          <div className="absolute -top-3 -right-8 bg-[var(--foreground)] text-[var(--background)] text-2xs px-2 py-0.5 rounded-sm transform rotate-12 font-semibold">
            BETA
          </div>
        </div>
        <div className="text-sm sm:text-base text-[var(--muted)]">Your Chatflix Recap</div>
      </div>

      <div className={`max-w-5xl mx-auto px-4 ${animateIn ? 'animate-fade-in' : 'opacity-0'}`} style={{transition: 'all 0.6s ease'}}>
        {/* Hero Banner */}
        <div 
          className="relative overflow-hidden mb-8 sm:mb-12 rounded-xl bg-[var(--accent)]"
          style={{
            backdropFilter: 'blur(10px)'
          }}
        >
          {/* Decorative Background Elements */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-full h-full" 
              style={{background: 'radial-gradient(circle at 30% 30%, var(--foreground), transparent 70%)'}}></div>
            <div className="absolute top-0 left-0 w-full h-full" 
              style={{background: 'radial-gradient(circle at 70% 70%, var(--foreground), transparent 70%)'}}></div>
          </div>

          <div className="relative p-6 sm:p-8 md:p-10 text-center">
            {/* User Profile Section - UPDATED */}
            <div className="mb-6 sm:mb-8">
              <div className="inline-block relative group">
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full bg-[var(--foreground)] flex items-center justify-center overflow-hidden z-10">
                  {profileImage ? (
                    <Image 
                      src={profileImage} 
                      alt="Profile" 
                      fill 
                      className="object-cover"
                    />
                  ) : (
                    <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-[var(--background)]">
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
                  
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    className="hidden"
                    accept="image/*"
                  />
                </div>
                <div className="absolute inset-0 bg-[var(--foreground)] opacity-20 blur-lg rounded-full"></div>
                
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full z-20">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              
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
              <div className="text-xs sm:text-sm text-[var(--muted)]">Chatting since {formatDate(first_chat)}</div>
            </div>

            {/* Hero Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-[var(--background)] p-4 sm:p-6 rounded-xl">
                <div className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 text-[var(--foreground)] tabular-nums">
                  {total_messages.toLocaleString()}
                </div>
                <div className="text-xs sm:text-sm uppercase tracking-wider text-[var(--muted)] truncate">Messages Exchanged</div>
              </div>
              
              <div className="bg-[var(--background)] p-4 sm:p-6 rounded-xl">
                <div className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 text-[var(--foreground)] tabular-nums">
                  {total_sessions}
                </div>
                <div className="text-xs sm:text-sm uppercase tracking-wider text-[var(--muted)] truncate">Conversations Started</div>
              </div>
              
              <div className="bg-[var(--background)] p-4 sm:p-6 rounded-xl">
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 text-[var(--foreground)] tabular-nums" title={modelDiversityLevel}>
                  {modelDiversityLevel}
                </div>
                <div className="text-xs sm:text-sm tracking-wider text-[var(--muted)]">is your AI personality type</div>
              </div>
            </div>

            {/* Top Percentile Badge (only show if in top 50%) */}
            {top_percentile <= 50 && top_percentile > 0 && (
              <div className="mt-6 sm:mt-8 inline-block">
                <div className="bg-[var(--foreground)] text-[var(--background)] px-4 py-2 rounded-full font-bold text-xs sm:text-sm">
                  YOU'RE IN THE TOP {top_percentile}% OF CHATTERS 🏆
                </div>
              </div>
            )}
          </div>
        </div>

        {/* User Profile Insights - MOVED TO TOP */}
        {userData.profileData ? (
          <div className="mb-8 sm:mb-12 rounded-xl overflow-hidden relative bg-[var(--accent)]">
            <div className="absolute top-0 right-0 px-3 py-1 bg-[var(--foreground)] bg-opacity-80 text-[var(--background)] text-xs rounded-bl-lg font-medium">
              Chatflix Analysis
            </div>
            
            <div className="p-5 sm:p-6 relative">
              <div className="flex items-center mb-5 sm:mb-6">
                <div className="text-3xl sm:text-4xl mr-3">🧠</div>
                <h3 className="text-lg sm:text-xl font-bold">Your Chatflix Profile</h3>
              </div>

              {/* Profile Summary - Enhanced */}
              {userData.profileData.profile_summary && (
                <div className="bg-[var(--background)] p-4 rounded-xl mb-4 sm:mb-6 border-l-4 border-[var(--foreground)] border-opacity-40">
                  <h4 className="text-sm font-medium mb-2">Your Chatflix Summary</h4>
                  <p className="text-sm sm:text-base italic font-medium">"{userData.profileData.profile_summary}"</p>
                  <div className="mt-3 text-xs text-[var(--muted)] text-right">
                    Updated: {formatDate(userData.profileData.updated_at)}
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {/* Interests/Topics */}
                <div className="bg-[var(--background)] p-4 rounded-xl">
                  <h4 className="text-sm font-medium mb-3 flex items-center">
                    <span className="w-5 h-5 inline-flex items-center justify-center bg-[var(--foreground)] bg-opacity-80 text-[var(--background)] rounded-full mr-2 text-xs">1</span>
                    Chatflix Interests
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {userData.profileData.profile_data?.topics?.map((topic: string, index: number) => (
                      <div 
                        key={index} 
                        className="px-3 py-1 rounded-full bg-[var(--accent)] text-xs sm:text-sm"
                      >
                        {topic}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Personality Traits */}
                <div className="bg-[var(--background)] p-4 rounded-xl">
                  <h4 className="text-sm font-medium mb-3 flex items-center">
                    <span className="w-5 h-5 inline-flex items-center justify-center bg-[var(--foreground)] bg-opacity-80 text-[var(--background)] rounded-full mr-2 text-xs">2</span>
                    Your Personality
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {userData.profileData.profile_data?.traits?.map((trait: string, index: number) => (
                      <div 
                        key={index} 
                        className="px-3 py-1 rounded-full bg-[var(--accent)] text-xs sm:text-sm"
                      >
                        {trait}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Communication Style */}
                <div className="bg-[var(--background)] p-4 rounded-xl">
                  <h4 className="text-sm font-medium mb-3 flex items-center">
                    <span className="w-5 h-5 inline-flex items-center justify-center bg-[var(--foreground)] bg-opacity-80 text-[var(--background)] rounded-full mr-2 text-xs">3</span>
                    Chatflix Communication Style
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {userData.profileData.profile_data?.patterns?.map((pattern: string, index: number) => (
                      <div 
                        key={index} 
                        className="px-3 py-1 rounded-full bg-[var(--accent)] text-xs sm:text-sm"
                      >
                        {pattern}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Keywords */}
                <div className="bg-[var(--background)] p-4 rounded-xl">
                  <h4 className="text-sm font-medium mb-3 flex items-center">
                    <span className="w-5 h-5 inline-flex items-center justify-center bg-[var(--foreground)] bg-opacity-80 text-[var(--background)] rounded-full mr-2 text-xs">4</span>
                    Your Keywords
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {userData.profileData.profile_data?.keywords?.map((keyword: string, index: number) => (
                      <div 
                        key={index} 
                        className="px-3 py-1 rounded-full bg-[var(--accent)] text-xs sm:text-sm"
                      >
                        {keyword}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="mt-4 text-xs text-[var(--muted)] text-center">
                Based on Chatflix AI analysis of {userData.profileData.analyzed_message_count || 0} messages in your chat history
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-8 sm:mb-12 rounded-xl overflow-hidden relative bg-[var(--accent)] border border-dashed border-[var(--foreground)] border-opacity-30 p-5 sm:p-6 text-center">
            <div className="text-3xl sm:text-4xl mb-3">🧠</div>
            <h3 className="text-lg font-bold mb-2">Your Chatflix Profile is Missing</h3>
            <p className="text-sm mb-4">Chat more with Chatflix to get your personalized profile with interests, traits and custom recommendations!</p>
            <div className="text-xs text-[var(--muted)] max-w-md mx-auto">
              After you have a few Chatflix conversations, our AI will analyze your chat history to create a personalized profile just for you.
            </div>
          </div>
        )}

        {/* Chat Statistics Heading */}
        <div className="text-center mb-6 mt-8">
          <h2 className="text-xl sm:text-2xl font-bold">Chatflix Stats</h2>
          <p className="text-sm text-[var(--muted)]">Your Chatflix activity metrics and insights</p>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-8 sm:mb-12">
          {/* Most Active Time Card */}
          <div 
            className="relative overflow-hidden rounded-xl bg-[var(--accent)]"
          >
            <div className="absolute top-0 right-0 w-40 h-40 opacity-5">
              <div className="absolute inset-0 bg-[var(--foreground)] rounded-full blur-2xl"></div>
            </div>
            
            <div className="p-5 sm:p-6 relative">
              <div className="flex items-center mb-4">
                <div className="text-3xl sm:text-4xl mr-3">{getTimeEmoji(mostActiveHour)}</div>
                <h3 className="text-lg sm:text-xl font-bold">Peak Hours</h3>
              </div>
              
              <div className="mb-5 sm:mb-6">
                <div className="text-4xl sm:text-5xl font-bold mb-2 tabular-nums truncate" title={formatHour(mostActiveHour)}>
                  {formatHour(mostActiveHour)}
                </div>
                <p className="text-xs sm:text-sm text-[var(--muted)] truncate">When you're most active</p>
              </div>
              
              <div className="flex items-center text-xs sm:text-sm text-[var(--muted)]">
                <span className="inline-block w-2 h-2 rounded-full bg-[var(--foreground)] mr-2 animate-pulse"></span>
                <span>Last conversation: {formatDate(last_chat)}</span>
              </div>
            </div>
          </div>

          {/* Session Stats Card */}
          <div 
            className="relative overflow-hidden rounded-xl bg-[var(--accent)]"
          >
            <div className="absolute bottom-0 left-0 w-40 h-40 opacity-5">
              <div className="absolute inset-0 bg-[var(--foreground)] rounded-full blur-2xl"></div>
            </div>
            
            <div className="p-5 sm:p-6 relative">
              <div className="flex items-center mb-4">
                <div className="text-3xl sm:text-4xl mr-3">🔥</div>
                <h3 className="text-lg sm:text-xl font-bold">Chat Highlights</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-2xl sm:text-3xl font-bold mb-1 tabular-nums truncate" title={avg_session_length.toString()}>
                    {avg_session_length}
                  </div>
                  <p className="text-xs sm:text-sm text-[var(--muted)] truncate">Messages per conversation</p>
                </div>
                
                <div>
                  <div className="text-2xl sm:text-3xl font-bold mb-1 tabular-nums truncate" title={longest_session.toString()}>
                    {longest_session}
                  </div>
                  <p className="text-xs sm:text-sm text-[var(--muted)] truncate">Your deepest conversation</p>
                </div>
                
                <div>
                  <div className="text-2xl sm:text-3xl font-bold mb-1 tabular-nums truncate" title={Math.round(total_messages / (days_since_first_chat || 1)).toString()}>
                    {Math.round(total_messages / (days_since_first_chat || 1))}
                  </div>
                  <p className="text-xs sm:text-sm text-[var(--muted)] truncate">Messages Per Day</p>
                </div>
                
                <div>
                  <div className="text-2xl sm:text-3xl font-bold mb-1 tabular-nums truncate" title={Math.floor(days_since_first_chat).toString()}>
                    {Math.floor(days_since_first_chat)}
                  </div>
                  <p className="text-xs sm:text-sm text-[var(--muted)] truncate">Days Since First Chat</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* New Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-8 sm:mb-12">
          {/* Most Active Day Card */}
          <div className="relative overflow-hidden rounded-xl bg-[var(--accent)]">
            <div className="absolute top-0 right-0 w-40 h-40 opacity-5">
              <div className="absolute inset-0 bg-[var(--foreground)] rounded-full blur-2xl"></div>
            </div>
            
            <div className="p-5 sm:p-6 relative">
              <div className="flex items-center mb-4">
                <div className="text-3xl sm:text-4xl mr-3">{getDayEmoji(mostActiveDay)}</div>
                <h3 className="text-lg sm:text-xl font-bold">Your Active Day</h3>
              </div>
              
              <div className="mb-5 sm:mb-6">
                <div className="text-4xl sm:text-5xl font-bold mb-2 truncate" title={getDayOfWeek(mostActiveDay)}>
                  {getDayOfWeek(mostActiveDay)}
                </div>
                <p className="text-xs sm:text-sm text-[var(--muted)] truncate">The day you chat the most</p>
              </div>
              
              {/* New Weekly Activity Chart */}
              <div className="bg-[var(--background)] rounded-xl p-4">
                <h4 className="text-sm font-medium mb-3">Weekly Activity</h4>
                <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                    <div key={index} className="text-center">
                      <div className="text-xs text-[var(--muted)]">{day}</div>
                      <div 
                        className={`mt-1 h-16 sm:h-20 rounded-md relative overflow-hidden ${index === mostActiveDay ? 'bg-[var(--foreground)] bg-opacity-20' : 'bg-[var(--accent)]'}`}
                      >
                        <div 
                          className="absolute bottom-0 w-full bg-[var(--foreground)]"
                          style={{ 
                            height: `${maxDayCount > 0 ? (daysOfWeekData[index] / maxDayCount) * 100 : 0}%`,
                          }}
                        ></div>
                        <div className="absolute bottom-1 inset-x-0 text-center text-xs font-medium">
                          {daysOfWeekData[index] > 0 ? daysOfWeekData[index] : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex justify-between mt-4 text-xs sm:text-sm">
                  <div className="flex items-center">
                    <span className="inline-block w-3 h-3 bg-[var(--foreground)] bg-opacity-20 mr-1 rounded"></span>
                    <span>Most active</span>
                  </div>
                  <div>
                    <span className="font-bold">{weekdayPercentage}%</span> weekday / 
                    <span className="font-bold"> {weekendPercentage}%</span> weekend
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Chat Style Card */}
          <div className="relative overflow-hidden rounded-xl bg-[var(--accent)]">
            <div className="absolute bottom-0 left-0 w-40 h-40 opacity-5">
              <div className="absolute inset-0 bg-[var(--foreground)] rounded-full blur-2xl"></div>
            </div>
            
            <div className="p-5 sm:p-6 relative">
              <div className="flex items-center mb-4">
                <div className="text-3xl sm:text-4xl mr-3">💬</div>
                <h3 className="text-lg sm:text-xl font-bold">Your Chat Style</h3>
              </div>
              
              <div className="mb-5">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm truncate">You ask questions</span>
                  <span className="text-2xl font-bold truncate">{questionPercentage}%</span>
                </div>
                <div className="w-full bg-[var(--background)] h-3 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[var(--foreground)]" 
                    style={{ width: `${questionPercentage}%` }}
                  ></div>
                </div>
                <div className="mt-1 text-xs text-[var(--muted)] line-clamp-2" title={questionPercentage > 50 
                  ? 'You\'re curious! You ask a lot of questions.' 
                  : 'You\'re direct! You make a lot of statements.'}>
                  {questionPercentage > 50 
                    ? 'You\'re curious! You ask a lot of questions.' 
                    : 'You\'re direct! You make a lot of statements.'}
                </div>
              </div>
              
              {/* Communication Style from profile */}
              {userData.profileData?.profile_data?.patterns && userData.profileData.profile_data.patterns.length > 0 && (
                <div className="mt-4 mb-5">
                  <h4 className="font-bold mb-3">Chatflix Communication Style</h4>
                  <div className="bg-[var(--background)] p-3 rounded-xl">
                    <div className="flex flex-wrap gap-2">
                      {userData.profileData.profile_data.patterns.map((pattern: string, index: number) => (
                        <div 
                          key={index} 
                          className="px-3 py-1 rounded-full bg-[var(--accent)] text-xs sm:text-sm"
                        >
                          {pattern}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="mt-6">
                <h4 className="font-bold mb-3">Response Length Preferences</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[var(--background)] p-3 rounded-xl text-center">
                    <div className="text-xl font-bold">
                      {totalResponses > 0 ? Math.round((shortResponses / totalResponses) * 100) : 0}%
                    </div>
                    <div className="text-xs text-[var(--muted)]">Short</div>
                  </div>
                  <div className="bg-[var(--background)] p-3 rounded-xl text-center">
                    <div className="text-xl font-bold">
                      {totalResponses > 0 ? Math.round((mediumResponses / totalResponses) * 100) : 0}%
                    </div>
                    <div className="text-xs text-[var(--muted)]">Medium</div>
                  </div>
                  <div className="bg-[var(--background)] p-3 rounded-xl text-center">
                    <div className="text-xl font-bold">
                      {totalResponses > 0 ? Math.round((longResponses / totalResponses) * 100) : 0}%
                    </div>
                    <div className="text-xs text-[var(--muted)]">Long</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Model Diversity Card - NEW */}
        <div className="mb-8 sm:mb-12 rounded-xl overflow-hidden relative bg-[var(--accent)]">
          <div className="p-5 sm:p-6 relative">
            <div className="flex items-center mb-5 sm:mb-6">
              <div className="text-3xl sm:text-4xl mr-3">🎭</div>
              <h3 className="text-lg sm:text-xl font-bold">Your AI Toolkit</h3>
            </div>
            
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 bg-[var(--background)] p-4 rounded-xl">
                <div className="text-center mb-4">
                  <div className="text-4xl sm:text-5xl font-bold mb-1">{modelDiversityLevel}</div>
                  <div className="text-xs sm:text-sm text-[var(--muted)]">Your versatility type</div>
                </div>
                
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Versatility Score</span>
                    <span>{model_exploration_score}%</span>
                  </div>
                  <div className="h-2 sm:h-2.5 w-full bg-[var(--accent)] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[var(--foreground)]" 
                      style={{ width: `${model_exploration_score}%` }}
                    ></div>
                  </div>
                </div>

                <div className="mb-3 px-1 text-xs">
                  <p>{getModelVarietyDescription(modelDiversityLevel)}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-[var(--accent)] p-2 sm:p-3 rounded-lg">
                    <div className="text-lg sm:text-xl font-bold">{unique_models}</div>
                    <div className="text-xs text-[var(--muted)]">Models tried</div>
                  </div>
                  <div className="bg-[var(--accent)] p-2 sm:p-3 rounded-lg">
                    <div className="text-lg sm:text-xl font-bold">{model_families_used}</div>
                    <div className="text-xs text-[var(--muted)]">AI families</div>
                  </div>
                </div>

                {unique_models > model_families_used && (
                  <div className="mt-3 text-xs px-1 text-[var(--muted)]">
                    {getModelFamilyExplanation(unique_models, model_families_used)}
                  </div>
                )}
              </div>
              
              <div className="flex-1 bg-[var(--background)] p-4 rounded-xl">
                <div className="text-center mb-4">
                  <div className="text-xl sm:text-2xl font-bold mb-1 truncate">{primary_model || "No favorite yet"}</div>
                  <div className="text-xs sm:text-sm text-[var(--muted)]">Your MVP</div>
                </div>
                
                <div className="relative pt-4 pb-2">
                  <div className="w-32 h-32 mx-auto relative">
                    {/* 배경 원 */}
                    <div className="w-full h-full rounded-full border-8 border-[var(--accent)]"></div>
                    
                    {/* 진행도 원 - conic-gradient 사용 */}
                    <div 
                      className="absolute top-4 left-4 right-4 bottom-4 rounded-full"
                      style={{
                        background: `conic-gradient(var(--foreground) 0% ${primary_model_percentage}%, transparent ${primary_model_percentage}% 100%)`,
                      }}
                    ></div>
                    
                    {/* 중앙 원형 배경 (donut 형태를 위함) */}
                    <div className="absolute top-[calc(50%-20px)] left-[calc(50%-20px)] w-10 h-10 bg-[var(--background)] rounded-full flex items-center justify-center">
                      <div className="text-lg sm:text-xl font-bold">{primary_model_percentage}%</div>
                    </div>
                  </div>
                  
                  <div className="mt-4 text-center text-xs text-[var(--muted)]">
                    {primary_model_percentage > 75 
                      ? "You're very loyal to your favorite!" 
                      : primary_model_percentage > 50 
                      ? "You have a clear favorite but like variety too."
                      : "You enjoy a diverse cast of AI models."}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Favorite Models */}
        <div 
          className="mb-8 sm:mb-12 rounded-xl overflow-hidden relative bg-[var(--accent)]"
        >
          <div className="p-5 sm:p-6 relative">
            <div className="flex items-center mb-5 sm:mb-6">
              <div className="text-3xl sm:text-4xl mr-3">🌟</div>
              <h3 className="text-lg sm:text-xl font-bold">Your Dream Team</h3>
            </div>
            
            {favoriteModels.length > 0 ? (
              <div className="space-y-4">
                {favoriteModels.map((model: any, index: number) => (
                  <div 
                    key={index} 
                    className="flex items-center p-3 sm:p-4 rounded-xl bg-[var(--background)]"
                  >
                    <div 
                      className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center mr-3 sm:mr-5 relative"
                      style={{ 
                        background: 'var(--foreground)',
                        color: 'var(--background)'
                      }}
                    >
                      <span className="font-bold text-lg sm:text-xl">#{index + 1}</span>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-1 gap-1">
                        <p className="font-bold text-base sm:text-lg">{model.model}</p>
                        <div className="text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-full bg-[var(--accent)] inline-block">
                          {model.usage_count} conversations
                        </div>
                      </div>
                      
                      <div className="text-xs sm:text-sm text-[var(--muted)]">
                        Typically writes {model.avg_response_length} characters
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-[var(--muted)]">
                <p className="mb-2">You haven't found your favorites yet</p>
                <p className="text-xs sm:text-sm">Keep exploring to discover your ideal AI companions!</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer with Shareable Badge */}
        <div className="text-center mb-6 sm:mb-10">
          <div 
            className="inline-block py-2 px-4 rounded-full bg-[var(--foreground)] text-[var(--background)] font-bold text-xs sm:text-sm relative overflow-hidden"
          >
            <span className="relative z-10">CHATFLIX • PERSONAL RECAP • {new Date().getFullYear()}</span>
          </div>
        </div>
      </div>

      {/* CSS for custom animations */}
      <style jsx>{`
        @keyframes slideInUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        .text-2xs {
          font-size: 0.625rem;
          line-height: 0.75rem;
        }
      `}</style>
    </div>
  );
} 