import { useState, useEffect } from 'react';
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { User, Role } from './types';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
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
              role: isSpecialAdmin ? 'executive' : 'general', // Temporary, will be updated via RoleSelector unless admin
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
            role: firebaseUser.email === 'tamrri@gmail.com' ? 'executive' : 'general',
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

  // We handle redirection to /setup below in Routes.

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
        {/* Sidebar */}
        <aside className="w-full md:w-64 bg-indigo-900 flex-shrink-0 flex flex-col">
          <div className="p-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-400 rounded-xl flex items-center justify-center text-white font-bold text-xl">
              B
            </div>
            <h2 className="font-bold text-white text-lg">MHS1 Tracker</h2>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            <Link to="/tasks" className="flex items-center gap-3 px-4 py-3 text-indigo-300 hover:bg-white/10 hover:text-white rounded-xl transition">
              <Calendar className="w-5 h-5" />
              <span className="font-medium">ตารางงาน</span>
            </Link>
            <Link to="/dashboard" className="flex items-center gap-3 px-4 py-3 text-indigo-300 hover:bg-white/10 hover:text-white rounded-xl transition">
              <LayoutDashboard className="w-5 h-5" />
              <span className="font-medium">ภาพรวม</span>
            </Link>
            <Link to="/report" className="flex items-center gap-3 px-4 py-3 text-indigo-300 hover:bg-white/10 hover:text-white rounded-xl transition">
              <PieChart className="w-5 h-5" />
              <span className="font-medium">รายงาน</span>
            </Link>
            {user?.role === 'staff' || user?.role === 'executive' ? (
               <Link to="/settings" className="flex items-center gap-3 px-4 py-3 text-indigo-300 hover:bg-white/10 hover:text-white rounded-xl transition">
                 <Settings className="w-5 h-5" />
                 <span className="font-medium">ตั้งค่าระบบ</span>
               </Link>
            ) : null}
          </nav>
          
          {/* User Profile in Sidebar (Mobile Only or Hidden if we move it to Top Right) */}
          {user && (
            <div className="p-4 hidden md:block">
              <div className="flex items-center gap-3 mb-4">
                <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full border-2 border-indigo-400" />
                <div className="overflow-hidden">
                  <p className="text-sm font-medium text-white truncate">{user.displayName}</p>
                  <p className="text-xs text-indigo-300 capitalize">{user.role}</p>
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

        {/* Main Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto relative flex flex-col">
          {/* Top Navigation / Header area for Login button */}
          <div className="absolute top-4 right-4 md:top-8 md:right-8 z-10">
            {!user ? (
               <button
                 onClick={handleLogin}
                 className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-semibold transition shadow-sm flex items-center gap-2"
               >
                 เข้าสู่ระบบ
               </button>
            ) : (
               <div className="md:hidden flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                 <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-indigo-100" />
                 <button onClick={handleLogout} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><LogOut className="w-4 h-4" /></button>
               </div>
            )}
          </div>

          <Routes>
            {user && user.role === 'general' ? (
              <>
                <Route path="/setup" element={<RoleSelector onSelect={handleRoleSelect} />} />
                <Route path="*" element={<Navigate to="/setup" />} />
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
        </main>
      </div>
    </BrowserRouter>
  );
}
