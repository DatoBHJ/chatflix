// 'use client'

// import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
// import { createClient } from '@/utils/supabase/client'
// import { User } from '@supabase/supabase-js'
// import { fetchUserName } from '@/app/components/AccountDialog'

// type UserContextType = {
//   user: User | null
//   profileImage: string | null
//   userName: string
//   isLoading: boolean
// }

// const UserContext = createContext<UserContextType>({
//   user: null,
//   profileImage: null,
//   userName: 'You',
//   isLoading: true
// })

// export function UserProvider({ children }: { children: ReactNode }) {
//   const [user, setUser] = useState<User | null>(null)
//   const [profileImage, setProfileImage] = useState<string | null>(null)
//   const [userName, setUserName] = useState('You')
//   const [isLoading, setIsLoading] = useState(true)
//   const supabase = createClient()

//   const fetchProfileImage = async (userId: string) => {
//     try {
//       const { data: profileData, error: profileError } = await supabase
//         .storage
//         .from('profile-pics')
//         .list(`${userId}`);

//       if (profileError) {
//         console.error('Error fetching profile image list:', profileError);
//         return;
//       }

//       if (profileData && profileData.length > 0) {
//         try {
//           const fileName = profileData[0].name;
//           const filePath = `${userId}/${fileName}`;
          
//           if (!fileName || typeof fileName !== 'string') {
//             console.error('Invalid file name returned from storage');
//             return;
//           }
          
//           const { data } = supabase
//             .storage
//             .from('profile-pics')
//             .getPublicUrl(filePath);
          
//           if (data && data.publicUrl) {
//             try {
//               new URL(data.publicUrl);
//               setProfileImage(data.publicUrl);
//             } catch (urlError) {
//               console.error('Invalid URL format:', urlError);
//             }
//           } else {
//             console.error('No valid public URL returned');
//           }
//         } catch (error) {
//           console.error('Error getting public URL for profile image:', error);
//         }
//       }
//     } catch (error) {
//       console.error('Error in profile image fetch process:', error);
//     }
//   };

//   useEffect(() => {
//     const getUser = async () => {
//       try {
//         const { data: { user } } = await supabase.auth.getUser()
//         setUser(user)
        
//         if (user) {
//           const name = await fetchUserName(user.id, supabase);
//           setUserName(name);
          
//           fetchProfileImage(user.id);
//         }
//       } catch (error) {
//         console.error('Error loading user information:', error)
//       } finally {
//         setIsLoading(false)
//       }
//     }

//     getUser()

//     const { data: { subscription } } = supabase.auth.onAuthStateChange(
//       async (event, session) => {
//         setUser(session?.user || null)
//         if (session?.user) {
//           const name = await fetchUserName(session.user.id, supabase);
//           setUserName(name);
//           fetchProfileImage(session.user.id);
//         }
//       }
//     )

//     return () => {
//       subscription.unsubscribe()
//     }
//   }, [supabase])

//   return (
//     <UserContext.Provider value={{ user, profileImage, userName, isLoading }}>
//       {children}
//     </UserContext.Provider>
//   )
// }

// export const useUser = () => useContext(UserContext) 