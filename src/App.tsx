import { useState, useEffect } from 'react';
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { User, Role } from './types';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { LogOut, Home, Calendar, PieChart, Bell, LayoutDashboard, Settings } from 'lucide-react';

import Dashboard from './components/Dashboard';
import TaskList from './components/TaskList';
import Report from './components/Report';
import RoleSelector from './components/RoleSelector';
import SettingsPage from './components/SettingsPage';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Fetch custom user profile from Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          const isSpecialAdmin = firebaseUser.email === 'tamrri@gmail.com';
          let userData: User;

          if (userDoc.exists()) {
            userData = userDoc.data() as User;
            if (isSpecialAdmin && userData.role !== 'executive') {
              userData.role = 'executive';
              await setDoc(doc(db, 'users', firebaseUser.uid), userData);
            }
          } else {
            // New user, wait for them to select a role
            userData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '',
              photoURL: firebaseUser.photoURL || '',
              role: isSpecialAdmin ? 'executive' : 'unassigned', // Temporary, will be updated via RoleSelector unless admin
            };
            if (isSpecialAdmin) {
               await setDoc(doc(db, 'users', firebaseUser.uid), userData);
            }
          }
          setUser(userData);
        } catch (error) {
          console.error("Error fetching user data:", error);
          // Fallback user if offline
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || '',
            photoURL: firebaseUser.photoURL || '',
            role: firebaseUser.email === 'tamrri@gmail.com' ? 'executive' : 'unassigned',
          });
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
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
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
      />
    </BrowserRouter>
  );
}

function AppContent({
  user,
  handleLogin,
  handleLogout,
  handleRoleSelect
}: {
  user: User | null;
  handleLogin: () => Promise<void>;
  handleLogout: () => Promise<void>;
  handleRoleSelect: (role: Role) => Promise<void>;
}) {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row pb-16 md:pb-0">
      {/* Mobile Top Header */}
      <header className="md:hidden bg-indigo-900 text-white h-16 flex items-center justify-between px-4 fixed top-0 left-0 right-0 z-40 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-400 rounded-lg flex items-center justify-center text-white font-bold text-lg">
            B
          </div>
          <span className="font-bold text-base tracking-wide">MHS1 Tracker</span>
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
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-400 rounded-xl flex items-center justify-center text-white font-bold text-xl">
            B
          </div>
          <h2 className="font-bold text-white text-lg">MHS1 Tracker</h2>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link 
            to="/tasks" 
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${
              currentPath === '/tasks' || currentPath === '/'
                ? 'bg-white/10 text-white font-semibold' 
                : 'text-indigo-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="font-medium">ตารางงาน</span>
          </Link>
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
          {user?.role === 'staff' || user?.role === 'executive' ? (
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
          ) : null}
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
                <Route path="/tasks" element={<TaskList user={user} />} />
                <Route path="*" element={<Navigate to="/tasks" />} />
              </>
            ) : (
              <>
                <Route path="/" element={<Navigate to="/tasks" />} />
                <Route path="/dashboard" element={<Dashboard user={user} />} />
                <Route path="/tasks" element={<TaskList user={user} />} />
                <Route path="/report" element={<Report user={user} />} />
                <Route path="/settings" element={<SettingsPage user={user} />} />
                <Route path="/setup" element={<RoleSelector onSelect={handleRoleSelect} />} />
              </>
            )}
          </Routes>
        </div>
      </main>

      {/* Mobile Bottom Navigation (fixed at bottom of screen) */}
      {user && user.role !== 'general' && user.role !== 'unassigned' && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex items-center justify-around px-2 z-40 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <Link 
            to="/tasks" 
            className={`flex flex-col items-center justify-center w-16 h-14 rounded-xl transition ${
              currentPath === '/tasks' || currentPath === '/'
                ? 'text-indigo-600 font-bold scale-105' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[10px] mt-1 font-medium">ตารางงาน</span>
          </Link>
          <Link 
            to="/dashboard" 
            className={`flex flex-col items-center justify-center w-16 h-14 rounded-xl transition ${
              currentPath === '/dashboard' 
                ? 'text-indigo-600 font-bold scale-105' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px] mt-1 font-medium">ภาพรวม</span>
          </Link>
          <Link 
            to="/report" 
            className={`flex flex-col items-center justify-center w-16 h-14 rounded-xl transition ${
              currentPath === '/report' 
                ? 'text-indigo-600 font-bold scale-105' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <PieChart className="w-5 h-5" />
            <span className="text-[10px] mt-1 font-medium">รายงาน</span>
          </Link>
          {(user?.role === 'staff' || user?.role === 'executive') && (
            <Link 
              to="/settings" 
              className={`flex flex-col items-center justify-center w-16 h-14 rounded-xl transition ${
                currentPath === '/settings' 
                  ? 'text-indigo-600 font-bold scale-105' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Settings className="w-5 h-5" />
              <span className="text-[10px] mt-1 font-medium">ตั้งค่า</span>
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
