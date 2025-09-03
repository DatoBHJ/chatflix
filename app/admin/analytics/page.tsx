// 'use client';

// import { useEffect, useState } from 'react';
// import { useRouter } from 'next/navigation';
// import { supabase } from '@/lib/supabase';
// import { getModelUsageStats, getOverallStats } from '../utils/insights';
// import { 
//   getHourlyActivityStats, 
//   getDayOfWeekStats, 
//   getSessionLengthDistribution,
//   getModelResponseLengths,
//   getUserRetentionStats,
//   getUserModelPreferencePatterns,
//   getModelSwitchingPatterns,
//   getSessionModelDiversity,
//   getInitialMessagePatterns
// } from '../utils/analytics';
// import AnalyticsCard from '../components/AnalyticsCard';

// // Day of week name mapping
// const DAY_OF_WEEK_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// // Date range options
// const DATE_RANGES = [
//   { label: '최근 7일', value: 7 },
//   { label: '최근 14일', value: 14 },
//   { label: '최근 30일', value: 30 },
//   { label: '최근 90일', value: 90 },
//   { label: '전체 기간', value: 'all' }
// ];

// // Format UTC hour to local time
// const formatLocalHour = (utcHour: number) => {
//   const date = new Date();
//   date.setUTCHours(utcHour, 0, 0, 0);
//   const localHour = date.getHours();
  
//   const period = localHour >= 12 ? 'PM' : 'AM';
//   const displayHour = localHour % 12 || 12; // Convert 0 to 12 for 12 AM
//   return `${displayHour} ${period}`;
// };

// // Format date for display
// const formatDate = (date: Date) => {
//   return date.toISOString().split('T')[0]; // YYYY-MM-DD format
// };

// // Sort helpers
// type SortDirection = 'asc' | 'desc';
// type SortConfig = {
//   key: string;
//   direction: SortDirection;
// };

// // Generic sorting function
// const sortData = <T extends Record<string, any>>(data: T[], sortConfig: SortConfig | null): T[] => {
//   if (!sortConfig) return data;
  
//   return [...data].sort((a, b) => {
//     let aValue = a[sortConfig.key];
//     let bValue = b[sortConfig.key];
    
//     // Handle numeric values stored as strings
//     if (typeof aValue === 'string' && !isNaN(Number(aValue))) {
//       aValue = Number(aValue);
//       bValue = Number(bValue);
//     }
    
//     if (aValue < bValue) {
//       return sortConfig.direction === 'asc' ? -1 : 1;
//     }
//     if (aValue > bValue) {
//       return sortConfig.direction === 'asc' ? 1 : -1;
//     }
//     return 0;
//   });
// };

// export default function AdminAnalyticsPage() {
//   const [isLoading, setIsLoading] = useState(true);
//   const [isAuthorized, setIsAuthorized] = useState(false);
//   const [currentUserId, setCurrentUserId] = useState<string | null>(null);
//   const router = useRouter();
  
//   // Date range state
//   const [selectedRange, setSelectedRange] = useState<number | string>(30); // Default to 30 days
//   const [dateRange, setDateRange] = useState<{ start: string, end: string }>({
//     start: formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)), // 30 days ago
//     end: formatDate(new Date()) // Today
//   });
  
//   // Custom date range
//   const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
//   const [customStartDate, setCustomStartDate] = useState<string>(dateRange.start);
//   const [customEndDate, setCustomEndDate] = useState<string>(dateRange.end);
  
//   // Data states
//   const [overallStats, setOverallStats] = useState<any>(null);
//   const [modelStats, setModelStats] = useState<any[]>([]);
//   const [hourlyStats, setHourlyStats] = useState<any[]>([]);
//   const [dayOfWeekStats, setDayOfWeekStats] = useState<any[]>([]);
//   const [sessionLengthStats, setSessionLengthStats] = useState<any[]>([]);
//   const [modelResponseStats, setModelResponseStats] = useState<any[]>([]);
//   const [userRetentionStats, setUserRetentionStats] = useState<any[]>([]);
//   const [userPreferenceStats, setUserPreferenceStats] = useState<any[]>([]);
//   const [modelSwitchingStats, setModelSwitchingStats] = useState<any[]>([]);
//   const [sessionDiversityStats, setSessionDiversityStats] = useState<any[]>([]);
//   const [initialMessageStats, setInitialMessageStats] = useState<any[]>([]);
  
//   // Sorting states
//   const [hourlySortConfig, setHourlySortConfig] = useState<SortConfig | null>(null);
//   const [dayOfWeekSortConfig, setDayOfWeekSortConfig] = useState<SortConfig | null>(null);
//   const [sessionLengthSortConfig, setSessionLengthSortConfig] = useState<SortConfig | null>(null);
//   const [modelResponseSortConfig, setModelResponseSortConfig] = useState<SortConfig | null>(null);
//   const [userRetentionSortConfig, setUserRetentionSortConfig] = useState<SortConfig | null>(null);
//   const [userPreferenceSortConfig, setUserPreferenceSortConfig] = useState<SortConfig | null>(null);
//   const [modelSwitchingSortConfig, setModelSwitchingSortConfig] = useState<SortConfig | null>(null);
//   const [sessionDiversitySortConfig, setSessionDiversitySortConfig] = useState<SortConfig | null>(null);
//   const [modelUsageSortConfig, setModelUsageSortConfig] = useState<SortConfig | null>(null);
  
//   // Update date range based on selected option
//   useEffect(() => {
//     if (selectedRange === 'custom') {
//       return; // Don't update when custom is selected until user applies
//     }
    
//     const end = new Date();
//     let start;
    
//     if (selectedRange === 'all') {
//       // Set to a very early date to get all data
//       start = new Date('2020-01-01');
//     } else {
//       // Set to X days ago
//       start = new Date(end.getTime() - Number(selectedRange) * 24 * 60 * 60 * 1000);
//     }
    
//     setDateRange({
//       start: formatDate(start),
//       end: formatDate(end)
//     });
    
//     // Update custom date fields too
//     setCustomStartDate(formatDate(start));
//     setCustomEndDate(formatDate(end));
    
//     // Load data with new date range if authorized
//     if (isAuthorized) {
//       loadAnalyticsData(formatDate(start), formatDate(end));
//     }
//   }, [selectedRange, isAuthorized]);
  
//   // Apply custom date range
//   const applyCustomDateRange = () => {
//     setDateRange({
//       start: customStartDate,
//       end: customEndDate
//     });
    
//     setShowCustomDatePicker(false);
//     loadAnalyticsData(customStartDate, customEndDate);
//   };
  
//   useEffect(() => {
//     const checkAuth = async () => {
//       try {
//         const { data: { user } } = await supabase.auth.getUser();
//         console.log("Current user:", user);
        
//         // Set current user ID for debugging
//         setCurrentUserId(user?.id || null);
        
//         // TEMPORARY: Allow all users to access the admin page for development
//         setIsAuthorized(true);
        
//         // Initial load with default date range
//         await loadAnalyticsData(dateRange.start, dateRange.end);
//       } catch (error) {
//         console.error('Authentication error:', error);
//         // Don't redirect for development
//         setIsAuthorized(true);
//         setIsLoading(false);
//       }
//     };

//     checkAuth();
//   }, [router]);
  
//   const loadAnalyticsData = async (startDate: string, endDate: string) => {
//     try {
//       setIsLoading(true);
      
//       console.log(`Loading analytics data for period: ${startDate} to ${endDate}`);
      
//       // Load data sequentially with better error handling
//       try {
//         const overallStatsData = await getOverallStats(startDate, endDate);
//         setOverallStats(overallStatsData);
//       } catch (error) {
//         console.error('Failed to load overall stats:', error);
//       }
      
//       try {
//         const modelStatsData = await getModelUsageStats(startDate, endDate);
//         setModelStats(modelStatsData);
//       } catch (error) {
//         console.error('Failed to load model stats:', error);
//       }
      
//       try {
//         const hourlyStatsData = await getHourlyActivityStats(startDate, endDate);
//         setHourlyStats(hourlyStatsData);
//       } catch (error) {
//         console.error('Failed to load hourly stats:', error);
//       }
      
//       try {
//         const dayOfWeekStatsData = await getDayOfWeekStats(startDate, endDate);
//         setDayOfWeekStats(dayOfWeekStatsData);
//       } catch (error) {
//         console.error('Failed to load day of week stats:', error);
//       }
      
//       try {
//         const sessionLengthStatsData = await getSessionLengthDistribution(startDate, endDate);
//         setSessionLengthStats(sessionLengthStatsData);
//       } catch (error) {
//         console.error('Failed to load session length stats:', error);
//       }
      
//       try {
//         const modelResponseStatsData = await getModelResponseLengths(startDate, endDate);
//         setModelResponseStats(modelResponseStatsData);
//       } catch (error) {
//         console.error('Failed to load model response stats:', error);
//       }
      
//       try {
//         const userRetentionStatsData = await getUserRetentionStats(startDate, endDate);
//         setUserRetentionStats(userRetentionStatsData);
//       } catch (error) {
//         console.error('Failed to load user retention stats:', error);
//       }
      
//       try {
//         const userPreferenceStatsData = await getUserModelPreferencePatterns(startDate, endDate);
//         setUserPreferenceStats(userPreferenceStatsData);
//       } catch (error) {
//         console.error('Failed to load user preference stats:', error);
//       }
      
//       try {
//         const modelSwitchingStatsData = await getModelSwitchingPatterns(startDate, endDate);
//         setModelSwitchingStats(modelSwitchingStatsData);
//       } catch (error) {
//         console.error('Failed to load model switching stats:', error);
//       }
      
//       try {
//         const sessionDiversityStatsData = await getSessionModelDiversity(startDate, endDate);
//         setSessionDiversityStats(sessionDiversityStatsData);
//       } catch (error) {
//         console.error('Failed to load session diversity stats:', error);
//       }
      
//       try {
//         const initialMessageStatsData = await getInitialMessagePatterns(startDate, endDate);
//         setInitialMessageStats(initialMessageStatsData);
//       } catch (error) {
//         console.error('Failed to load initial message stats:', error);
//       }
      
//     } catch (error) {
//       console.error('Error loading analytics data:', error);
//     } finally {
//       setIsLoading(false);
//     }
//   };
  
//   const formatNumber = (num: number | string) => {
//     if (num === null || num === undefined) return 'N/A';
//     const parsedNum = typeof num === 'string' ? parseInt(num, 10) : num;
//     return parsedNum.toLocaleString();
//   };

//   if (isLoading) {
//     return (
//       <div className="flex h-screen items-center justify-center">
//         <div className="text-xl">Loading...</div>
//       </div>
//     );
//   }

//   if (!isAuthorized) {
//     return null;
//   }

//   // Generic sort handler factory
//   const createSortHandler = (
//     key: string, 
//     currentConfig: SortConfig | null, 
//     setConfig: React.Dispatch<React.SetStateAction<SortConfig | null>>
//   ) => {
//     return () => {
//       let direction: SortDirection = 'asc';
      
//       if (currentConfig && currentConfig.key === key) {
//         direction = currentConfig.direction === 'asc' ? 'desc' : 'asc';
//       }
      
//       setConfig({ key, direction });
//     };
//   };

//   return (
//     <div className="container mx-auto p-6">
//       <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center mb-8">
//         <h1 className="text-3xl font-bold mb-4 md:mb-0">Data Analytics Dashboard</h1>
        
//         {/* Date Range Controls */}
//         <div className="flex flex-col md:flex-row gap-2 md:items-center">
//           <div className="relative">
//             <select
//               value={selectedRange}
//               onChange={(e) => {
//                 const value = e.target.value;
//                 if (value === 'custom') {
//                   setShowCustomDatePicker(true);
//                 } else {
//                   setSelectedRange(value === 'all' ? 'all' : parseInt(value, 10));
//                 }
//               }}
//               className="px-3 py-2 rounded text-sm appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
//               style={{ 
//                 backgroundColor: 'var(--accent)', 
//                 color: 'var(--foreground)',
//                 border: '1px solid var(--border)'
//               }}
//               disabled={isLoading}
//             >
//               {DATE_RANGES.map((range) => (
//                 <option key={range.value.toString()} value={range.value}>
//                   {range.label}
//                 </option>
//               ))}
//               <option value="custom">기간 직접 설정</option>
//             </select>
//             <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
//               <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
//                 <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
//               </svg>
//             </div>
//           </div>
          
//           {/* Display current date range */}
//           <div className="text-sm px-3 py-2 rounded flex items-center" 
//                style={{ 
//                  backgroundColor: 'var(--accent)', 
//                  color: 'var(--foreground)',
//                  border: '1px solid var(--border)'
//                }}>
//             <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
//             </svg>
//             {dateRange.start} ~ {dateRange.end}
//           </div>
          
//           <button 
//             onClick={() => loadAnalyticsData(dateRange.start, dateRange.end)} 
//             className="px-4 py-2 rounded transition-colors text-sm flex items-center"
//             style={{ 
//               backgroundColor: 'var(--foreground)', 
//               color: 'var(--background)'
//             }}
//             disabled={isLoading}
//           >
//             {isLoading ? (
//               <>
//                 <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
//                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
//                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
//                 </svg>
//                 로딩 중...
//               </>
//             ) : (
//               <>
//                 <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
//                 </svg>
//                 새로고침
//               </>
//             )}
//           </button>
//         </div>
//       </div>
      
//       {/* Summary Stats with Period Info */}
//       <div className="mb-4 px-4 py-2 rounded-lg" style={{ backgroundColor: 'var(--border)', color: 'var(--muted)' }}>
//         <div className="flex items-center justify-between">
//           <div className="flex items-center">
//             <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
//             </svg>
//             {selectedRange === 'all' ? (
//               <span>전체 기간 데이터를 보고 있습니다</span>
//             ) : selectedRange === 'custom' ? (
//               <span>{dateRange.start}부터 {dateRange.end}까지의 데이터를 보고 있습니다</span>
//             ) : (
//               <span>최근 {selectedRange}일 데이터를 보고 있습니다</span>
//             )}
//           </div>
//           <div className="text-sm">
//             {overallStats?.last_activity && (
//               <span>마지막 활동: {new Date(overallStats.last_activity).toLocaleString('ko-KR')}</span>
//             )}
//           </div>
//         </div>
//       </div>
      
//       {/* Custom Date Picker Modal */}
//       {showCustomDatePicker && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//           <div className="p-6 rounded-lg max-w-md w-full" style={{ backgroundColor: 'var(--background)' }}>
//             <h3 className="text-lg font-medium mb-4">분석 기간 설정</h3>
            
//             <div className="space-y-4">
//               <div>
//                 <label className="block text-sm mb-1">시작일:</label>
//                 <input 
//                   type="date" 
//                   value={customStartDate}
//                   onChange={(e) => setCustomStartDate(e.target.value)}
//                   className="w-full px-3 py-2 rounded text-sm"
//                   style={{ 
//                     backgroundColor: 'var(--accent)', 
//                     color: 'var(--foreground)',
//                     border: '1px solid var(--border)'
//                   }}
//                 />
//               </div>
              
//               <div>
//                 <label className="block text-sm mb-1">종료일:</label>
//                 <input 
//                   type="date" 
//                   value={customEndDate}
//                   onChange={(e) => setCustomEndDate(e.target.value)}
//                   className="w-full px-3 py-2 rounded text-sm"
//                   style={{ 
//                     backgroundColor: 'var(--accent)', 
//                     color: 'var(--foreground)',
//                     border: '1px solid var(--border)'
//                   }}
//                 />
//               </div>
              
//               <div className="flex justify-end gap-2 mt-4">
//                 <button 
//                   onClick={() => setShowCustomDatePicker(false)}
//                   className="px-4 py-2 rounded text-sm"
//                   style={{ 
//                     backgroundColor: 'var(--accent)', 
//                     color: 'var(--foreground)',
//                     border: '1px solid var(--border)'
//                   }}
//                 >
//                   취소
//                 </button>
                
//                 <button 
//                   onClick={applyCustomDateRange}
//                   className="px-4 py-2 rounded text-sm"
//                   style={{ 
//                     backgroundColor: 'var(--foreground)', 
//                     color: 'var(--background)'
//                   }}
//                 >
//                   적용
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}
      
//       {/* Summary Statistics */}
//       {overallStats && (
//         <div 
//           className="p-4 rounded-lg mb-8 grid grid-cols-1 md:grid-cols-4 gap-4"
//           style={{ 
//             backgroundColor: 'var(--accent)',
//             color: 'var(--foreground)'
//           }}
//         >
//           <div className="text-center">
//             <h3 className="text-sm uppercase mb-1 font-medium" style={{ color: 'var(--muted)' }}>Total Messages</h3>
//             <p className="text-2xl font-bold">{formatNumber(overallStats.total_messages)}</p>
//           </div>
          
//           <div className="text-center">
//             <h3 className="text-sm uppercase mb-1 font-medium" style={{ color: 'var(--muted)' }}>Total Sessions</h3>
//             <p className="text-2xl font-bold">{formatNumber(overallStats.total_sessions)}</p>
//           </div>
          
//           <div className="text-center">
//             <h3 className="text-sm uppercase mb-1 font-medium" style={{ color: 'var(--muted)' }}>Total Users</h3>
//             <p className="text-2xl font-bold">{formatNumber(overallStats.total_users)}</p>
//           </div>
          
//           <div className="text-center">
//             <h3 className="text-sm uppercase mb-1 font-medium" style={{ color: 'var(--muted)' }}>Avg Session Length</h3>
//             <p className="text-2xl font-bold">{parseFloat(overallStats.avg_session_length).toFixed(1)}</p>
//           </div>
//         </div>
//       )}
      
//       {/* User Retention Highlight - NEW SECTION */}
//       <div className="mb-8">
//         <h2 className="text-2xl font-semibold mb-4 relative group">
//           User Retention Analysis
//           <div className="absolute left-0 -bottom-1 w-0 h-0.5 bg-blue-500 group-hover:w-full transition-all duration-300"></div>
//           <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-full left-0 mt-2 p-2 rounded-md text-sm z-10 max-w-md" 
//                style={{ 
//                  backgroundColor: 'var(--accent)', 
//                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
//                  border: '1px solid var(--border)'
//                }}>
//             <p style={{ color: 'var(--foreground)' }}>
//               <span className="font-bold">사용자 유지율 분석</span><br />
//               사용자들의 서비스 이용 패턴과 충성도를 나타내는 지표입니다. 이용자가 얼마나 자주, 장기간 서비스를 사용하는지 분석합니다. 
//               각 사용자의 첫 활동부터 마지막 활동까지의 기간과 활동 일수를 기준으로 카테고리화하여 계산됩니다.
//             </p>
//           </div>
//         </h2>
        
//         <div className="p-5 rounded-lg" style={{ backgroundColor: 'var(--accent)', border: '1px solid var(--border)' }}>
//           <div className="flex flex-col md:flex-row gap-6">
//             {/* Visual retention chart */}
//             <div className="flex-1">
//               <h3 className="text-lg font-medium mb-3 relative inline-block group">
//                 Retention Overview
//                 <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-full left-0 mt-2 p-2 rounded-md text-sm z-10 max-w-md" 
//                      style={{ 
//                        backgroundColor: 'var(--accent)', 
//                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
//                        border: '1px solid var(--border)'
//                      }}>
//                   <p style={{ color: 'var(--foreground)' }}>
//                     <span className="font-bold">유지율 개요</span><br />
//                     각 사용자 그룹의 분포를 시각적으로 표현한 차트입니다. 색상별로 서로 다른 활동 기간을 나타내며, 폭은 전체 사용자 대비 비율을 의미합니다.
//                   </p>
//                 </div>
//               </h3>
//               <div className="relative h-14 bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden">
//                 {userRetentionStats.length > 0 && (
//                   <>
//                     {userRetentionStats.map((stat, idx) => {
//                       const totalUsers = userRetentionStats.reduce((acc, curr) => acc + parseInt(curr.user_count), 0);
//                       const ratio = (parseInt(stat.user_count) / totalUsers * 100);
//                       let width = ratio + '%';
                      
//                       // Colors for different retention segments
//                       const colors = [
//                         'bg-red-500',             // Single Visit - highest churn
//                         'bg-yellow-500',          // 2-3 Days
//                         'bg-blue-500',            // 4-7 Days
//                         'bg-indigo-500',          // 8-14 Days
//                         'bg-green-500'            // 15+ Days - highest retention
//                       ];
                      
//                       // Calculate position based on previous segments
//                       const prevSegments = userRetentionStats.slice(0, idx);
//                       const prevWidth = prevSegments.reduce((acc, curr) => {
//                         const prevRatio = (parseInt(curr.user_count) / totalUsers * 100);
//                         return acc + prevRatio;
//                       }, 0);
                      
//                       return (
//                         <div 
//                           key={idx}
//                           className={`absolute h-full ${colors[idx]}`}
//                           style={{ 
//                             left: `${prevWidth}%`, 
//                             width: width,
//                             transition: 'width 0.5s ease-in-out'
//                           }}
//                           title={`${stat.activity_category}: ${ratio.toFixed(1)}%`}
//                         ></div>
//                       );
//                     })}
//                   </>
//                 )}
//               </div>
              
//               {/* Legend */}
//               <div className="mt-3 flex flex-wrap gap-3">
//                 {userRetentionStats.length > 0 && userRetentionStats.map((stat, idx) => {
//                   const colors = ['bg-red-500', 'bg-yellow-500', 'bg-blue-500', 'bg-indigo-500', 'bg-green-500'];
//                   const totalUsers = userRetentionStats.reduce((acc, curr) => acc + parseInt(curr.user_count), 0);
//                   const ratio = (parseInt(stat.user_count) / totalUsers * 100).toFixed(1);
                  
//                   // 각 카테고리별 한글 설명
//                   const categoryDescriptions = {
//                     'Single Visit': '서비스를 단 하루만 이용한 사용자입니다. 이탈 위험이 가장 높은 그룹으로, 첫 사용 경험이 만족스럽지 않았을 가능성이 있습니다.',
//                     '2-3 Days': '2-3일 동안 서비스를 이용한 사용자입니다. 서비스의 가치를 어느 정도 발견했지만, 아직 확고한 습관이 형성되지 않은 단계입니다.',
//                     '4-7 Days': '일주일 이내 여러 날 서비스를 이용한 사용자입니다. 정기적인 사용 패턴이 형성되기 시작한 단계로, 충성 사용자로 전환될 가능성이 있습니다.',
//                     '8-14 Days': '1-2주 동안 서비스를 정기적으로 이용한 사용자입니다. 이미 서비스 사용이 습관화된 충성도 높은 그룹입니다.',
//                     '15+ Days': '15일 이상 서비스를 장기간 이용한 사용자입니다. 가장 충성도가 높은 핵심 사용자 그룹으로, 서비스의 가치를 충분히 인식하고 있습니다.'
//                   };
                  
//                   return (
//                     <div key={idx} className="flex items-center group relative">
//                       <div className={`w-3 h-3 rounded-full ${colors[idx]} mr-2`}></div>
//                       <span className="text-sm mr-1">{stat.activity_category}</span>
//                       <span className="text-sm text-gray-500">({ratio}%)</span>
                      
//                       {/* 호버 시 설명 툴팁 */}
//                       <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full left-0 mb-2 p-2 rounded-md text-sm z-10 w-64" 
//                            style={{ 
//                              backgroundColor: 'var(--accent)', 
//                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
//                              border: '1px solid var(--border)'
//                            }}>
//                         <p style={{ color: 'var(--foreground)' }}>
//                           {categoryDescriptions[stat.activity_category as keyof typeof categoryDescriptions]}
//                         </p>
//                       </div>
//                     </div>
//                   );
//                 })}
//               </div>
//             </div>
            
//             {/* Key retention metrics */}
//             <div className="md:w-1/3">
//               <h3 className="text-lg font-medium mb-3 relative inline-block group">
//                 Key Metrics
//                 <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-full left-0 mt-2 p-2 rounded-md text-sm z-10 max-w-md" 
//                      style={{ 
//                        backgroundColor: 'var(--accent)', 
//                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
//                        border: '1px solid var(--border)'
//                      }}>
//                   <p style={{ color: 'var(--foreground)' }}>
//                     <span className="font-bold">주요 지표</span><br />
//                     서비스의 사용자 유지 건전성을 평가하는 핵심 지표들입니다. 이탈률(Churn Rate), 충성 사용자 비율, 정기 사용자 비율 등이 포함됩니다.
//                   </p>
//                 </div>
//               </h3>
              
//               {userRetentionStats.length > 0 && (
//                 <div className="space-y-3">
//                   {/* Churn Rate */}
//                   {(() => {
//                     const singleVisitUsers = userRetentionStats.find(stat => stat.activity_category === 'Single Visit');
//                     const totalUsers = userRetentionStats.reduce((acc, curr) => acc + parseInt(curr.user_count), 0);
//                     const churnRate = singleVisitUsers 
//                       ? (parseInt(singleVisitUsers.user_count) / totalUsers * 100).toFixed(1) 
//                       : 'N/A';
                    
//                     return (
//                       <div className="group relative">
//                         <div className="flex justify-between">
//                           <span className="text-sm font-medium">Churn Rate:</span>
//                           <span className={`text-sm font-semibold ${parseFloat(churnRate) > 50 ? 'text-red-500' : 'text-gray-500'}`}>
//                             {churnRate}%
//                           </span>
//                         </div>
//                         <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
//                           <div 
//                             className="bg-red-500 h-2 rounded-full" 
//                             style={{ width: churnRate !== 'N/A' ? `${churnRate}%` : '0%' }}
//                           ></div>
//                         </div>
                        
//                         {/* 호버 시 설명 툴팁 */}
//                         <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-0 right-0 mt-6 p-2 rounded-md text-sm z-10 w-64" 
//                              style={{ 
//                                backgroundColor: 'var(--accent)', 
//                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
//                                border: '1px solid var(--border)'
//                              }}>
//                           <p style={{ color: 'var(--foreground)' }}>
//                             <span className="font-bold">이탈률(Churn Rate)</span><br />
//                             서비스를 한 번만 사용하고 다시 돌아오지 않은 사용자의 비율입니다. 30% 미만이 좋은 수치이며, 50% 이상은 개선이 필요한 상태입니다. 계산 방식: (단일 방문 사용자 수 ÷ 전체 사용자 수) × 100
//                           </p>
//                         </div>
//                       </div>
//                     );
//                   })()}
                  
//                   {/* Loyal Users Rate */}
//                   {(() => {
//                     const loyalUsers = userRetentionStats.filter(stat => 
//                       stat.activity_category === '8-14 Days' || stat.activity_category === '15+ Days'
//                     );
                    
//                     const loyalUsersCount = loyalUsers.reduce((acc, curr) => acc + parseInt(curr.user_count), 0);
//                     const totalUsers = userRetentionStats.reduce((acc, curr) => acc + parseInt(curr.user_count), 0);
//                     const loyalRate = (loyalUsersCount / totalUsers * 100).toFixed(1);
                    
//                     return (
//                       <div className="group relative">
//                         <div className="flex justify-between">
//                           <span className="text-sm font-medium">Loyal Users (8+ days):</span>
//                           <span className={`text-sm font-semibold ${parseFloat(loyalRate) > 30 ? 'text-green-500' : 'text-gray-500'}`}>
//                             {loyalRate}%
//                           </span>
//                         </div>
//                         <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
//                           <div 
//                             className="bg-green-500 h-2 rounded-full" 
//                             style={{ width: `${loyalRate}%` }}
//                           ></div>
//                         </div>
                        
//                         {/* 호버 시 설명 툴팁 */}
//                         <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-0 right-0 mt-6 p-2 rounded-md text-sm z-10 w-64" 
//                              style={{ 
//                                backgroundColor: 'var(--accent)', 
//                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
//                                border: '1px solid var(--border)'
//                              }}>
//                           <p style={{ color: 'var(--foreground)' }}>
//                             <span className="font-bold">충성 사용자 비율</span><br />
//                             8일 이상 서비스를 꾸준히 이용한 충성도 높은 사용자의 비율입니다. 30% 이상이면 건강한 서비스 상태를 의미합니다. 계산 방식: (8일 이상 사용자 수 ÷ 전체 사용자 수) × 100
//                           </p>
//                         </div>
//                       </div>
//                     );
//                   })()}
                  
//                   {/* Regular Users Rate */}
//                   {(() => {
//                     const regularUsers = userRetentionStats.filter(stat => 
//                       stat.activity_category === '4-7 Days' || 
//                       stat.activity_category === '8-14 Days' || 
//                       stat.activity_category === '15+ Days'
//                     );
                    
//                     const regularUsersCount = regularUsers.reduce((acc, curr) => acc + parseInt(curr.user_count), 0);
//                     const totalUsers = userRetentionStats.reduce((acc, curr) => acc + parseInt(curr.user_count), 0);
//                     const regularRate = (regularUsersCount / totalUsers * 100);
                    
//                     if (regularRate < 20) {
//                       return (
//                         <div className="group relative">
//                           <div className="flex justify-between">
//                             <span className="text-sm font-medium">Regular Users (4-7 days):</span>
//                             <span className="text-sm font-semibold text-blue-500">{regularRate}%</span>
//                           </div>
//                           <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
//                             <div 
//                               className="bg-blue-500 h-2 rounded-full" 
//                               style={{ width: `${regularRate}%` }}
//                             ></div>
//                           </div>
                          
//                           {/* 호버 시 설명 툴팁 */}
//                           <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-0 right-0 mt-6 p-2 rounded-md text-sm z-10 w-64" 
//                                style={{ 
//                                  backgroundColor: 'var(--accent)', 
//                                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
//                                  border: '1px solid var(--border)'
//                                }}>
//                             <p style={{ color: 'var(--foreground)' }}>
//                               <span className="font-bold">정기 사용자 비율</span><br />
//                               4-7일 동안 서비스를 이용한 사용자 비율입니다. 이 사용자들은 충성 사용자로 전환될 가능성이 높은 그룹입니다. 계산 방식: (4-7일 사용자 수 ÷ 전체 사용자 수) × 100
//                             </p>
//                           </div>
//                         </div>
//                       );
//                     } else if (regularRate < 40) {
//                       return (
//                         <div className="group relative">
//                           <div className="flex justify-between">
//                             <span className="text-sm font-medium">Regular Users (4-7 days):</span>
//                             <span className="text-sm font-semibold text-blue-500">{regularRate}%</span>
//                           </div>
//                           <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
//                             <div 
//                               className="bg-blue-500 h-2 rounded-full" 
//                               style={{ width: `${regularRate}%` }}
//                             ></div>
//                           </div>
                          
//                           {/* 호버 시 설명 툴팁 */}
//                           <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-0 right-0 mt-6 p-2 rounded-md text-sm z-10 w-64" 
//                                style={{ 
//                                  backgroundColor: 'var(--accent)', 
//                                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
//                                  border: '1px solid var(--border)'
//                                }}>
//                             <p style={{ color: 'var(--foreground)' }}>
//                               <span className="font-bold">정기 사용자 비율</span><br />
//                               4-7일 동안 서비스를 이용한 사용자 비율입니다. 이 사용자들은 충성 사용자로 전환될 가능성이 높은 그룹입니다. 계산 방식: (4-7일 사용자 수 ÷ 전체 사용자 수) × 100
//                             </p>
//                           </div>
//                         </div>
//                       );
//                     } else {
//                       return (
//                         <div className="group relative">
//                           <div className="flex justify-between">
//                             <span className="text-sm font-medium">Regular Users (4-7 days):</span>
//                             <span className="text-sm font-semibold text-blue-500">{regularRate}%</span>
//                           </div>
//                           <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
//                             <div 
//                               className="bg-blue-500 h-2 rounded-full" 
//                               style={{ width: `${regularRate}%` }}
//                             ></div>
//                           </div>
                          
//                           {/* 호버 시 설명 툴팁 */}
//                           <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-0 right-0 mt-6 p-2 rounded-md text-sm z-10 w-64" 
//                                style={{ 
//                                  backgroundColor: 'var(--accent)', 
//                                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
//                                  border: '1px solid var(--border)'
//                                }}>
//                             <p style={{ color: 'var(--foreground)' }}>
//                               <span className="font-bold">정기 사용자 비율</span><br />
//                               4-7일 동안 서비스를 이용한 사용자 비율입니다. 이 사용자들은 충성 사용자로 전환될 가능성이 높은 그룹입니다. 계산 방식: (4-7일 사용자 수 ÷ 전체 사용자 수) × 100
//                             </p>
//                           </div>
//                         </div>
//                       );
//                     }
//                   })()}
//                 </div>
//               )}
//             </div>
//           </div>
          
//           {/* Detailed statistics table */}
//           <div className="mt-6">
//             <h3 className="text-lg font-medium mb-3 relative inline-block group">
//               Detailed Retention Data
//               <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-full left-0 mt-2 p-2 rounded-md text-sm z-10 max-w-md" 
//                    style={{ 
//                      backgroundColor: 'var(--accent)', 
//                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
//                      border: '1px solid var(--border)'
//                    }}>
//                 <p style={{ color: 'var(--foreground)' }}>
//                   <span className="font-bold">상세 유지율 데이터</span><br />
//                   활동 기간별 사용자 수와 비율을 자세히 보여주는 표입니다. 사용자가 서비스를 이용한 기간에 따라 카테고리화하고 각 카테고리의 의미를 해석합니다.
//                 </p>
//               </div>
//             </h3>
            
//             <div className="overflow-x-auto">
//               <table className="min-w-full" style={{ color: 'var(--foreground)' }}>
//                 <thead>
//                   <tr>
//                     <th className="px-2 py-2 text-left relative group">
//                       Activity Period
//                       <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-full left-0 mt-1 p-2 rounded-md text-sm z-10 w-56" 
//                            style={{ 
//                              backgroundColor: 'var(--accent)', 
//                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
//                              border: '1px solid var(--border)'
//                            }}>
//                         <p style={{ color: 'var(--foreground)', textAlign: 'left' }}>
//                           <span className="font-bold">활동 기간</span><br />
//                           사용자가 서비스를 이용한 기간을 카테고리화한 구분입니다. 단일 방문부터 15일 이상 장기 사용까지 분류됩니다.
//                         </p>
//                       </div>
//                     </th>
//                     <th className="px-2 py-2 text-right relative group">
//                       Users
//                       <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-full left-1/2 -translate-x-1/2 mt-1 p-2 rounded-md text-sm z-10 w-56" 
//                            style={{ 
//                              backgroundColor: 'var(--accent)', 
//                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
//                              border: '1px solid var(--border)'
//                            }}>
//                         <p style={{ color: 'var(--foreground)', textAlign: 'left' }}>
//                           <span className="font-bold">사용자 수</span><br />
//                           각 활동 기간 카테고리에 해당하는 사용자의 총 수입니다. 실제 활성 사용자 규모를 보여줍니다.
//                         </p>
//                       </div>
//                     </th>
//                     <th className="px-2 py-2 text-right relative group">
//                       Percentage
//                       <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-full right-0 mt-1 p-2 rounded-md text-sm z-10 w-56" 
//                            style={{ 
//                              backgroundColor: 'var(--accent)', 
//                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
//                              border: '1px solid var(--border)'
//                            }}>
//                         <p style={{ color: 'var(--foreground)', textAlign: 'left' }}>
//                           <span className="font-bold">비율</span><br />
//                           전체 사용자 중 해당 카테고리에 속하는 사용자의 비율(%)입니다. 계산 방식: (카테고리별 사용자 수 ÷ 전체 사용자 수) × 100
//                         </p>
//                       </div>
//                     </th>
//                     <th className="px-2 py-2 text-left relative group">
//                       Interpretation
//                       <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-full right-0 mt-1 p-2 rounded-md text-sm z-10 w-56" 
//                            style={{ 
//                              backgroundColor: 'var(--accent)', 
//                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
//                              border: '1px solid var(--border)'
//                            }}>
//                         <p style={{ color: 'var(--foreground)', textAlign: 'left' }}>
//                           <span className="font-bold">해석</span><br />
//                           각 카테고리가 비즈니스 관점에서 갖는 의미와 해당 사용자 그룹의 특성에 대한 설명입니다.
//                         </p>
//                       </div>
//                     </th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {userRetentionStats.length > 0 ? (
//                     userRetentionStats.map((stat, idx) => {
//                       const totalUsers = userRetentionStats.reduce((acc, curr) => acc + parseInt(curr.user_count), 0);
//                       const ratio = (parseInt(stat.user_count) / totalUsers * 100).toFixed(1);
                      
//                       // Interpretation text based on category
//                       const interpretations = {
//                         'Single Visit': 'Users who only used the app once. High churn risk.',
//                         '2-3 Days': 'Casual users who are exploring the app.',
//                         '4-7 Days': 'Regular users showing recurring engagement.',
//                         '8-14 Days': 'Committed users with high engagement.',
//                         '15+ Days': 'Highly loyal power users.'
//                       };
                      
//                       // 활동 기간 카테고리별 한글 설명
//                       const categoryDescriptions = {
//                         'Single Visit': '서비스를 단 하루만 방문한 후 돌아오지 않은 사용자입니다. 첫 인상에서 지속적인 가치를 발견하지 못했을 가능성이 있습니다.',
//                         '2-3 Days': '서비스를 2-3일 동안 이용한 사용자입니다. 기본적인 관심은 있으나 지속적인 습관으로 발전하지 못한 경우입니다.',
//                         '4-7 Days': '일주일 내외로 서비스를 이용한 사용자입니다. 서비스 가치를 일정 부분 인식했으나 장기 사용으로 전환되지 않았습니다.',
//                         '8-14 Days': '약 2주 가량 서비스를 이용한 사용자입니다. 서비스에 상당한 관심을 보였으나 완전한 장기 사용자로 전환되지는 않았습니다.',
//                         '15+ Days': '15일 이상 장기간 서비스를 이용한 충성도 높은 사용자입니다. 서비스의 가치를 충분히 인식하고 정기적으로 사용하고 있습니다.'
//                       };
                      
//                       // 활동 기간 카테고리별 자세한 설명
//                       const detailedCategoryDescriptions = {
//                         'Single Visit': '서비스를 단 하루만 방문한 사용자입니다. 이는 최초 사용 후 다시 돌아오지 않은 것을 의미합니다. 이 지표는 초기 사용자 경험과 첫인상에 대한 정보를 제공합니다.',
//                         '2-3 Days': '서비스를 총 2-3일 동안 사용한 사용자입니다. 이 기간은 연속적이지 않을 수 있으며, 첫 사용일로부터 마지막 사용일까지의 모든 활동일을 계산합니다. 기본적인 관심은 있으나 정기적인 사용 습관이 형성되지 않은 상태입니다.',
//                         '4-7 Days': '서비스를 총 4-7일 동안 사용한 사용자입니다. 전체 사용 기간에 걸쳐 4일에서 7일간 서비스에 접속했음을 의미합니다. 일주일 정도의 활동량으로, 어느 정도 정기적인 사용 패턴이 형성되기 시작한 단계입니다.',
//                         '8-14 Days': '서비스를 총 8-14일 동안 사용한 사용자입니다. 전체 사용 기간 중 8일에서 14일간 서비스에 접속했음을 의미합니다. 이는 약 2주 정도의 활동량으로, 상당히 높은 참여도를 보이는 사용자들입니다.',
//                         '15+ Days': '서비스를 15일 이상 사용한 사용자입니다. 이는 총 활동일 수가 15일을 초과함을 의미하며, 장기간에 걸쳐 정기적으로 서비스를 이용한 충성도 높은 사용자를 나타냅니다.'
//                       };
                      
//                       return (
//                         <tr key={idx} style={{ borderBottom: '1px solid var(--subtle-divider)' }}>
//                           <td className="px-2 py-2 relative group">
//                             <span>{stat.activity_category}</span>
//                             <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute left-0 mt-1 p-3 rounded-md text-sm z-20 w-80" 
//                                  style={{ 
//                                    backgroundColor: 'var(--accent)', 
//                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
//                                    border: '1px solid var(--border)',
//                                    transform: 'translateY(10px)',
//                                    maxWidth: '350px'
//                                  }}>
//                               <p style={{ color: 'var(--foreground)', textAlign: 'left', lineHeight: '1.5' }}>
//                                 {detailedCategoryDescriptions[stat.activity_category as keyof typeof detailedCategoryDescriptions]}
//                               </p>
//                             </div>
//                           </td>
//                           <td className="px-2 py-2 text-right">{formatNumber(stat.user_count)}</td>
//                           <td className="px-2 py-2 text-right">{ratio}%</td>
//                           <td className="px-2 py-2 text-sm" style={{ color: 'var(--muted)' }}>
//                             {interpretations[stat.activity_category as keyof typeof interpretations]}
//                           </td>
//                         </tr>
//                       );
//                     })
//                   ) : (
//                     <tr>
//                       <td colSpan={4} className="px-2 py-4 text-center" style={{ color: 'var(--muted)' }}>
//                         No data available
//                       </td>
//                     </tr>
//                   )}
//                 </tbody>
//               </table>
//             </div>
//           </div>
//         </div>
        
//         {/* Strategy suggestions based on retention data */}
//         {userRetentionStats.length > 0 && (
//           <div className="mt-4 p-4 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/20">
//             <h3 className="text-lg font-medium mb-2 text-blue-800 dark:text-blue-300">Retention Strategies</h3>
            
//             <div className="space-y-2">
//               {(() => {
//                 const singleVisitUsers = userRetentionStats.find(stat => stat.activity_category === 'Single Visit');
//                 const totalUsers = userRetentionStats.reduce((acc, curr) => acc + parseInt(curr.user_count), 0);
//                 const churnRate = singleVisitUsers 
//                   ? (parseInt(singleVisitUsers.user_count) / totalUsers * 100)
//                   : 0;
                
//                 if (churnRate > 50) {
//                   return (
//                     <p className="text-sm text-gray-700 dark:text-gray-300">
//                       <span className="font-semibold">High churn detected:</span> Consider implementing onboarding improvements 
//                       and first-time user experience enhancements to increase initial engagement.
//                     </p>
//                   );
//                 } else if (churnRate > 30) {
//                   return (
//                     <p className="text-sm text-gray-700 dark:text-gray-300">
//                       <span className="font-semibold">Moderate churn detected:</span> Focus on improving new user 
//                       experience and adding engagement hooks during the first session.
//                     </p>
//                   );
//                 } else {
//                   return (
//                     <p className="text-sm text-gray-700 dark:text-gray-300">
//                       <span className="font-semibold">Healthy initial retention:</span> Users are finding value in their 
//                       first visits. Focus on extending engagement duration.
//                     </p>
//                   );
//                 }
//               })()}
              
//               {(() => {
//                 const regularUsers = userRetentionStats.filter(stat => 
//                   stat.activity_category === '4-7 Days' || 
//                   stat.activity_category === '8-14 Days' || 
//                   stat.activity_category === '15+ Days'
//                 );
                
//                 const regularUsersCount = regularUsers.reduce((acc, curr) => acc + parseInt(curr.user_count), 0);
//                 const totalUsers = userRetentionStats.reduce((acc, curr) => acc + parseInt(curr.user_count), 0);
//                 const regularRate = (regularUsersCount / totalUsers * 100);
                
//                 if (regularRate < 20) {
//                   return (
//                     <p className="text-sm text-gray-700 dark:text-gray-300">
//                       <span className="font-semibold">Low regular usage:</span> Consider adding features that encourage 
//                       repeat visits such as daily challenges or personalized recommendations.
//                     </p>
//                   );
//                 } else if (regularRate < 40) {
//                   return (
//                     <p className="text-sm text-gray-700 dark:text-gray-300">
//                       <span className="font-semibold">Growing regular usage base:</span> Implement engagement loops and 
//                       habit-forming features to convert more casual users into regulars.
//                     </p>
//                   );
//                 } else {
//                   return (
//                     <p className="text-sm text-gray-700 dark:text-gray-300">
//                       <span className="font-semibold">Strong regular user base:</span> Focus on deepening engagement 
//                       with advanced features and community aspects to maintain high loyalty.
//                     </p>
//                   );
//                 }
//               })()}
//             </div>
//           </div>
//         )}
//       </div>
      
//       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//         {/* Hourly Activity Statistics */}
//         <AnalyticsCard title="Hourly Activity Statistics">
//           <div className="overflow-x-auto">
//             <table className="min-w-full" style={{ color: 'var(--foreground)' }}>
//               <thead>
//                 <tr>
//                   <th 
//                     className="px-2 py-2 text-left cursor-pointer hover:bg-opacity-10 hover:bg-blue-500"
//                     onClick={createSortHandler('hour', hourlySortConfig, setHourlySortConfig)}
//                   >
//                     <div className="flex items-center">
//                       Hour (UTC / Local)
//                       {hourlySortConfig && hourlySortConfig.key === 'hour' && (
//                         <span className="ml-1">
//                           {hourlySortConfig.direction === 'asc' ? '↑' : '↓'}
//                         </span>
//                       )}
//                     </div>
//                   </th>
//                   <th 
//                     className="px-2 py-2 text-right cursor-pointer hover:bg-opacity-10 hover:bg-blue-500"
//                     onClick={createSortHandler('total_messages', hourlySortConfig, setHourlySortConfig)}
//                   >
//                     <div className="flex items-center justify-end">
//                       Messages
//                       {hourlySortConfig && hourlySortConfig.key === 'total_messages' && (
//                         <span className="ml-1">
//                           {hourlySortConfig.direction === 'asc' ? '↑' : '↓'}
//                         </span>
//                       )}
//                     </div>
//                   </th>
//                   <th 
//                     className="px-2 py-2 text-right cursor-pointer hover:bg-opacity-10 hover:bg-blue-500"
//                     onClick={createSortHandler('unique_users', hourlySortConfig, setHourlySortConfig)}
//                   >
//                     <div className="flex items-center justify-end">
//                       Users
//                       {hourlySortConfig && hourlySortConfig.key === 'unique_users' && (
//                         <span className="ml-1">
//                           {hourlySortConfig.direction === 'asc' ? '↑' : '↓'}
//                         </span>
//                       )}
//                     </div>
//                   </th>
//                   <th 
//                     className="px-2 py-2 text-right cursor-pointer hover:bg-opacity-10 hover:bg-blue-500"
//                     onClick={createSortHandler('chat_sessions', hourlySortConfig, setHourlySortConfig)}
//                   >
//                     <div className="flex items-center justify-end">
//                       Sessions
//                       {hourlySortConfig && hourlySortConfig.key === 'chat_sessions' && (
//                         <span className="ml-1">
//                           {hourlySortConfig.direction === 'asc' ? '↑' : '↓'}
//                         </span>
//                       )}
//                     </div>
//                   </th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {hourlyStats.length > 0 ? (
//                   (() => {
//                     // Calculate totals for percentages
//                     const totalMessages = hourlyStats.reduce((sum, stat) => sum + parseInt(stat.total_messages), 0);
//                     const totalUsers = hourlyStats.reduce((sum, stat) => sum + parseInt(stat.unique_users), 0);
//                     const totalSessions = hourlyStats.reduce((sum, stat) => sum + parseInt(stat.chat_sessions), 0);
                    
//                     // Apply sorting
//                     const sortedStats = sortData(hourlyStats, hourlySortConfig);
                    
//                     return sortedStats.map((stat, idx) => {
//                       // Calculate percentages
//                       const messagePercent = totalMessages > 0 ? (parseInt(stat.total_messages) / totalMessages * 100).toFixed(1) : 0;
//                       const userPercent = totalUsers > 0 ? (parseInt(stat.unique_users) / totalUsers * 100).toFixed(1) : 0;
//                       const sessionPercent = totalSessions > 0 ? (parseInt(stat.chat_sessions) / totalSessions * 100).toFixed(1) : 0;
                      
//                       return (
//                         <tr key={idx} style={{ borderBottom: '1px solid var(--subtle-divider)' }}>
//                           <td className="px-2 py-2">
//                             {stat.hour}:00 UTC / {formatLocalHour(parseInt(stat.hour))} Local
//                           </td>
//                           <td className="px-2 py-2 text-right">
//                             {formatNumber(stat.total_messages)} ({messagePercent}%)
//                           </td>
//                           <td className="px-2 py-2 text-right">
//                             {formatNumber(stat.unique_users)} ({userPercent}%)
//                           </td>
//                           <td className="px-2 py-2 text-right">
//                             {formatNumber(stat.chat_sessions)} ({sessionPercent}%)
//                           </td>
//                         </tr>
//                       );
//                     });
//                   })()
//                 ) : (
//                   <tr>
//                     <td colSpan={4} className="px-2 py-4 text-center" style={{ color: 'var(--muted)' }}>
//                       No data available
//                     </td>
//                   </tr>
//                 )}
//               </tbody>
//             </table>
//           </div>
//         </AnalyticsCard>
        
//         {/* Day of Week Activity Statistics */}
//         <AnalyticsCard title="Day of Week Activity Statistics">
//           <div className="overflow-x-auto">
//             <table className="min-w-full" style={{ color: 'var(--foreground)' }}>
//               <thead>
//                 <tr>
//                   <th 
//                     className="px-2 py-2 text-left cursor-pointer hover:bg-opacity-10 hover:bg-blue-500"
//                     onClick={createSortHandler('day_of_week', dayOfWeekSortConfig, setDayOfWeekSortConfig)}
//                   >
//                     <div className="flex items-center">
//                       Day
//                       {dayOfWeekSortConfig && dayOfWeekSortConfig.key === 'day_of_week' && (
//                         <span className="ml-1">
//                           {dayOfWeekSortConfig.direction === 'asc' ? '↑' : '↓'}
//                         </span>
//                       )}
//                     </div>
//                   </th>
//                   <th 
//                     className="px-2 py-2 text-right cursor-pointer hover:bg-opacity-10 hover:bg-blue-500"
//                     onClick={createSortHandler('total_messages', dayOfWeekSortConfig, setDayOfWeekSortConfig)}
//                   >
//                     <div className="flex items-center justify-end">
//                       Messages
//                       {dayOfWeekSortConfig && dayOfWeekSortConfig.key === 'total_messages' && (
//                         <span className="ml-1">
//                           {dayOfWeekSortConfig.direction === 'asc' ? '↑' : '↓'}
//                         </span>
//                       )}
//                     </div>
//                   </th>
//                   <th 
//                     className="px-2 py-2 text-right cursor-pointer hover:bg-opacity-10 hover:bg-blue-500"
//                     onClick={createSortHandler('unique_users', dayOfWeekSortConfig, setDayOfWeekSortConfig)}
//                   >
//                     <div className="flex items-center justify-end">
//                       Users
//                       {dayOfWeekSortConfig && dayOfWeekSortConfig.key === 'unique_users' && (
//                         <span className="ml-1">
//                           {dayOfWeekSortConfig.direction === 'asc' ? '↑' : '↓'}
//                         </span>
//                       )}
//                     </div>
//                   </th>
//                   <th 
//                     className="px-2 py-2 text-right cursor-pointer hover:bg-opacity-10 hover:bg-blue-500"
//                     onClick={createSortHandler('chat_sessions', dayOfWeekSortConfig, setDayOfWeekSortConfig)}
//                   >
//                     <div className="flex items-center justify-end">
//                       Sessions
//                       {dayOfWeekSortConfig && dayOfWeekSortConfig.key === 'chat_sessions' && (
//                         <span className="ml-1">
//                           {dayOfWeekSortConfig.direction === 'asc' ? '↑' : '↓'}
//                         </span>
//                       )}
//                     </div>
//                   </th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {dayOfWeekStats.length > 0 ? (
//                   (() => {
//                     // Calculate totals for percentages
//                     const totalMessages = dayOfWeekStats.reduce((sum, stat) => sum + parseInt(stat.total_messages), 0);
//                     const totalUsers = dayOfWeekStats.reduce((sum, stat) => sum + parseInt(stat.unique_users), 0);
//                     const totalSessions = dayOfWeekStats.reduce((sum, stat) => sum + parseInt(stat.chat_sessions), 0);
                    
//                     // Apply sorting
//                     const sortedStats = sortData(dayOfWeekStats, dayOfWeekSortConfig);
                    
//                     return sortedStats.map((stat, idx) => {
//                       // Calculate percentages
//                       const messagePercent = totalMessages > 0 ? (parseInt(stat.total_messages) / totalMessages * 100).toFixed(1) : 0;
//                       const userPercent = totalUsers > 0 ? (parseInt(stat.unique_users) / totalUsers * 100).toFixed(1) : 0;
//                       const sessionPercent = totalSessions > 0 ? (parseInt(stat.chat_sessions) / totalSessions * 100).toFixed(1) : 0;
                      
//                       return (
//                         <tr key={idx} style={{ borderBottom: '1px solid var(--subtle-divider)' }}>
//                           <td className="px-2 py-2">{DAY_OF_WEEK_NAMES[Math.floor(stat.day_of_week)]}</td>
//                           <td className="px-2 py-2 text-right">
//                             {formatNumber(stat.total_messages)} ({messagePercent}%)
//                           </td>
//                           <td className="px-2 py-2 text-right">
//                             {formatNumber(stat.unique_users)} ({userPercent}%)
//                           </td>
//                           <td className="px-2 py-2 text-right">
//                             {formatNumber(stat.chat_sessions)} ({sessionPercent}%)
//                           </td>
//                         </tr>
//                       );
//                     });
//                   })()
//                 ) : (
//                   <tr>
//                     <td colSpan={4} className="px-2 py-4 text-center" style={{ color: 'var(--muted)' }}>
//                       No data available
//                     </td>
//                   </tr>
//                 )}
//               </tbody>
//             </table>
//           </div>
//         </AnalyticsCard>
        
//         {/* Session Length Distribution */}
//         <AnalyticsCard title="Session Length Distribution">
//           <div className="overflow-x-auto">
//             <table className="min-w-full" style={{ color: 'var(--foreground)' }}>
//               <thead>
//                 <tr>
//                   <th className="px-2 py-2 text-left">Session Length</th>
//                   <th className="px-2 py-2 text-right">Sessions</th>
//                   <th className="px-2 py-2 text-right">Percentage</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {sessionLengthStats.length > 0 ? (
//                   sessionLengthStats.map((stat, idx) => {
//                     const totalSessions = sessionLengthStats.reduce((acc, curr) => acc + parseInt(curr.session_count), 0);
//                     const ratio = (parseInt(stat.session_count) / totalSessions * 100).toFixed(1);
                    
//                     return (
//                       <tr key={idx} style={{ borderBottom: '1px solid var(--subtle-divider)' }}>
//                         <td className="px-2 py-2">{stat.length_category}</td>
//                         <td className="px-2 py-2 text-right">{formatNumber(stat.session_count)}</td>
//                         <td className="px-2 py-2 text-right">{ratio}%</td>
//                       </tr>
//                     );
//                   })
//                 ) : (
//                   <tr>
//                     <td colSpan={3} className="px-2 py-4 text-center" style={{ color: 'var(--muted)' }}>
//                       No data available
//                     </td>
//                   </tr>
//                 )}
//               </tbody>
//             </table>
//           </div>
//         </AnalyticsCard>
        
//         {/* Model Response Lengths */}
//         <AnalyticsCard title="Model Response Lengths (Characters)">
//           <div className="overflow-x-auto">
//             <table className="min-w-full" style={{ color: 'var(--foreground)' }}>
//               <thead>
//                 <tr>
//                   <th className="px-2 py-2 text-left">Model</th>
//                   <th className="px-2 py-2 text-right">Average</th>
//                   <th className="px-2 py-2 text-right">Min</th>
//                   <th className="px-2 py-2 text-right">Max</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {modelResponseStats.length > 0 ? (
//                   modelResponseStats.map((stat, idx) => (
//                     <tr key={idx} style={{ borderBottom: '1px solid var(--subtle-divider)' }}>
//                       <td className="px-2 py-2">{stat.model}</td>
//                       <td className="px-2 py-2 text-right">{parseInt(stat.avg_length).toLocaleString()}</td>
//                       <td className="px-2 py-2 text-right">{formatNumber(stat.min_length)}</td>
//                       <td className="px-2 py-2 text-right">{formatNumber(stat.max_length)}</td>
//                     </tr>
//                   ))
//                 ) : (
//                   <tr>
//                     <td colSpan={4} className="px-2 py-4 text-center" style={{ color: 'var(--muted)' }}>
//                       No data available
//                     </td>
//                   </tr>
//                 )}
//               </tbody>
//             </table>
//           </div>
//         </AnalyticsCard>
        
//         {/* User Model Preferences */}
//         <AnalyticsCard title="User Model Preferences">
//           <div className="overflow-x-auto">
//             <table className="min-w-full" style={{ color: 'var(--foreground)' }}>
//               <thead>
//                 <tr>
//                   <th className="px-2 py-2 text-left">Model</th>
//                   <th className="px-2 py-2 text-right">Preferred By</th>
//                   <th className="px-2 py-2 text-right">Percentage</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {userPreferenceStats.length > 0 ? (
//                   userPreferenceStats.map((stat, idx) => {
//                     const totalPrefs = userPreferenceStats.reduce((acc, curr) => acc + parseInt(curr.preference_count), 0);
//                     const ratio = (parseInt(stat.preference_count) / totalPrefs * 100).toFixed(1);
                    
//                     return (
//                       <tr key={idx} style={{ borderBottom: '1px solid var(--subtle-divider)' }}>
//                         <td className="px-2 py-2">{stat.model}</td>
//                         <td className="px-2 py-2 text-right">{formatNumber(stat.preference_count)}</td>
//                         <td className="px-2 py-2 text-right">{ratio}%</td>
//                       </tr>
//                     );
//                   })
//                 ) : (
//                   <tr>
//                     <td colSpan={3} className="px-2 py-4 text-center" style={{ color: 'var(--muted)' }}>
//                       No data available
//                     </td>
//                   </tr>
//                 )}
//               </tbody>
//             </table>
//           </div>
//         </AnalyticsCard>
        
//         {/* Model Switching Patterns */}
//         <AnalyticsCard title="Model Switching Patterns (Top 10)">
//           <div className="overflow-x-auto">
//             <table className="min-w-full" style={{ color: 'var(--foreground)' }}>
//               <thead>
//                 <tr>
//                   <th className="px-2 py-2 text-left">Switching Pattern</th>
//                   <th className="px-2 py-2 text-right">Count</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {modelSwitchingStats.length > 0 ? (
//                   modelSwitchingStats.slice(0, 10).map((stat, idx) => (
//                     <tr key={idx} style={{ borderBottom: '1px solid var(--subtle-divider)' }}>
//                       <td className="px-2 py-2">{stat.from_model} → {stat.to_model}</td>
//                       <td className="px-2 py-2 text-right">{formatNumber(stat.switch_count)}</td>
//                     </tr>
//                   ))
//                 ) : (
//                   <tr>
//                     <td colSpan={2} className="px-2 py-4 text-center" style={{ color: 'var(--muted)' }}>
//                       No data available
//                     </td>
//                   </tr>
//                 )}
//               </tbody>
//             </table>
//           </div>
//         </AnalyticsCard>
        
//         {/* Session Model Diversity */}
//         <AnalyticsCard title="Session Model Diversity">
//           <div className="overflow-x-auto">
//             <table className="min-w-full" style={{ color: 'var(--foreground)' }}>
//               <thead>
//                 <tr>
//                   <th className="px-2 py-2 text-left">Models Used</th>
//                   <th className="px-2 py-2 text-right">Sessions</th>
//                   <th className="px-2 py-2 text-right">Percentage</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {sessionDiversityStats.length > 0 ? (
//                   sessionDiversityStats.map((stat, idx) => {
//                     const totalSessions = sessionDiversityStats.reduce((acc, curr) => acc + parseInt(curr.session_count), 0);
//                     const ratio = (parseInt(stat.session_count) / totalSessions * 100).toFixed(1);
                    
//                     return (
//                       <tr key={idx} style={{ borderBottom: '1px solid var(--subtle-divider)' }}>
//                         <td className="px-2 py-2">{stat.unique_models}</td>
//                         <td className="px-2 py-2 text-right">{formatNumber(stat.session_count)}</td>
//                         <td className="px-2 py-2 text-right">{ratio}%</td>
//                       </tr>
//                     );
//                   })
//                 ) : (
//                   <tr>
//                     <td colSpan={3} className="px-2 py-4 text-center" style={{ color: 'var(--muted)' }}>
//                       No data available
//                     </td>
//                   </tr>
//                 )}
//               </tbody>
//             </table>
//           </div>
//         </AnalyticsCard>
        
//         {/* Model Usage Statistics */}
//         <AnalyticsCard title="Model Usage Statistics">
//           <div className="overflow-x-auto">
//             <table className="min-w-full" style={{ color: 'var(--foreground)' }}>
//               <thead>
//                 <tr>
//                   <th 
//                     className="px-2 py-2 text-left cursor-pointer hover:bg-opacity-10 hover:bg-blue-500"
//                     onClick={createSortHandler('model', modelUsageSortConfig, setModelUsageSortConfig)}
//                   >
//                     <div className="flex items-center">
//                       Model
//                       {modelUsageSortConfig && modelUsageSortConfig.key === 'model' && (
//                         <span className="ml-1">
//                           {modelUsageSortConfig.direction === 'asc' ? '↑' : '↓'}
//                         </span>
//                       )}
//                     </div>
//                   </th>
//                   <th 
//                     className="px-2 py-2 text-right cursor-pointer hover:bg-opacity-10 hover:bg-blue-500"
//                     onClick={createSortHandler('total_messages', modelUsageSortConfig, setModelUsageSortConfig)}
//                   >
//                     <div className="flex items-center justify-end">
//                       Messages
//                       {modelUsageSortConfig && modelUsageSortConfig.key === 'total_messages' && (
//                         <span className="ml-1">
//                           {modelUsageSortConfig.direction === 'asc' ? '↑' : '↓'}
//                         </span>
//                       )}
//                     </div>
//                   </th>
//                   <th 
//                     className="px-2 py-2 text-right cursor-pointer hover:bg-opacity-10 hover:bg-blue-500"
//                     onClick={createSortHandler('unique_users', modelUsageSortConfig, setModelUsageSortConfig)}
//                   >
//                     <div className="flex items-center justify-end">
//                       Users
//                       {modelUsageSortConfig && modelUsageSortConfig.key === 'unique_users' && (
//                         <span className="ml-1">
//                           {modelUsageSortConfig.direction === 'asc' ? '↑' : '↓'}
//                         </span>
//                       )}
//                     </div>
//                   </th>
//                   <th 
//                     className="px-2 py-2 text-right cursor-pointer hover:bg-opacity-10 hover:bg-blue-500"
//                     onClick={createSortHandler('chat_sessions', modelUsageSortConfig, setModelUsageSortConfig)}
//                   >
//                     <div className="flex items-center justify-end">
//                       Sessions
//                       {modelUsageSortConfig && modelUsageSortConfig.key === 'chat_sessions' && (
//                         <span className="ml-1">
//                           {modelUsageSortConfig.direction === 'asc' ? '↑' : '↓'}
//                         </span>
//                       )}
//                     </div>
//                   </th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {modelStats.length > 0 ? (
//                   sortData(modelStats, modelUsageSortConfig).map((stat, idx) => (
//                     <tr key={idx} style={{ borderBottom: '1px solid var(--subtle-divider)' }}>
//                       <td className="px-2 py-2">{stat.model}</td>
//                       <td className="px-2 py-2 text-right">{formatNumber(stat.total_messages)}</td>
//                       <td className="px-2 py-2 text-right">{formatNumber(stat.unique_users)}</td>
//                       <td className="px-2 py-2 text-right">{formatNumber(stat.chat_sessions)}</td>
//                     </tr>
//                   ))
//                 ) : (
//                   <tr>
//                     <td colSpan={4} className="px-2 py-4 text-center" style={{ color: 'var(--muted)' }}>
//                       No data available
//                     </td>
//                   </tr>
//                 )}
//               </tbody>
//             </table>
//           </div>
//         </AnalyticsCard>
//       </div>
//     </div>
//   );
// } 