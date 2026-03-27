"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Calendar, Beer, Layout, Save, AlertTriangle } from "lucide-react";
import { format, addDays, startOfDay, isBefore, isAfter } from "date-fns";
import { ja } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface AddBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: any[];
  tanks: any[];
  tankStays?: Array<{
    batchId: string;
    tankId: string;
    tankName: string;
    batchName: string;
    startDate: Date;
    endDate: Date;
    occupancyStart: Date | null;
    occupancyEnd: Date | null;
  }>;
  onSuccess?: () => void;
}

function datesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return !isAfter(aStart, bEnd) && !isBefore(aEnd, bStart);
}

export default function AddBatchModal({ isOpen, onClose, templates, tanks, tankStays = [], onSuccess }: AddBatchModalProps) {
  const [name, setName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [brewDate, setBrewDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedTankIds, setSelectedTankIds] = useState<string[]>([""]);
  const [color, setColor] = useState("#DBEAFE");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
    }
  }, [isOpen]);

  const segments = useMemo(() => {
    if (!selectedTemplateId) {
      setError(null);
      return [];
    }
    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) return [];

    const sorted = [...(template.tasks || [])].sort((a,b) => a.offsetDays - b.offsetDays);
    const result: any[] = [];
    
    // Split by CIP tasks to identify segments (tank stays)
    const cips = sorted.filter(t => t.isCIP);
    const transfers = sorted.filter(t => t.isTankMovement);

    cips.forEach((cip, idx) => {
      const prevCipOffset = idx === 0 ? sorted[0]?.offsetDays || 0 : cips[idx - 1].offsetDays;
      const incomingTransfer = idx === 0 ? null : transfers[idx - 1];
      
      const startOffset = incomingTransfer ? incomingTransfer.offsetDays : prevCipOffset;
      const endOffset = cip.offsetDays;

      result.push({
        startOffset,
        endOffset,
        name: idx === 0 ? "初期使用タンク" : `移送先タンク ${idx}`,
      });
    });
    return result;
  }, [selectedTemplateId, templates]);

  useEffect(() => {
    if (segments.length > 0) {
      setSelectedTankIds(prev => {
        const next = [...prev];
        while (next.length < segments.length) next.push("");
        return next.slice(0, segments.length);
      });
    } else {
      setSelectedTankIds([""]);
    }
  }, [selectedTemplateId, segments.length]);

  const conflicts = useMemo(() => {
    if (!selectedTemplateId || !brewDate || selectedTankIds.some(id => !id)) return [];
    const brew = startOfDay(new Date(brewDate));
    const found: any[] = [];

    segments.forEach((seg, idx) => {
      const tankId = selectedTankIds[idx];
      const start = addDays(brew, seg.startOffset);
      const end = addDays(brew, seg.endOffset);

      const overlap = tankStays.filter(s => {
        if (s.tankId !== tankId || !s.occupancyStart || !s.occupancyEnd) return false;
        return datesOverlap(start, end, startOfDay(s.occupancyStart), startOfDay(s.occupancyEnd));
      });
      overlap.forEach(o => {
        if (!found.find(f => f.tankId === o.tankId && f.batchId === o.batchId)) found.push(o);
      });
    });
    return found;
  }, [selectedTankIds, selectedTemplateId, brewDate, tankStays, segments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !selectedTemplateId || selectedTankIds.some(id => !id)) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name, 
          templateId: selectedTemplateId, 
          brewDate, 
          tankId: selectedTankIds[0], 
          tankIds: selectedTankIds,
          color
        }),
      });

      const data = await res.json();

      if (res.ok) {
        onClose();
        if (onSuccess) onSuccess();
        setName(""); 
        setSelectedTemplateId(""); 
        setBrewDate(format(new Date(), "yyyy-MM-dd")); 
        setSelectedTankIds([""]);
      } else {
        setError(data.error || "登録に失敗しました。");
      }
    } catch (err) {
      console.error(err);
      setError("通信エラーが発生しました。");
    } finally {
      setIsLoading(false);
    }
  };

  const PALE_COLORS = [
    "#DBEAFE", "#FFE4E6", "#FEF3C7", "#D1FAE5", "#EDE9FE", 
    "#CFFAFE", "#E0E7FF", "#FCE7F3", "#CCFBF1", "#ECFCCB"
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-950 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <header className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">仕込み登録</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
        </header>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl flex gap-3 text-red-700 dark:text-red-400 animate-in fade-in slide-in-from-top-4 duration-300">
               <AlertTriangle className="w-5 h-5 flex-shrink-0" />
               <p className="text-xs font-bold leading-relaxed">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">バッチ名称</label>
              <input required value={name} onChange={e => { setName(e.target.value); setError(null); }} placeholder="例: Ale #1"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-bold dark:text-white" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">タイムライン・カラー</label>
              <div className="flex flex-wrap gap-1.5 p-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                {PALE_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setColor(c)}
                    className={cn("w-6 h-6 rounded-md border-2 transition-all", c === color ? "border-slate-900 dark:border-white scale-110" : "border-transparent opacity-60 hover:opacity-100")}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">テンプレート</label>
              <select required value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-bold appearance-none dark:text-white">
                <option value="">選択...</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">仕込み日</label>
              <input type="date" required value={brewDate} onChange={e => { setBrewDate(e.target.value); setError(null); }}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-bold dark:text-white" />
            </div>
          </div>

          {segments.length > 0 && (
            <div className="space-y-4 pt-4 border-t dark:border-slate-800">
              <p className="text-[10px] font-black text-slate-400 uppercase">タンク割り当て</p>
              {segments.map((seg, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400 px-1">
                    <span>{seg.name}</span>
                    <span>Day {seg.startOffset} 〜 {seg.endOffset}</span>
                  </div>
                  <select required value={selectedTankIds[idx] || ""} onChange={e => {
                    const next = [...selectedTankIds];
                    next[idx] = e.target.value;
                    setSelectedTankIds(next);
                    setError(null);
                  }} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-bold dark:text-white">
                    <option value="">タンクを選択...</option>
                    {tanks.filter(t => t.category === "TANK" || !t.category).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}

          {conflicts.length > 0 && !error && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl flex gap-3 text-amber-700 dark:text-amber-400">
               <AlertTriangle className="w-5 h-5 flex-shrink-0" />
               <div className="text-xs font-bold">
                 <p>既に予定が入っているタンクがあります。登録はブロックされます。</p>
                 <ul className="mt-1 list-disc list-inside opacity-70">
                    {conflicts.map(c => <li key={c.batchId}>{c.batchName} ({c.tankName})</li>)}
                 </ul>
               </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 text-sm font-bold text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all">閉じる</button>
            <button type="submit" disabled={isLoading} className="flex-[2] py-3 bg-primary text-white rounded-2xl font-black shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50">
              {isLoading ? "保存中..." : "登録する"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
