"use client";

import { useState, useMemo, useEffect } from "react";
import { X, Plus, Trash2, Calendar, Clock, ArrowRightLeft, ShieldCheck, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  name: string;
  offsetDays: number;
  isTankMovement: boolean;
  isCIP: boolean;
  blockIndex: number; // Source of truth for block membership
}

interface AddTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingTemplate?: any;
}

export default function AddTemplateModal({ isOpen, onClose, onSuccess, editingTemplate }: AddTemplateModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingTemplate && isOpen) {
      setName(editingTemplate.name || "");
      setDescription(editingTemplate.description || "");
      
      // Load and assign blockIndex based on CIP positions
      let currentBIdx = 0;
      const loadedTasks = (editingTemplate.tasks || []).map((t: any) => {
        const taskObj = {
          id: t.id || Math.random().toString(36).substr(2, 9),
          name: t.name,
          offsetDays: t.offsetDays,
          isTankMovement: !!t.isTankMovement,
          isCIP: !!t.isCIP,
          blockIndex: currentBIdx,
        };
        if (t.isCIP) currentBIdx++;
        return taskObj;
      });
      setTasks(loadedTasks);
    } else if (isOpen) {
      setName("");
      setDescription("");
      setTasks([
        { id: Math.random().toString(36).substr(2, 9), name: "企画", offsetDays: -1, isTankMovement: false, isCIP: false, blockIndex: 0 },
        { id: Math.random().toString(36).substr(2, 9), name: "仕込み", offsetDays: 0, isTankMovement: false, isCIP: false, blockIndex: 0 },
        { id: Math.random().toString(36).substr(2, 9), name: "CIP0", offsetDays: 7, isTankMovement: false, isCIP: true, blockIndex: 0 },
      ]);
    }
  }, [editingTemplate, isOpen]);

  const blocks = useMemo(() => {
    const matchedBlocks: any[] = [];
    const maxBIdx = tasks.length > 0 ? Math.max(...tasks.map(t => t.blockIndex)) : 0;

    for (let i = 0; i <= maxBIdx; i++) {
      // Find tasks belonging to this blockIndex
      const ownTasks = tasks.filter(t => t.blockIndex === i).sort((a, b) => a.offsetDays - b.offsetDays);
      if (ownTasks.length === 0) continue;

      const cip = ownTasks.find(t => t.isCIP);
      if (!cip) continue;

      // Find arrival task (it was the departure transfer of the PREVIOUS blockIndex)
      const arrivalTransfer = i === 0 ? null : tasks.find(t => t.blockIndex === i - 1 && t.isTankMovement);
      
      const startLabel = i === 0 ? "企画" : (arrivalTransfer ? arrivalTransfer.name : "受入");
      const title = `【${startLabel} 〜 ${cip.name}】`;

      matchedBlocks.push({
        idx: i,
        title,
        tasks: arrivalTransfer ? [arrivalTransfer, ...ownTasks] : ownTasks
      });
    }

    return matchedBlocks;
  }, [tasks]);

  const addTaskToSegment = (blockIndex: number, prevTaskId: string) => {
    const idx = tasks.findIndex(t => t.id === prevTaskId);
    const prevTask = tasks[idx];
    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      name: "",
      offsetDays: (prevTask?.offsetDays || 0) + 1,
      isTankMovement: false,
      isCIP: false,
      blockIndex,
    };
    const newTasks = [...tasks];
    if (idx !== -1) {
      newTasks.splice(idx + 1, 0, newTask);
    } else {
      newTasks.push(newTask);
    }
    setTasks(newTasks);
  };

  const addTransferAfterTask = (blockIndex: number, cipTaskId: string) => {
    const idx = tasks.findIndex(t => t.id === cipTaskId);
    const cipTask = tasks[idx];
    
    // Auto-count existing transfers
    const transferCount = tasks.filter(t => t.isTankMovement).length + 1;
    
    // Create Transfer (In current block)
    const moveTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      name: `移送${transferCount}`,
      offsetDays: cipTask.offsetDays - 1,
      isTankMovement: true,
      isCIP: false,
      blockIndex, // Departure belongs to current tank
    };
    
    // Create new CIP (In next block)
    const nextCipTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      name: `CIP${transferCount}`,
      offsetDays: cipTask.offsetDays + 7,
      isTankMovement: false,
      isCIP: true,
      blockIndex: blockIndex + 1, // New block
    };
    
    const newTasks = [...tasks];
    // Put movement before current CIP
    newTasks.splice(idx, 0, moveTask);
    // Put next CIP at the end
    newTasks.push(nextCipTask);
    setTasks(newTasks);
  };

  const updateTask = (taskId: string, field: keyof Task, value: any) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, [field]: value } : t));
  };

  const removeTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || isSubmitting) return;

    // Sorting the final list for DB consistency
    const sorted = [...tasks].sort((a, b) => a.offsetDays - b.offsetDays);
    if (sorted.length > 0 && !sorted[sorted.length - 1].isCIP) {
      setError("構成の最後は「CIP（洗浄）」で終わる必要があります。");
      return;
    }

    setIsSubmitting(true);
    try {
      const isEdit = !!editingTemplate;
      const res = await fetch("/api/templates", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingTemplate?.id, name, description, tasks: sorted }),
      });
      if (res.ok) {
        onSuccess();
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm shadow-2xl overflow-hidden">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-3xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" /> {editingTemplate ? "テンプレート編集" : "テンプレート作成"}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-8 space-y-8">
          {error && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold border border-red-100">{error}</div>}
          
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">テンプレート名称</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="例: ペールエール"
                className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-primary outline-none transition-all font-bold" />
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between ml-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" /> タンク使用ブロック構成 (移送経路)
              </label>
              <span className="text-[9px] font-bold text-slate-400 italic">※見出しと工程の関係性は固定されています。</span>
            </div>

            <div className="space-y-12 relative">
               {blocks.map((block) => (
                 <div key={block.idx} className="space-y-4">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-primary text-white text-xs font-black flex items-center justify-center shadow-lg shadow-primary/20">{block.idx + 1}</div>
                      <h3 className="text-sm font-black text-slate-700 dark:text-white tracking-widest uppercase">{block.title}</h3>
                   </div>

                   <div className="space-y-2 pl-11">
                      {block.tasks.map((task: Task, tIdx: number) => {
                        // Inherited tasks are from the previous blockIndex
                        const isInherited = task.blockIndex < block.idx || (task.name === "仕込み" && task.offsetDays === 0 && block.idx === 0);
                        const isMainControl = isInherited || task.isCIP || task.isTankMovement;

                        return (
                          <div key={`${block.idx}-${task.id}`} className={cn(
                            "flex items-center gap-3 p-3 rounded-2xl border transition-all",
                            task.isCIP ? "bg-red-50/50 dark:bg-red-950/20 border-red-100 dark:border-red-900/50" : 
                            task.isTankMovement ? "bg-purple-50/50 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900/50" :
                            "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 shadow-sm"
                          )}>
                             <div className="flex-grow grid grid-cols-12 gap-3 items-center">
                               <div className="col-span-6 relative">
                                  <input value={task.name} disabled={isInherited}
                                    onChange={e => updateTask(task.id, "name", e.target.value)}
                                    className="w-full pl-8 pr-4 py-1.5 bg-transparent border-none rounded-lg text-xs font-bold outline-none" placeholder="工程名..." />
                                  {task.isCIP ? <Trash2 className="w-4 h-4 text-red-500 absolute left-2 top-1/2 -translate-y-1/2" /> :
                                   task.isTankMovement ? <ArrowRightLeft className="w-4 h-4 text-purple-500 absolute left-2 top-1/2 -translate-y-1/2" /> :
                                   <Clock className="w-4 h-4 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />}
                               </div>
                               <div className="col-span-3 flex items-center gap-2">
                                  <input type="number" value={task.offsetDays} disabled={isInherited}
                                    onChange={e => updateTask(task.id, "offsetDays", parseInt(e.target.value) || 0)}
                                    className="w-full p-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-xs font-black text-center outline-none" />
                                  <span className="text-[10px] font-bold text-slate-400">Day</span>
                                </div>
                               <div className="col-span-3 flex justify-end">
                                  {!isMainControl && (
                                    <button type="button" onClick={() => removeTask(task.id)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                                  )}
                                  {task.isCIP && block.idx === blocks.length - 1 && (
                                    <button type="button" onClick={() => addTransferAfterTask(block.idx, task.id)} className="px-2 py-1 bg-purple-500 text-white rounded-lg text-[8px] font-black hover:opacity-90 transition-all">+ 移送を追加</button>
                                  )}
                               </div>
                             </div>
                          </div>
                        );
                      })}
                      <button type="button" onClick={() => addTaskToSegment(block.idx, block.tasks[block.tasks.length - 1].id)}
                        className="w-full py-2 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 hover:text-primary transition-all text-[10px] font-black flex items-center justify-center gap-2">
                        <Plus className="w-3 h-3" /> 中間工程を追加
                      </button>
                   </div>
                 </div>
               ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-3 px-4 rounded-2xl text-sm font-black text-slate-500 hover:bg-slate-100 transition-colors">キャンセル</button>
          <button onClick={handleSubmit} disabled={isSubmitting} className="flex-[2] py-3 px-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-sm font-black shadow-xl hover:opacity-90 disabled:opacity-50 transition-all">
            {isSubmitting ? "保存中..." : "保存する"}
          </button>
        </div>
      </div>
    </div>
  );
}
