"use client";

import { useState, useMemo, useEffect } from "react";
import { X, Calendar, Beer, ArrowRightLeft, ShieldCheck, Trash2, Save, AlertTriangle, Plus } from "lucide-react";
import { format, startOfDay } from "date-fns";
import { ja } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface BatchDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: any;
  isBrew: boolean;
  allTanks: any[];
  onUpdate: () => void;
  onDelete: () => void;
}

export default function BatchDetailModal({ isOpen, onClose, batch, isBrew, allTanks, onUpdate, onDelete }: BatchDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTankIds, setSelectedTankIds] = useState<string[]>([]);
  const [newTransferDates, setNewTransferDates] = useState<Record<number, string>>({});
  const [color, setColor] = useState("#DBEAFE");

  // Derive the current tank sequence from batch tasks
  const currentSegments = useMemo(() => {
    if (!batch?.tasks) return [];
    const sortedTasks = [...batch.tasks].sort((a, b) => (a.offsetDays || 0) - (b.offsetDays || 0));
    const tankIdsInOrder: string[] = [];
    let lastTankId = "";
    sortedTasks.forEach(t => {
      if (t.isTankMovement && t.name.includes("(受入)")) return;
      if (t.tankId !== lastTankId) {
        tankIdsInOrder.push(t.tankId);
        lastTankId = t.tankId;
      }
    });
    return tankIdsInOrder;
  }, [batch]);

  useEffect(() => {
    if (isOpen && batch) {
       setSelectedTankIds(currentSegments);
       setNewTransferDates({});
       setName(batch.name);
       setColor(batch.color || "#DBEAFE");
       setIsEditing(false);
       setIsDeleting(false);
       setError(null);
    }
  }, [isOpen, batch, currentSegments]);

  const handleSave = async () => {
    if (!batch) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/batches/${batch.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name, 
          tankIds: selectedTankIds,
          newTransferDates,
          color
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await onUpdate();
        onClose();
      } else {
        setError(data.error || "更新に失敗しました。");
      }
    } catch (err) {
      console.error("Failed to update batch:", err);
      setError("通信エラーが発生しました。");
    } finally {
      setIsLoading(false);
    }
  };

  const addTankStep = () => {
    setSelectedTankIds(prev => [...prev, ""]);
    const nextIdx = selectedTankIds.length;
    const lastDate = batch?.tasks?.length > 0 ? format(new Date(Math.max(...batch.tasks.map((t:any) => new Date(t.date).getTime()))), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
    setNewTransferDates(prev => ({ ...prev, [nextIdx]: lastDate }));
  };

  const handleDeleteConfirm = async () => {
    if (!batch) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/batches/${batch.id}`, { method: "DELETE" });
      if (res.ok) {
        await onDelete();
        onClose();
      }
    } catch (err) {
      console.error("Failed to delete batch:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !batch) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm shadow-2xl">
      <div className="bg-white dark:bg-slate-950 w-full max-w-lg rounded-3xl shadow-3xl border border-slate-100 dark:border-slate-800 flex flex-col max-h-[90vh]">
        <header className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-950 sticky top-0 rounded-t-3xl z-10">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                <Beer className="w-5 h-5" />
             </div>
             <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white leading-none tracking-tight">{batch.name}</h2>
                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{batch.template?.name || "一般バッチ"}</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </header>

        <div className="flex-grow overflow-y-auto p-6 space-y-8">
           {error && (
             <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex gap-3 text-red-700 animate-in fade-in slide-in-from-top-4 duration-300">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <p className="text-xs font-bold leading-relaxed">{error}</p>
             </div>
           )}

           {isBrew && (
             <section className="space-y-4">
                <div className="flex items-center justify-between ml-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <ArrowRightLeft className="w-4 h-4 text-primary" /> タンク割り当て状況
                   </label>
                   {!isEditing && (
                     <button onClick={() => setIsEditing(true)} className="text-[10px] font-black text-primary hover:underline uppercase">変更する</button>
                   )}
                </div>

                <div className="space-y-3">
                   {selectedTankIds.map((tid, idx) => {
                     const isNew = idx >= currentSegments.length;
                     return (
                       <div key={idx} className={cn(
                         "flex flex-col gap-2 p-4 rounded-2xl border transition-all",
                         isEditing ? "bg-slate-50 dark:bg-slate-900/50 border-primary/20" : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800"
                       )}>
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-black flex items-center justify-center">
                               {idx + 1}
                            </div>
                            <div className="flex-grow">
                               {isEditing ? (
                                 <select value={tid} onChange={e => {
                                   const next = [...selectedTankIds];
                                   next[idx] = e.target.value;
                                   setSelectedTankIds(next);
                                 }} className="w-full bg-transparent font-black text-sm outline-none border-none p-0 cursor-pointer dark:text-white appearance-none">
                                    <option value="">タンクを選択...</option>
                                    {allTanks.filter(t => t.category === "TANK" || !t.category).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                 </select>
                               ) : (
                                 <p className="text-sm font-black text-slate-700 dark:text-white">{allTanks.find(t => t.id === tid)?.name || "未選択"}</p>
                               )}
                               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                  {idx === 0 ? "初期使用タンク" : `移送先タンク ${idx}`}
                               </p>
                            </div>
                            {isNew && isEditing && (
                              <button onClick={() => {
                                const nextTanks = [...selectedTankIds];
                                nextTanks.splice(idx, 1);
                                setSelectedTankIds(nextTanks);
                                const nextDates = { ...newTransferDates };
                                delete nextDates[idx];
                                setNewTransferDates(nextDates);
                              }} className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          
                          {isNew && isEditing && (
                            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-[10px] font-black text-slate-400 uppercase">移送日プリセット:</span>
                              <input type="date" value={newTransferDates[idx] || ""} onChange={e => setNewTransferDates(prev => ({ ...prev, [idx]: e.target.value }))}
                                className="bg-transparent text-xs font-bold outline-none dark:text-white cursor-pointer" />
                            </div>
                          )}
                       </div>
                     );
                   })}
                   
                   {isEditing && (
                     <button type="button" onClick={addTankStep}
                       className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-400 hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2">
                        <Plus className="w-4 h-4" /> 移送先を追加
                     </button>
                   )}
                </div>

                {isEditing && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-2xl flex gap-3 text-amber-700 dark:text-amber-400">
                     <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                     <p className="text-[10px] font-bold">急な予定変更によりタンクを変更・追加できます。保存すると全ての工程が再構築されます。</p>
                  </div>
                )}
             </section>
           )}

           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">バッチ名（変更）</label>
                 <input value={name} onChange={e => setName(e.target.value)} disabled={!isEditing}
                   className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-primary outline-none transition-all font-bold text-sm dark:text-white disabled:opacity-50" />
              </div>
              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">カラー設定</label>
                 <div className="flex flex-wrap gap-1.5 p-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl">
                   {["#DBEAFE", "#FFE4E6", "#FEF3C7", "#D1FAE5", "#EDE9FE", "#CFFAFE", "#E0E7FF", "#FCE7F3", "#CCFBF1", "#ECFCCB"].map(c => (
                     <button key={c} type="button" onClick={() => { setColor(c); setIsEditing(true); }}
                       className={cn("w-6 h-6 rounded-md border-2 transition-all hover:scale-110", c === color ? "border-slate-900 dark:border-white scale-110 shadow-md" : "border-transparent opacity-60 hover:opacity-100")}
                       style={{ backgroundColor: c }} />
                   ))}
                 </div>
              </div>
           </div>
        </div>

        <footer className="p-6 border-t border-slate-100 dark:border-slate-800 space-y-3 bg-white dark:bg-slate-950 rounded-b-3xl">
          {isEditing ? (
             <div className="flex gap-3">
                <button onClick={() => setIsEditing(false)} className="flex-1 py-3 text-sm font-black text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all">キャンセル</button>
                <button onClick={handleSave} disabled={isLoading} className="flex-[2] py-3 bg-primary text-white font-black text-sm rounded-2xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50">
                  {isLoading ? <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <Save className="w-4 h-4" />}
                  変更を保存
                </button>
             </div>
          ) : isDeleting ? (
             <div className="space-y-4">
                <p className="text-xs font-black text-center text-red-500 uppercase tracking-wider italic">本当に削除しますか？工程データがすべて失われます。</p>
                <div className="flex gap-3">
                   <button onClick={() => setIsDeleting(false)} className="flex-1 py-3 text-sm font-black text-slate-400 dark:hover:bg-slate-800 rounded-2xl">戻る</button>
                   <button onClick={handleDeleteConfirm} disabled={isLoading} className="flex-1 py-3 bg-red-500 text-white font-black text-sm rounded-2xl shadow-lg hover:bg-red-600 transition-all disabled:opacity-50">
                     {isLoading ? "削除中..." : "完全に削除"}
                   </button>
                </div>
             </div>
          ) : isBrew ? (
             <button onClick={() => setIsDeleting(true)} className="w-full py-3 flex items-center justify-center gap-2 text-xs font-black text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all">
                <Trash2 className="w-4 h-4" /> バッチ全体の削除
             </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
