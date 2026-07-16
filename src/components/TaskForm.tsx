import React, { useState, useRef } from 'react';
import { User, Task } from '../types';
import { db, storage, auth } from '../firebase';
import { doc, setDoc, collection } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { X, Send, Trash2, Paperclip, FileText } from 'lucide-react';
import axios from 'axios';

export default function TaskForm({ task, user, onClose, onDelete }: { task: Task | null, user: User | null, onClose: () => void, onDelete?: (id: string) => void }) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [date, setDate] = useState(task?.date || new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(task?.time || '');
  const [assignees, setAssignees] = useState<string[]>(task?.assignees || (task?.assignee ? [task.assignee] : []));
  const priority = 'medium';
  const [loading, setLoading] = useState(false);
  const [notifyLine, setNotifyLine] = useState(true);
  
  const [file, setFile] = useState<File | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState(task?.attachmentUrl || '');
  const [attachmentName, setAttachmentName] = useState(task?.attachmentName || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return; // Guard clause
    
    setLoading(true);
    try {
      let currentAttachmentUrl = attachmentUrl;
      let currentAttachmentName = attachmentName;
      
      if (file) {
        const fileRef = ref(storage, `attachments/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(fileRef, file);
        currentAttachmentUrl = await getDownloadURL(snapshot.ref);
        currentAttachmentName = file.name;
      }

      const taskId = task?.id || doc(collection(db, 'tasks')).id;
      const taskData: Partial<Task> = {
        title,
        description,
        date,
        time,
        assignees,
        priority,
        status: task?.status || 'pending',
        createdBy: task?.createdBy || user.displayName,
        createdAt: task?.createdAt || Date.now(),
        attachmentUrl: currentAttachmentUrl,
        attachmentName: currentAttachmentName,
      };

      if (task) {
        await setDoc(doc(db, 'tasks', taskId), { ...taskData, id: taskId }, { merge: true });
      } else {
        await setDoc(doc(db, 'tasks', taskId), { ...taskData, id: taskId });
      }

      // Send LINE notification via our backend API
      if (notifyLine) {
        const actionText = task ? 'อัปเดตภารกิจ' : 'เพิ่มภารกิจใหม่';
        const assigneeNames = assignees.length > 0 ? assignees.join(', ') : 'ไม่ได้ระบุ';
        const message = `🔔 ${actionText}\nงานที่ต้องไปด้วย: ${title}\nผู้รับผิดชอบ: ${assigneeNames}\nวันที่: ${date}${time ? ` เวลา: ${time} น.` : ''}\nสถานะ: รอดำเนินการ\n\nโปรดตรวจสอบรายละเอียดในระบบ`;
        
        try {
          const idToken = await auth.currentUser?.getIdToken();
          const headers = idToken ? { Authorization: `Bearer ${idToken}` } : {};
          await axios.post('/api/notify', { message }, { headers });
        } catch (err) {
          console.error("Failed to send LINE notification", err);
          // Don't block the UI if line fails, but log it
        }
      }

      onClose();
    } catch (error) {
      console.error("Error saving task", error);
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 overflow-y-auto flex items-start justify-center p-4 py-8">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md my-auto relative overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">{task ? 'แก้ไขภารกิจ' : 'เพิ่มภารกิจใหม่'}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ชื่องาน <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition"
              placeholder="เช่น ประชุมคณะกรรมการ..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">รายละเอียด</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition resize-none h-24"
              placeholder="เพิ่มรายละเอียดของงาน..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">วันที่ <span className="text-red-500">*</span></label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">เวลา</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-500 mb-1">ผู้บันทึกภารกิจ</label>
            <div className="w-full px-4 py-2.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-sm font-medium mb-4">
              {task?.createdBy || user?.displayName || 'ไม่ระบุ'}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">ผู้รับผิดชอบ</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {['นางสาววรินทร ปัดกอง', 'นายสากล ชนะบูรณ์', 'นายจักรวาล เขียวดีเจริญกุล', 'นางสาวญาสุมินทร์ นนทมาตร'].map(name => {
                const isSelected = assignees.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setAssignees(prev => prev.filter(n => n !== name));
                      } else {
                        setAssignees(prev => [...prev, name]);
                      }
                    }}
                    className={`py-2 px-3 rounded-xl text-sm font-medium transition border text-left flex items-center justify-between ${
                      isSelected 
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate">{name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">เอกสารแนบ (หนังสือราชการ / ไฟล์อื่นๆ)</label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setFile(e.target.files[0]);
                  }
                }}
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
              >
                <Paperclip className="w-4 h-4" />
                เลือกไฟล์
              </button>
              {(file || attachmentName) && (
                <div className="flex items-center gap-2 text-sm text-indigo-600 font-medium">
                  <FileText className="w-4 h-4" />
                  <span className="truncate max-w-[200px]">{file ? file.name : attachmentName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setAttachmentName('');
                      setAttachmentUrl('');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="p-1 hover:bg-indigo-50 rounded-full text-slate-400 hover:text-red-500 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={notifyLine}
                  onChange={e => setNotifyLine(e.target.checked)}
                  className="w-5 h-5 border-2 border-slate-300 rounded text-indigo-600 focus:ring-indigo-500 transition-all peer"
                />
              </div>
              <div className="flex items-center gap-1.5 text-sm text-slate-700 group-hover:text-slate-900 transition">
                <Send className="w-4 h-4 text-green-500" />
                ส่งแจ้งเตือนไปยังผู้ใช้งานทั้งหมด
              </div>
            </label>
          </div>

          <div className="pt-6 flex gap-3">
            {task?.id && onDelete && (
              <button
                type="button"
                onClick={() => {
                  onDelete(task.id);
                  onClose();
                }}
                className="px-4 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 font-medium rounded-xl transition flex items-center gap-2"
                title="ลบภารกิจนี้"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
