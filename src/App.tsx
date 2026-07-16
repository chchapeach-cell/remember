import { useState, useEffect, useRef } from 'react';
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { User, Role } from './types';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { LogOut, Home, Calendar, PieChart, Bell, LayoutDashboard, Settings, AlertCircle, GitCompare } from 'lucide-react';

import Dashboard from './components/Dashboard';
import TaskList from './components/TaskList';
import Report from './components/Report';
import Compare from './components/Compare';
import RoleSelector from './components/RoleSelector';
import SettingsPage from './components/SettingsPage';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register Service Worker globally on mount
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('Service Worker registered globally:', reg.scope))
        .catch(err => console.error('Global Service Worker registration failed:', err));
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userEmail = firebaseUser.email?.toLowerCase().trim() || '';
        const isSpecialAdmin = userEmail === 'tamrri@gmail.com' || userEmail === 'ch.chapeach@gmail.com';
        
        try {
          // Fetch custom user profile from Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          
          // Check allowed emails list
          let allowedDocSnap = null;
          if (userEmail) {
            allowedDocSnap = await getDoc(doc(db, 'allowed_emails', userEmail));
          }
          
          const isAllowedByEmail = allowedDocSnap?.exists();
          const hasExistingProfile = userDoc.exists();
          
          if (!isSpecialAdmin && !hasExistingProfile && !isAllowedByEmail) {
            // User is not authorized in whitelist database!
            await signOut(auth);
            setLoginError("ขออภัย บัญชีอีเมลนี้ไม่ได้รับสิทธิ์ให้เข้าใช้งานระบบ กรุณาติดต่อผู้ดูแลระบบเพื่อเพิ่มรายชื่อผู้ใช้งาน");
            setUser(null);
            setLoading(false);
            return;
          }
          
          let userData: User;

          if (hasExistingProfile) {
            userData = userDoc.data() as User;
            userData.email = userData.email.toLowerCase();
            
            if (isSpecialAdmin && userData.role !== 'executive') {
              userData.role = 'executive';
              await setDoc(doc(db, 'users', firebaseUser.uid), userData);
            }
          } else {
            // New allowed user or special admin
            let assignedRole: Role = 'unassigned';
            if (isSpecialAdmin) {
              assignedRole = 'executive';
            } else if (allowedDocSnap && allowedDocSnap.exists()) {
              assignedRole = allowedDocSnap.data().role as Role;
            }
            
            userData = {
              uid: firebaseUser.uid,
              email: userEmail,
              displayName: firebaseUser.displayName || '',
              photoURL: firebaseUser.photoURL || '',
              role: assignedRole,
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), userData);
          }
          setUser(userData);
          setLoginError(null);
        } catch (error) {
          console.error("Error fetching user data:", error);
          if (isSpecialAdmin) {
            setUser({
              uid: firebaseUser.uid,
              email: userEmail,
              displayName: firebaseUser.displayName || '',
              photoURL: firebaseUser.photoURL || '',
              role: 'executive',
            });
          } else {
            setUser(null);
            setLoginError("เกิดข้อผิดพลาดในการเชื่อมต่อเพื่อตรวจสอบสิทธิ์");
          }
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      setLoginError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
      setLoginError("เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วยบัญชี Google");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleRoleSelect = async (role: Role) => {
    if (!user) return;
    const updatedUser = { ...user, role };
    await setDoc(doc(db, 'users', user.uid), updatedUser);
    setUser(updatedUser);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">กำลังโหลด...</div>;
  }

  return (
    <BrowserRouter>
      <AppContent 
        user={user} 
        handleLogin={handleLogin} 
        handleLogout={handleLogout} 
        handleRoleSelect={handleRoleSelect} 
        loginError={loginError}
        setLoginError={setLoginError}
      />
    </BrowserRouter>
  );
}

function AppContent({
  user,
  handleLogin,
  handleLogout,
  handleRoleSelect,
  loginError,
  setLoginError
}: {
  user: User | null;
  handleLogin: () => Promise<void>;
  handleLogout: () => Promise<void>;
  handleRoleSelect: (role: Role) => Promise<void>;
  loginError: string | null;
  setLoginError: (error: string | null) => void;
}) {
  const location = useLocation();
  const currentPath = location.pathname;

  // iOS Install Prompt State
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  // Real-time toast state for sound/visual fallbacks
  const [toast, setToast] = useState<{ id: string; title: string; desc: string; visible: boolean } | null>(null);
  const seenTaskIds = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = (window.navigator as any).standalone === true;
    
    // Show prompt only if on iOS and not yet installed on home screen
    if (isIOS && !isStandalone) {
      setShowIOSPrompt(true);
    }
  }, []);

  useEffect(() => {
    // Listen to tasks for real-time sound chiming fallback
    const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let isAnyChimed = false;
      const currentTaskIds = new Set<string>();

      snapshot.docs.forEach((docSnap) => {
        const tId = docSnap.id;
        const data = docSnap.data();
        currentTaskIds.add(tId);

        // If it's not the initial load, and we haven't seen this task ID before
        if (!initialLoadRef.current && !seenTaskIds.current.has(tId)) {
          // Verify it's not created by the current user to prevent self-chiming
          const createdByMe = user && (
            (user.displayName && data.createdBy === user.displayName) || 
            (user.email && data.createdBy === user.email)
          );
          
          // And was created recently (within the last 2 minutes) to avoid chiming on old offline records coming in
          const isRecent = data.createdAt && (Date.now() - data.createdAt < 120000);

          if (!createdByMe && isRecent && !isAnyChimed) {
            isAnyChimed = true;
            // Play notification audio
            const audio = new Audio('/notification.wav');
            audio.volume = 1.0;
            audio.play().catch(err => {
              console.warn("Audio autoplay blocked or failed:", err);
            });

            // Trigger beautiful top float toast
            setToast({
              id: tId,
              title: data.title || 'มีภารกิจใหม่บันทึกเข้ามา',
              desc: `บันทึกโดย: ${data.createdBy || 'เจ้าหน้าที่'}`,
              visible: true
            });
            
            // Auto dismiss toast after 6 seconds
            setTimeout(() => {
              setToast(prev => prev?.id === tId ? { ...prev, visible: false } : prev);
            }, 6000);
          }
        }
      });

      // Populate our seen collection
      seenTaskIds.current = currentTaskIds;
      initialLoadRef.current = false;
    }, (error) => {
      console.error("Realtime listener error:", error);
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row pb-16 md:pb-0">
      {/* Mobile Top Header */}
      <header className="md:hidden bg-indigo-900 text-white h-16 flex items-center justify-between px-4 fixed top-0 left-0 right-0 z-40 shadow-md">
        <div className="flex items-center gap-2.5">
          <img 
            src="https://krustation.com/wp-content/uploads/2026/03/logo-obec-1.jpg" 
            alt="โลโก้ สพฐ." 
            className="w-11 h-11 object-contain rounded-full border border-amber-300/30 bg-white p-0.5 shadow-sm"
            referrerPolicy="no-referrer"
          />
          <div className="flex flex-col leading-snug">
            <span className="font-extrabold text-sm tracking-wide text-amber-300">ภารกิจผู้บริหาร</span>
            <span className="font-bold text-[11px] text-indigo-100">สพป.แม่ฮ่องสอน เขต 1</span>
          </div>
        </div>
        <div>
          {!user ? (
            <button
              onClick={handleLogin}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl text-xs font-bold transition shadow-sm"
            >
              เข้าสู่ระบบ
            </button>
          ) : (
            <div className="flex items-center gap-2.5">
              <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-indigo-400" />
              <button
                onClick={handleLogout}
                className="p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 rounded-lg transition"
                title="ออกจากระบบ"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Desktop Sidebar (hidden on mobile) */}
      <aside className="hidden md:flex w-64 bg-indigo-900 flex-shrink-0 flex-col">
        <div className="p-5 flex items-center gap-3 border-b border-indigo-950/40">
          <img 
            src="https://krustation.com/wp-content/uploads/2026/03/logo-obec-1.jpg" 
            alt="โลโก้ สพฐ." 
            className="w-14 h-14 object-contain rounded-full border-2 border-amber-300/40 bg-white p-0.5 shadow"
            referrerPolicy="no-referrer"
          />
          <div className="flex flex-col leading-snug">
            <h2 className="font-black text-amber-300 text-base tracking-wide">ภารกิจผู้บริหาร</h2>
            <span className="text-xs text-indigo-100 font-bold">สพป.แม่ฮ่องสอน เขต 1</span>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link 
            to="/" 
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${
              currentPath === '/'
                ? 'bg-white/10 text-white font-semibold' 
                : 'text-indigo-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="font-medium">ตารางงาน</span>
          </Link>
          {user && user.role !== 'unassigned' && (
            <Link 
              to="/compare" 
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                currentPath === '/compare'
                  ? 'bg-white/10 text-white font-semibold' 
                  : 'text-indigo-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <GitCompare className="w-5 h-5" />
              <span className="font-medium">เปรียบเทียบตาราง</span>
            </Link>
          )}
          {user && user.role !== 'general' && user.role !== 'unassigned' && (
            <>
              <Link 
                to="/dashboard" 
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                  currentPath === '/dashboard'
                    ? 'bg-white/10 text-white font-semibold' 
                    : 'text-indigo-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                <span className="font-medium">ภาพรวม</span>
              </Link>
              <Link 
                to="/report" 
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                  currentPath === '/report'
                    ? 'bg-white/10 text-white font-semibold' 
                    : 'text-indigo-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <PieChart className="w-5 h-5" />
                <span className="font-medium">รายงาน</span>
              </Link>
            </>
          )}
          {user && user.role !== 'unassigned' && (
             <Link 
               to="/settings" 
               className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                 currentPath === '/settings'
                   ? 'bg-white/10 text-white font-semibold' 
                   : 'text-indigo-300 hover:bg-white/5 hover:text-white'
               }`}
             >
               <Settings className="w-5 h-5" />
               <span className="font-medium">ตั้งค่าระบบ</span>
             </Link>
          )}
        </nav>
        
        {/* User Profile in Sidebar */}
        {user && (
          <div className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full border-2 border-indigo-400" />
              <div className="overflow-hidden">
                <p className="text-sm font-medium text-white truncate">{user.displayName}</p>
                <p className="text-xs text-indigo-300 capitalize">
                  {user.role === 'general' ? 'บุคลากรทั่วไป' : user.role}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-red-300 bg-white/10 hover:bg-red-500/20 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
              ออกจากระบบ
            </button>
          </div>
        )}
      </aside>

      {/* Main Content (with margin adjustments for mobile header and navigation bar) */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto relative flex flex-col pt-20 md:pt-0">
        {toast && toast.visible && (
          <div className="fixed top-20 right-4 left-4 md:left-auto md:w-96 bg-indigo-950 text-white rounded-2xl p-4 shadow-xl border border-indigo-800 z-50 flex items-start gap-3.5 animate-in slide-in-from-top md:slide-in-from-right duration-300">
            <div className="p-2 bg-indigo-900 rounded-xl text-amber-300 animate-pulse flex-shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div className="flex-1 leading-snug">
              <span className="font-black text-amber-300 text-[10px] uppercase tracking-wider block mb-0.5">การแจ้งเตือนเสียงเรียลไทม์</span>
              <p className="font-extrabold text-sm text-white">{toast.title}</p>
              <p className="text-xs text-indigo-200 mt-1">{toast.desc}</p>
            </div>
            <button 
              onClick={() => setToast(prev => prev ? { ...prev, visible: false } : null)}
              className="text-indigo-300 hover:text-white font-bold transition text-xs px-1"
            >
              ✕
            </button>
          </div>
        )}
        {showIOSPrompt && (
          <div className="bg-amber-50 border-b border-amber-200 px-5 py-3.5 text-amber-900 text-xs sm:text-sm relative z-50 flex items-start gap-3 shadow-xs animate-in slide-in-from-top duration-300">
            <div className="p-1.5 bg-amber-100 rounded-xl text-amber-700 flex-shrink-0 flex items-center justify-center">
              <Bell className="w-4 h-4 animate-bounce" />
            </div>
            <div className="flex-1 pr-6 leading-relaxed">
              <span className="font-extrabold text-amber-950 block mb-0.5 text-sm">แจ้งเตือนเสียงบน iPhone ไม่ทำงาน?</span>
              ต้องการแจ้งเตือนแบบมีเสียงบน iPhone? กรุณาติดตั้งแอปลงบนหน้าจอโฮมก่อน: กดปุ่ม <span className="font-extrabold text-amber-950 underline">แชร์ (Share)</span> ที่แถบล่างสุดของเบราว์เซอร์ Safari แล้วเลือก <span className="font-extrabold text-amber-950 underline">"เพิ่มไปยังหน้าจอโฮม (Add to Home Screen)"</span> จากนั้นค่อยเปิดสิทธิ์แจ้งเตือนในแอป
            </div>
            <button 
              onClick={() => setShowIOSPrompt(false)}
              className="absolute top-3.5 right-3.5 text-amber-500 hover:text-amber-800 font-bold px-1 text-sm transition"
              aria-label="ปิดกล่องแนะนำ"
            >
              ✕
            </button>
          </div>
        )}
        {/* Desktop Top Right Actions */}
        <div className="absolute top-4 right-4 md:top-8 md:right-8 z-10 hidden md:block">
          {!user ? (
             <button
               onClick={handleLogin}
               className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-sm font-semibold transition shadow-sm flex items-center gap-2"
             >
               เข้าสู่ระบบ
             </button>
          ) : null}
        </div>

        <div className="flex-1 px-4 py-6 md:p-8">
          <Routes>
            {user && user.role === 'unassigned' ? (
              <>
                <Route path="/setup" element={<RoleSelector onSelect={handleRoleSelect} />} />
                <Route path="*" element={<Navigate to="/setup" />} />
              </>
            ) : (!user || user.role === 'general') ? (
              <>
                <Route path="/" element={<TaskList user={user} />} />
                <Route path="/compare" element={<Compare user={user} />} />
                <Route path="/settings" element={<SettingsPage user={user} />} />
                <Route path="/tasks" element={<Navigate to="/" />} />
                <Route path="*" element={<Navigate to="/" />} />
              </>
            ) : (
              <>
                <Route path="/" element={<TaskList user={user} />} />
                <Route path="/tasks" element={<Navigate to="/" />} />
                <Route path="/compare" element={<Compare user={user} />} />
                <Route path="/dashboard" element={<Dashboard user={user} />} />
                <Route path="/report" element={<Report user={user} />} />
                <Route path="/settings" element={<SettingsPage user={user} />} />
                <Route path="/setup" element={<RoleSelector onSelect={handleRoleSelect} />} />
                <Route path="*" element={<Navigate to="/" />} />
              </>
            )}
          </Routes>
        </div>
      </main>

      {/* Mobile Bottom Navigation (fixed at bottom of screen) */}
      {user && user.role !== 'unassigned' && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex items-center justify-around px-1 z-40 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <Link 
            to="/" 
            className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition ${
              currentPath === '/'
                ? 'text-indigo-600 font-bold scale-105' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[9px] mt-1 font-semibold">ตารางงาน</span>
          </Link>
          <Link 
            to="/compare" 
            className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition ${
              currentPath === '/compare'
                ? 'text-indigo-600 font-bold scale-105' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <GitCompare className="w-5 h-5" />
            <span className="text-[9px] mt-1 font-semibold">เปรียบเทียบ</span>
          </Link>
          {user.role !== 'general' && (
            <>
              <Link 
                to="/dashboard" 
                className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition ${
                  currentPath === '/dashboard' 
                    ? 'text-indigo-600 font-bold scale-105' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                <span className="text-[9px] mt-1 font-semibold">ภาพรวม</span>
              </Link>
              <Link 
                to="/report" 
                className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition ${
                  currentPath === '/report' 
                    ? 'text-indigo-600 font-bold scale-105' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <PieChart className="w-5 h-5" />
                <span className="text-[9px] mt-1 font-semibold">รายงาน</span>
              </Link>
            </>
          )}
          <Link 
            to="/settings" 
            className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition ${
              currentPath === '/settings' 
                ? 'text-indigo-600 font-bold scale-105' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-[9px] mt-1 font-semibold">ตั้งค่า</span>
          </Link>
        </nav>
      )}

      {/* Login Error Modal */}
      {loginError && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">การเข้าสู่ระบบถูกปฏิเสธ</h3>
            <p className="text-slate-600 text-sm leading-relaxed">{loginError}</p>
            <button
              onClick={() => setLoginError(null)}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-medium py-2.5 rounded-xl transition duration-150 active:scale-95 shadow-md"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
