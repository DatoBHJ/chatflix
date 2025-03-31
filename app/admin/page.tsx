'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MODEL_CONFIGS, ModelConfig, RATE_LIMITS } from '@/lib/models/config';
import { supabase } from '@/lib/supabase';
import ModelStatsSummary from './components/ModelStatsSummary';
import RateLimitDetails from './components/RateLimitDetails';
import Link from 'next/link';
import { toast } from 'sonner';

// Admin Supabase ID
const ADMIN_ID = '9b682bce-11c0-4373-b954-08ec55731312';

export default function AdminModelsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState('level3');
  const [filterProvider, setFilterProvider] = useState<string | null>(null);
  const [models, setModels] = useState(MODEL_CONFIGS);
  const [searchTerm, setSearchTerm] = useState('');
  const [isGeneratingProfiles, setIsGeneratingProfiles] = useState(false);
  const [isUpdatingProfiles, setIsUpdatingProfiles] = useState(false);
  const [isSettingUpSchedule, setIsSettingUpSchedule] = useState(false);
  const [batchSize, setBatchSize] = useState(5);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [hasMoreUsers, setHasMoreUsers] = useState(false);
  const [isAutoBatchMode, setIsAutoBatchMode] = useState(false);
  const [autoBatchProgress, setAutoBatchProgress] = useState<{current: number, total: number} | null>(null);
  const [updateTimer, setUpdateTimer] = useState<NodeJS.Timeout | null>(null);
  const router = useRouter();

  // 클라이언트 측 진행 업데이트 타이머 상태 추가
  useEffect(() => {
    return () => {
      if (updateTimer) {
        clearInterval(updateTimer);
      }
    };
  }, [updateTimer]);

  // 프로필 생성 함수
  const generateProfiles = async (autoMode = false) => {
    // 이전 타이머가 있으면 정리
    if (updateTimer) {
      clearInterval(updateTimer);
      setUpdateTimer(null);
    }
    
    try {
      // 자동 모드 시작 전에 UI 상태 리셋
      if (autoMode) {
        setIsAutoBatchMode(true);
        
        // 초기 진행 상태 설정 (0/total)
        setAutoBatchProgress({
          current: 0,
          total: 100 // 임시 값, API 응답 후 업데이트됨
        });
        console.log("자동 모드 활성화: 진행 상태 초기화");
        
        // 진행 상태 주기적 업데이트를 위한 타이머 시작 (1초마다)
        const timer = setInterval(() => {
          setAutoBatchProgress(prev => {
            if (!prev) return null;
            // 작은 증가를 통해 진행 중임을 시각적으로 표시 (서버 응답이 느릴 경우)
            return { ...prev, current: prev.current + 0.1 };
          });
        }, 1000);
        setUpdateTimer(timer);
      }
      
      setIsGeneratingProfiles(true);
      
      const response = await fetch('/api/admin/profiles/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          batch_size: batchSize,
          offset: currentOffset,
          auto_batch: autoMode // 서버 측 자동 배치 처리 활성화
        })
      });
      
      // 타이머 정리
      if (updateTimer) {
        clearInterval(updateTimer);
        setUpdateTimer(null);
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("API 응답 오류:", errorText);
        toast.error(`프로필 생성 실패: ${response.status} ${response.statusText}`);
        setIsAutoBatchMode(false);
        setAutoBatchProgress(null);
        setIsGeneratingProfiles(false);
        return;
      }
      
      const result = await response.json();
      console.log("API 응답 결과:", JSON.stringify(result, null, 2)); // 전체 결과 객체 로깅
      
      // 다음 배치를 위한 정보 업데이트
      if (result.pagination) {
        const newOffset = result.pagination.next_offset || 0;
        const totalCount = result.pagination.total_users || 0;
        
        // UI 상태 업데이트
        setTotalUsers(totalCount);
        setHasMoreUsers(result.pagination.has_more);
        setCurrentOffset(newOffset);
        
        // 진행 상황 계산 및 업데이트
        const processedCount = typeof result.pagination.processed_users === 'number' 
          ? result.pagination.processed_users 
          : Math.min(currentOffset + (result.processed || 0), totalCount);
        
        console.log(`진행 상황 업데이트: ${processedCount}/${totalCount} (${Math.round((processedCount/totalCount)*100)}%)`);
        
        // 두 가지 방법으로 상태 업데이트
        // 1. 새 객체를 생성하여 참조 변경 확실히 함
        const newProgress = {
          current: processedCount,
          total: totalCount
        };
        
        // 2. 상태 업데이트 함수로 이전 상태와 확실히 다름을 보장
        setAutoBatchProgress(() => newProgress);
        
        // 모든 배치가 처리되었는지 확인 (has_more가 false이거나 모든 사용자가 처리됨)
        if (!result.pagination.has_more || processedCount >= totalCount) {
          toast.success("모든 배치 처리가 완료되었습니다!");
          
          // 타이머 정리
          if (updateTimer) {
            clearInterval(updateTimer);
            setUpdateTimer(null);
          }
          
          // 약간의 지연 후에 상태 초기화 (완료 메시지 표시 후)
          setTimeout(() => {
            setIsAutoBatchMode(false);
            setAutoBatchProgress(null);
            setIsGeneratingProfiles(false);
          }, 1000);
          
          // 더 이상 처리할 배치가 없음을 명확히 표시
          return;
        }
      }
      
      toast.success(`프로필 생성 완료: ${result.processed}개 처리, ${result.skipped}개 건너뜀, ${result.failed.length}개 실패`);
      
      // 자동 모드이고 더 처리할 배치가 있고 클라이언트 측 자동 배치 모드인 경우 다음 배치 처리
      if ((autoMode || isAutoBatchMode) && result.pagination && result.pagination.has_more && !autoMode) {
        // 잠시 지연 후 다음 배치 처리 (API 과부하 방지)
        setTimeout(() => {
          generateProfiles(true);
        }, 1000);
      }
    } catch (error) {
      console.error('Error generating profiles:', error);
      toast.error('프로필 생성 중 오류가 발생했습니다.');
      
      // 타이머 정리
      if (updateTimer) {
        clearInterval(updateTimer);
        setUpdateTimer(null);
      }
      
      setIsAutoBatchMode(false);
      setAutoBatchProgress(null);
      setIsGeneratingProfiles(false);
    } finally {
      // autoMode가 false이고 isAutoBatchMode도 false인 경우만 로딩 상태 해제
      if (!isAutoBatchMode && !autoMode) {
        setIsGeneratingProfiles(false);
      }
    }
  };
  
  // 다음 배치 처리 함수
  const processNextBatch = () => {
    if (hasMoreUsers) {
      generateProfiles();
    } else {
      toast.info('모든 사용자가 처리되었습니다.');
      // 처리가 끝나면 오프셋 초기화
      setCurrentOffset(0);
    }
  };
  
  // 모든 배치 자동 처리 함수
  const processAllBatches = () => {
    // 처음부터 시작
    setCurrentOffset(0);
    generateProfiles(true);
  };
  
  // 자동 배치 처리 중단 함수 개선
  const stopAutoBatchProcessing = () => {
    console.log("자동 배치 처리 중단");
    
    // 타이머 정리
    if (updateTimer) {
      clearInterval(updateTimer);
      setUpdateTimer(null);
    }
    
    setIsAutoBatchMode(false);
    
    // 잠시 후 나머지 상태 초기화 (상태 변화가 확실히 렌더링되도록)
    setTimeout(() => {
      setAutoBatchProgress(null);
      setIsGeneratingProfiles(false);
      setIsUpdatingProfiles(false);
      toast.info('자동 배치 처리가 중단되었습니다.');
    }, 100);
  };
  
  // 배치 처리 초기화 함수 개선
  const resetBatchProcessing = () => {
    console.log("배치 처리 초기화");
    // 모든 상태 초기화
    setCurrentOffset(0);
    setTotalUsers(0);
    setHasMoreUsers(false);
    setAutoBatchProgress(null);
    setIsAutoBatchMode(false);
    setIsGeneratingProfiles(false);
    setIsUpdatingProfiles(false);
    toast.info('배치 처리 상태가 초기화되었습니다.');
  };
  
  // 프로필 업데이트 함수
  const updateProfiles = async (autoMode = false) => {
    // 이전 타이머가 있으면 정리
    if (updateTimer) {
      clearInterval(updateTimer);
      setUpdateTimer(null);
    }
    
    try {
      // 자동 모드 시작 전에 UI 상태 리셋
      if (autoMode) {
        setIsAutoBatchMode(true);
        
        // 초기 진행 상태 설정 (0/total)
        setAutoBatchProgress({
          current: 0,
          total: 100 // 임시 값, API 응답 후 업데이트됨
        });
        console.log("자동 모드 활성화: 진행 상태 초기화");
        
        // 진행 상태 주기적 업데이트를 위한 타이머 시작 (1초마다)
        const timer = setInterval(() => {
          setAutoBatchProgress(prev => {
            if (!prev) return null;
            // 작은 증가를 통해 진행 중임을 시각적으로 표시 (서버 응답이 느릴 경우)
            return { ...prev, current: prev.current + 0.1 };
          });
        }, 1000);
        setUpdateTimer(timer);
      }
      
      setIsUpdatingProfiles(true);
      
      const response = await fetch('/api/admin/profiles/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          min_new_messages: 20,
          batch_size: batchSize,
          offset: currentOffset,
          auto_batch: autoMode // 서버 측 자동 배치 처리 활성화
        })
      });
      
      // 타이머 정리
      if (updateTimer) {
        clearInterval(updateTimer);
        setUpdateTimer(null);
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("API 응답 오류:", errorText);
        toast.error(`프로필 업데이트 실패: ${response.status} ${response.statusText}`);
        setIsAutoBatchMode(false);
        setAutoBatchProgress(null);
        setIsUpdatingProfiles(false);
        return;
      }
      
      const result = await response.json();
      console.log("API 응답 결과:", JSON.stringify(result, null, 2)); // 전체 결과 객체 로깅
      
      // 다음 배치를 위한 정보 업데이트
      if (result.pagination) {
        const newOffset = result.pagination.next_offset || 0;
        const totalCount = result.pagination.total_users || 0;
        
        // UI 상태 업데이트
        setTotalUsers(totalCount);
        setHasMoreUsers(result.pagination.has_more);
        setCurrentOffset(newOffset);
        
        // 진행 상황 계산 및 업데이트
        const processedCount = typeof result.pagination.processed_users === 'number'
          ? result.pagination.processed_users 
          : Math.min(currentOffset + (result.processed || 0), totalCount);
        
        console.log(`진행 상황 업데이트: ${processedCount}/${totalCount} (${Math.round((processedCount/totalCount)*100)}%)`);
        
        // 두 가지 방법으로 상태 업데이트
        // 1. 새 객체를 생성하여 참조 변경 확실히 함
        const newProgress = {
          current: processedCount,
          total: totalCount
        };
        
        // 2. 상태 업데이트 함수로 이전 상태와 확실히 다름을 보장
        setAutoBatchProgress(() => newProgress);
        
        // 모든 배치가 처리되었는지 확인 (has_more가 false이거나 모든 사용자가 처리됨)
        if (!result.pagination.has_more || processedCount >= totalCount) {
          toast.success("모든 배치 처리가 완료되었습니다!");
          
          // 타이머 정리
          if (updateTimer) {
            clearInterval(updateTimer);
            setUpdateTimer(null);
          }
          
          // 약간의 지연 후에 상태 초기화 (완료 메시지 표시 후)
          setTimeout(() => {
            setIsAutoBatchMode(false);
            setAutoBatchProgress(null);
            setIsUpdatingProfiles(false);
          }, 1000);
          
          // 더 이상 처리할 배치가 없음을 명확히 표시
          return;
        }
      }
      
      toast.success(`프로필 업데이트 완료: ${result.processed}개 처리, ${result.skipped}개 건너뜀, ${result.failed.length}개 실패`);
      
      // 자동 모드이고 더 처리할 배치가 있고 클라이언트 측 자동 배치 모드인 경우 다음 배치 처리
      if ((autoMode || isAutoBatchMode) && result.pagination && result.pagination.has_more && !autoMode) {
        // 잠시 지연 후 다음 배치 처리 (API 과부하 방지)
        setTimeout(() => {
          updateProfiles(true);
        }, 1000);
      }
    } catch (error) {
      console.error('Error updating profiles:', error);
      toast.error('프로필 업데이트 중 오류가 발생했습니다.');
      setIsAutoBatchMode(false);
      setAutoBatchProgress(null);
      setIsUpdatingProfiles(false);
    } finally {
      // autoMode가 false이고 isAutoBatchMode도 false인 경우만 로딩 상태 해제
      if (!isAutoBatchMode && !autoMode) {
        setIsUpdatingProfiles(false);
      }
    }
  };
  
  // 모든 프로필 업데이트 배치 자동 처리
  const updateAllProfiles = () => {
    // 처음부터 시작
    setCurrentOffset(0);
    updateProfiles(true);
  };
  
  // 스케줄 설정 함수
  const setupSchedule = async () => {
    try {
      setIsSettingUpSchedule(true);
      
      const response = await fetch('/api/admin/profiles/setup-schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ 
          type: "both", // 모든 타입의 스케줄 생성
          generate_cron: "0 2 * * 1", // 매주 월요일 새벽 2시 (프로필 생성)
          update_cron: "0 3 * * 1" // 매주 월요일 새벽 3시 (프로필 업데이트)
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        toast.success(`스케줄 설정 완료: ${result.schedules.length}개 스케줄 생성됨`);
        // 생성된 스케줄 정보 표시
        result.schedules.forEach((schedule: any) => {
          toast.info(`${schedule.type === 'generate' ? '프로필 생성' : '프로필 업데이트'} 스케줄: ${schedule.schedule_id}`);
        });
      } else {
        toast.error(`스케줄 설정 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('Error setting up schedule:', error);
      toast.error('스케줄 설정 중 오류가 발생했습니다.');
    } finally {
      setIsSettingUpSchedule(false);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        console.log("Current user:", user);
        
        // Set current user ID for debugging
        setCurrentUserId(user?.id || null);
        
        // TEMPORARY: Allow all users to access the admin page for development
        setIsAuthorized(true);
        
        // Production check - uncomment when deploying
        // if (user?.id === ADMIN_ID) {
        //   setIsAuthorized(true);
        // } else {
        //   router.push('/');
        // }
        
      } catch (error) {
        console.error('Authentication error:', error);
        // Don't redirect for development
        setIsAuthorized(true);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  // Filter models when filters change
  useEffect(() => {
    let filteredModels = [...MODEL_CONFIGS];
    
    // Apply provider filter
    if (filterProvider) {
      filteredModels = filteredModels.filter(model => 
        model.provider.toLowerCase() === filterProvider.toLowerCase()
      );
    }
    
    // Apply search term
    if (searchTerm) {
      filteredModels = filteredModels.filter(model => 
        model.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        model.provider.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setModels(filteredModels);
  }, [filterProvider, searchTerm]);

  // Get unique providers for filter
  const providers = Array.from(new Set(MODEL_CONFIGS.map(model => model.provider)));

  // 진행 상황 폴링 함수
  const pollProgress = async (isGenerate = true) => {
    if (!isAutoBatchMode) return;
    
    try {
      // 현재 진행 상황 가져오기 (API 엔드포인트는 실제 환경에 맞게 수정)
      const response = await fetch(`/api/admin/profiles/${isGenerate ? 'generate' : 'update'}/status`, {
        method: 'GET'
      });
      
      if (response.ok) {
        const result = await response.json();
        
        if (result.isRunning && result.progress) {
          // 폴링 결과로 UI 업데이트
          setAutoBatchProgress({
            current: result.progress.processed,
            total: result.progress.total
          });
          
          console.log(`폴링 결과: ${result.progress.processed}/${result.progress.total}`);
          
          // 처리가 완료되면 자동 모드 종료
          if (result.progress.processed >= result.progress.total) {
            setIsAutoBatchMode(false);
            setAutoBatchProgress(null);
            setIsGeneratingProfiles(false);
            setIsUpdatingProfiles(false);
            toast.success("모든 배치 처리가 완료되었습니다!");
          }
        }
      }
    } catch (error) {
      console.error("진행 상황 폴링 오류:", error);
    }
    
    // 자동 모드가
    if (isAutoBatchMode) {
      // 3초 후 다시 폴링
      setTimeout(() => pollProgress(isGenerate), 3000);
    }
  };
  
  // 자동 모드 상태 변경 시 폴링 시작/중지
  useEffect(() => {
    if (isAutoBatchMode) {
      // 어떤 작업이 진행 중인지 확인하여 해당 폴링 시작
      if (isGeneratingProfiles) {
        pollProgress(true);
      } else if (isUpdatingProfiles) {
        pollProgress(false);
      }
    }
    
    return () => {
      // 컴포넌트 언마운트 또는 상태 변경 시 폴링 관련 타이머 정리
      if (updateTimer) {
        clearInterval(updateTimer);
      }
    };
  }, [isAutoBatchMode, isGeneratingProfiles, isUpdatingProfiles]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  const getLevelDescription = (level: string) => {
    const limits = RATE_LIMITS[level as keyof typeof RATE_LIMITS];
    if (!limits) return 'Unknown limit';
    
    return `${limits.hourly.requests} requests/${limits.hourly.window}, ${limits.daily.requests} requests/${limits.daily.window}`;
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center mb-8">
        <h1 className="text-3xl font-bold mb-4 md:mb-0">Model Management Dashboard</h1>
        <div className="flex space-x-3">
          <Link 
            href="/admin/analytics"
            className="px-4 py-2 rounded transition-colors text-sm"
            style={{ 
              backgroundColor: 'var(--foreground)', 
              color: 'var(--background)'
            }}
          >
            Usage Analytics
          </Link>
        </div>
      </div>
      
      <ModelStatsSummary />

      <div className="my-8 flex flex-wrap gap-3">
        <select 
          value={selectedLevel} 
          onChange={(e) => setSelectedLevel(e.target.value)}
          className="px-3 py-2 rounded border"
          style={{
            backgroundColor: 'var(--background)',
            color: 'var(--foreground)',
            borderColor: 'var(--border)'
          }}
        >
          <option value="level1">Level 1</option>
          <option value="level2">Level 2</option>
          <option value="level3">Level 3</option>
          <option value="level4">Level 4</option>
          <option value="level5">Level 5</option>
        </select>
        
        <select 
          value={filterProvider || ''}
          onChange={(e) => setFilterProvider(e.target.value || null)}
          className="px-3 py-2 rounded border"
          style={{
            backgroundColor: 'var(--background)',
            color: 'var(--foreground)',
            borderColor: 'var(--border)'
          }}
        >
          <option value="">All Providers</option>
          {providers.map(provider => (
            <option key={provider} value={provider}>{provider}</option>
          ))}
        </select>
        
        <input
          type="text"
          placeholder="Search models..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-3 py-2 rounded border"
          style={{
            backgroundColor: 'var(--background)',
            color: 'var(--foreground)',
            borderColor: 'var(--border)'
          }}
        />
      </div>

      <RateLimitDetails level={selectedLevel} />

      <div className="mt-8">
        <h2 className="text-2xl font-semibold mb-4">Model List</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full rounded-lg overflow-hidden shadow-lg" style={{ 
            backgroundColor: 'var(--background)', 
            color: 'var(--foreground)' 
          }}>
            <thead style={{ backgroundColor: 'var(--accent)' }}>
              <tr>
                <th className="px-4 py-3 text-left">Model ID</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Provider</th>
                <th className="px-4 py-3 text-left">Rate Limit</th>
                <th className="px-4 py-3 text-left">Features</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {models.length > 0 ? (
                models.map(model => (
                  <tr key={model.id} className="hover:opacity-90 transition-opacity" 
                      style={{ borderBottom: '1px solid var(--subtle-divider)' }}>
                    <td className="px-4 py-3 font-mono text-sm">{model.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{model.name}</div>
                      {(model.isNew || model.isHot) && (
                        <div className="flex space-x-2 mt-1">
                          {model.isNew && <span className="text-xs px-2 py-1 rounded-full" style={{ 
                            backgroundColor: 'rgba(59, 130, 246, 0.1)', 
                            color: 'rgb(59, 130, 246)' 
                          }}>New</span>}
                          {model.isHot && <span className="text-xs px-2 py-1 rounded-full" style={{ 
                            backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                            color: 'rgb(239, 68, 68)' 
                          }}>Hot</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">{model.provider}</td>
                    <td className="px-4 py-3 uppercase">{model.rateLimit.level}</td>
                    <td className="px-4 py-3">
                      <div className="flex space-x-1">
                        {model.supportsVision && 
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800">Vision</span>}
                        {model.supportsPDFs && 
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800">PDF</span>}
                        {model.isWebSearchEnabled && 
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800">Web</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center">
                        <div className="flex items-center mb-2">
                          <span className={`inline-block w-3 h-3 rounded-full ${model.isEnabled ? 'bg-green-500' : 'bg-red-500'} mr-2`}></span>
                          <span className="text-xs">{model.isEnabled ? 'Enabled' : 'Disabled'}</span>
                        </div>
                        
                        <div className="flex items-center">
                          <span className={`inline-block w-3 h-3 rounded-full ${model.isActivated ? 'bg-blue-500' : 'bg-gray-400'} mr-2`}></span>
                          <span className="text-xs">{model.isActivated ? 'Activated' : 'Deactivated'}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center" style={{ color: 'var(--muted)' }}>
                    No models match the current filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* 사용자 프로필 생성 및 관리 섹션 */}
      <div className="mt-12 mb-8">
        <h2 className="text-2xl font-semibold mb-4">사용자 프로필 관리</h2>
        <div className="p-6 rounded-lg" style={{ backgroundColor: 'var(--accent)', border: '1px solid var(--border)' }}>
          <p className="mb-4">
            이 섹션에서는 사용자 대화 기반 자동 프로필 생성 기능을 관리할 수 있습니다.
          </p>
          
          {/* 배치 설정 UI */}
          <div className="mb-6 p-4 rounded-lg border" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
            <h3 className="text-lg font-medium mb-3">배치 처리 설정</h3>
            
            {isAutoBatchMode && autoBatchProgress && (
              <div className="mb-4 p-3 rounded-lg border" style={{ 
                backgroundColor: 'var(--accent)', 
                borderColor: 'var(--border)',
                animation: 'pulse 2s infinite', // 진행 중임을 알리는 애니메이션 추가
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* 배경 애니메이션 효과 */}
                <div className="absolute inset-0 overflow-hidden z-0" style={{ opacity: 0.2 }}>
                  <div className="animate-flow bg-gradient-to-r from-transparent via-white to-transparent h-full w-[200%]"></div>
                </div>
                
                <div className="relative z-10"> {/* 콘텐츠를 애니메이션 위에 표시 */}
                  <p className="font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                    자동 배치 처리 진행 중 
                    <span className="ml-2 inline-block">
                      {[0, 1, 2].map(i => (
                        <span key={i} className="inline-block w-1 h-1 rounded-full bg-blue-500 mx-0.5"
                          style={{ 
                            animation: `bounce 1s infinite ${i * 0.2}s`,
                            display: 'inline-block'
                          }}></span>
                      ))}
                    </span>
                  </p>
                  
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm" style={{ color: 'var(--foreground)' }}>
                      처리 중: {Math.floor(autoBatchProgress.current)}/{autoBatchProgress.total} 
                      ({Math.round((autoBatchProgress.current/autoBatchProgress.total) * 100)}%)
                    </span>
                    <button
                      onClick={stopAutoBatchProcessing}
                      className="px-2 py-1 rounded text-xs"
                      style={{ backgroundColor: 'var(--foreground)', color: 'var(--background)' }}
                    >
                      중단
                    </button>
                  </div>
                  
                  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full transition-all duration-500 relative"
                      style={{ 
                        width: `${Math.min((autoBatchProgress.current / autoBatchProgress.total) * 100, 100)}%`,
                        background: 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 50%, #3b82f6 100%)',
                        backgroundSize: '200% 100%',
                        animation: 'gradientMove 2s linear infinite'
                      }}
                    >
                      {/* 진행 표시줄 내부의 흐름 효과 */}
                      <div className="absolute inset-0 overflow-hidden">
                        <div className="animate-shimmer bg-gradient-to-r from-transparent via-white to-transparent h-full w-[200%]" style={{ opacity: 0.3 }}></div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <style jsx>{`
                  @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.9; }
                  }
                  @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-3px); }
                  }
                  @keyframes gradientMove {
                    0% { background-position: 0% 0; }
                    100% { background-position: 100% 0; }
                  }
                  @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                  }
                  @keyframes flow {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(0%); }
                  }
                  .animate-shimmer {
                    animation: shimmer 2s infinite linear;
                  }
                  .animate-flow {
                    animation: flow 3s infinite linear;
                  }
                `}</style>
              </div>
            )}
            
            <div className="flex items-center gap-4 mb-2">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--muted)' }}>
                  배치 크기:
                </label>
                <select 
                  value={batchSize} 
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  className="px-3 py-2 rounded border w-24"
                  style={{
                    backgroundColor: 'var(--background)',
                    color: 'var(--foreground)',
                    borderColor: 'var(--border)'
                  }}
                  disabled={isAutoBatchMode}
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="20">20</option>
                </select>
              </div>
              
              {totalUsers > 0 && (
                <div className="text-sm" style={{ color: 'var(--muted)' }}>
                  <p>총 사용자: {totalUsers}명</p>
                  <p>현재 오프셋: {currentOffset}</p>
                  <p>{hasMoreUsers ? '추가 처리 필요' : '모두 처리됨'}</p>
                </div>
              )}
              
              {(totalUsers > 0 && hasMoreUsers) && (
                <button
                  onClick={resetBatchProcessing}
                  disabled={isAutoBatchMode}
                  className="px-3 py-1 rounded text-sm"
                  style={{ 
                    backgroundColor: 'var(--subtle-divider)', 
                    color: 'var(--foreground)',
                    opacity: isAutoBatchMode ? 0.5 : 1,
                    cursor: isAutoBatchMode ? 'not-allowed' : 'pointer'
                  }}
                >
                  초기화
                </button>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="p-4 rounded-lg border shadow-sm" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
              <h3 className="text-lg font-medium mb-2">프로필 생성</h3>
              <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
                대화가 10개 이상인 사용자의 프로필을 생성합니다.
                {hasMoreUsers && ` (${currentOffset}/${totalUsers})`}
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => generateProfiles()}
                  disabled={isGeneratingProfiles || isUpdatingProfiles || isAutoBatchMode}
                  className="w-full px-4 py-2 rounded transition-colors text-sm font-semibold"
                  style={{ 
                    backgroundColor: (isGeneratingProfiles || isUpdatingProfiles || isAutoBatchMode) ? 'var(--muted)' : 'var(--foreground)', 
                    color: 'var(--background)',
                    cursor: (isGeneratingProfiles || isUpdatingProfiles || isAutoBatchMode) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isGeneratingProfiles && !isAutoBatchMode ? '진행 중...' : hasMoreUsers ? `다음 ${batchSize}명 처리` : '프로필 생성'}
                </button>
                
                {!isAutoBatchMode && (
                  <>
                    {hasMoreUsers && (
                      <button
                        onClick={processNextBatch}
                        disabled={isGeneratingProfiles || isUpdatingProfiles}
                        className="w-full px-4 py-2 rounded transition-colors text-sm font-semibold mt-2"
                        style={{ 
                          backgroundColor: (isGeneratingProfiles || isUpdatingProfiles) ? 'var(--muted)' : 'var(--subtle-divider)', 
                          color: 'var(--foreground)',
                          cursor: (isGeneratingProfiles || isUpdatingProfiles) ? 'not-allowed' : 'pointer'
                        }}
                      >
                        다음 배치 처리
                      </button>
                    )}
                    
                    <button
                      onClick={processAllBatches}
                      disabled={isGeneratingProfiles || isUpdatingProfiles}
                      className="w-full px-4 py-2 rounded transition-colors text-sm font-semibold mt-2"
                      style={{ 
                        backgroundColor: (isGeneratingProfiles || isUpdatingProfiles) ? 'var(--muted)' : 'var(--accent)', 
                        color: 'var(--foreground)',
                        cursor: (isGeneratingProfiles || isUpdatingProfiles) ? 'not-allowed' : 'pointer'
                      }}
                    >
                      모든 사용자 자동 처리
                    </button>
                  </>
                )}
              </div>
            </div>
            
            <div className="p-4 rounded-lg border shadow-sm" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
              <h3 className="text-lg font-medium mb-2">프로필 업데이트</h3>
              <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
                새 메시지가 20개 이상인 사용자의 프로필을 업데이트합니다.
                {hasMoreUsers && ` (${currentOffset}/${totalUsers})`}
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => updateProfiles()}
                  disabled={isGeneratingProfiles || isUpdatingProfiles || isAutoBatchMode}
                  className="w-full px-4 py-2 rounded transition-colors text-sm font-semibold"
                  style={{ 
                    backgroundColor: (isGeneratingProfiles || isUpdatingProfiles || isAutoBatchMode) ? 'var(--muted)' : 'var(--foreground)', 
                    color: 'var(--background)',
                    cursor: (isGeneratingProfiles || isUpdatingProfiles || isAutoBatchMode) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isUpdatingProfiles && !isAutoBatchMode ? '진행 중...' : hasMoreUsers ? `다음 ${batchSize}명 처리` : '프로필 업데이트'}
                </button>
                
                {!isAutoBatchMode && (
                  <>
                    <button
                      onClick={updateAllProfiles}
                      disabled={isGeneratingProfiles || isUpdatingProfiles}
                      className="w-full px-4 py-2 rounded transition-colors text-sm font-semibold mt-2"
                      style={{ 
                        backgroundColor: (isGeneratingProfiles || isUpdatingProfiles) ? 'var(--muted)' : 'var(--accent)', 
                        color: 'var(--foreground)',
                        cursor: (isGeneratingProfiles || isUpdatingProfiles) ? 'not-allowed' : 'pointer'
                      }}
                    >
                      모든 사용자 자동 업데이트
                    </button>
                  </>
                )}
              </div>
            </div>
            
            <div className="p-4 rounded-lg border shadow-sm" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
              <h3 className="text-lg font-medium mb-2">스케줄 설정</h3>
              <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
                매주 자동으로 프로필을 생성 및 업데이트하도록 스케줄을 설정합니다.
              </p>
              <div className="space-y-3 mb-4">
                <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--accent)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium">스케줄 정보</span>
                  </div>
                  <ul className="text-xs ml-6 list-disc" style={{ color: 'var(--muted)' }}>
                    <li>프로필 생성: 매주 월요일 새벽 2시 (메시지가 10개 이상인 신규 사용자)</li>
                    <li>프로필 업데이트: 매주 월요일 새벽 3시 (새 메시지가 20개 이상인 기존 사용자)</li>
                    <li>각 스케줄은 자동으로 모든 배치를 처리합니다</li>
                  </ul>
                </div>
              </div>
              <button
                onClick={setupSchedule}
                disabled={isSettingUpSchedule}
                className="w-full px-4 py-2 rounded transition-colors text-sm font-semibold"
                style={{ 
                  backgroundColor: isSettingUpSchedule ? 'var(--muted)' : 'var(--foreground)', 
                  color: 'var(--background)',
                  cursor: isSettingUpSchedule ? 'not-allowed' : 'pointer'
                }}
              >
                {isSettingUpSchedule ? '진행 중...' : '스케줄 설정'}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Display current user ID for debugging */}
      {currentUserId && (
        <div className="mt-8 p-4 rounded-lg" style={{ backgroundColor: 'var(--accent)' }}>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Current User ID: {currentUserId}
          </p>
        </div>
      )}
    </div>
  );
} 