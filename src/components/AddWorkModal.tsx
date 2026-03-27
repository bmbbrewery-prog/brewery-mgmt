
"use client";

import React, { useState, useEffect } from "react";
import { X, Calendar, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

interface Tank {
  id: string;
  name: string;
  category: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  workTanks: Tank[]; // WORK category tanks only
  work?: any; // To edit
}

type ScheduleType = "single" | "range" | "weekly";

export default function AddWorkModal({ isOpen, onClose, onSuccess, workTanks, work }: Props) {
  const [name, setName] = useState("");
  const [scheduleType, setScheduleType] = useState<ScheduleType>("single");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [recurringDay, setRecurringDay] = useState(1); // Monday default
  const [recurringUntil, setRecurringUntil] = useState("");
  const [tankId, setTankId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const isEditing = !!work;

  // Init for editing
  useEffect(() => {
    if (isOpen && work) {
      setName(work.name || "");
      setTankId(work.tankId || "");
      
      const s = work.startDate ? format(new Date(work.startDate), "yyyy-MM-dd") : "";
      setStartDate(s);
      
      if (work.isRecurring) {
        setScheduleType("weekly");
        setRecurringDay(work.recurringDay ?? 1);
        setRecurringUntil(work.recurringUntil ? format(new Date(work.recurringUntil), "yyyy-MM-dd") : "");
      } else if (work.endDate) {
        setScheduleType("range");
        setEndDate(format(new Date(work.endDate), "yyyy-MM-dd"));
      } else {
        setScheduleType("single");
      }
    } else if (isOpen) {
      // Clear for new
      setName("");
      setScheduleType("single");
      setStartDate(format(new Date(), "yyyy-MM-dd"));
      setEndDate("");
      setRecurringDay(1);
      setRecurringUntil("");
      setTankId("");
      setError("");
    }
  }, [isOpen, work]);

  if (!isOpen) return null;

  const handleClose = () => {
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("業務名を入力してください"); return; }
    if (!tankId) { setError("業務列を選択してください"); return; }
    if (!startDate) { setError("日付を入力してください"); return; }
    if (scheduleType === "range" && !endDate) { setError("終了日を入力してください"); return; }
    if (scheduleType === "weekly" && !recurringUntil) { setError("繰り返し終了日を入力してください"); return; }

    setIsLoading(true);
    setError("");

    try {
      const body: any = {
        id: work?.id,
        name: name.trim(),
        startDate,
        tankId,
        isRecurring: scheduleType === "weekly",
      };
 
      if (scheduleType === "range") {
        body.endDate = endDate;
      } else if (scheduleType === "weekly") {
        body.recurringDay = recurringDay;
        body.recurringUntil = recurringUntil;
      }

      const res = await fetch("/api/work-schedules", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Failed to save work schedule");

      onSuccess();
      handleClose();
    } catch (err) {
      setError("保存に失敗しました。再試行してください。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-orange-500" />
            </div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
               {isEditing ? "業務を編集" : "業務を追加"}
            </h2>
          </div>
          <button onClick={handleClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">業務名</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：イベント出店、展示会準備..."
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-orange-400 transition font-bold"
            />
          </div>

          {/* Work column (WORK tanks only) */}
          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">業務列</label>
            {workTanks.length === 0 ? (
              <p className="text-sm text-red-400">設定画面で「業務」列を先に追加してください</p>
            ) : (
              <select
                value={tankId}
                onChange={(e) => setTankId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-orange-400 font-bold"
              >
                <option value="">列を選択...</option>
                {workTanks.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Schedule type */}
          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">日程タイプ</label>
            <div className="flex gap-2">
              {[
                { key: "single", label: "単日", icon: "1" },
                { key: "range", label: "期間", icon: "↔" },
                { key: "weekly", label: "毎週", icon: "↻" },
              ].map(({ key, label, icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setScheduleType(key as ScheduleType)}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border-2",
                    scheduleType === key
                      ? "bg-orange-500 text-white border-orange-500 shadow-md"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-100 dark:border-slate-800 hover:border-orange-300"
                  )}
                >
                  <span className="block text-xs">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Date inputs */}
          {scheduleType === "single" && (
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">日付</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-orange-400 font-bold" />
            </div>
          )}

          {scheduleType === "range" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">開始日</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-orange-400 font-bold" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">終了日</label>
                <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-orange-400 font-bold" />
              </div>
            </div>
          )}

          {scheduleType === "weekly" && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">曜日</label>
                <div className="flex gap-1">
                  {WEEKDAYS.map((day, i) => (
                    <button key={i} type="button" onClick={() => setRecurringDay(i)}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-xs font-black transition-all",
                        recurringDay === i ? "bg-orange-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-orange-100"
                      )}>
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">開始日</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-orange-400 font-bold" />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">繰り返し終了日</label>
                  <input type="date" value={recurringUntil} min={startDate} onChange={(e) => setRecurringUntil(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-orange-400 font-bold" />
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-xl border border-red-100 dark:border-red-900/50">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={handleClose}
              className="flex-1 py-3 rounded-xl border-2 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-sm font-bold hover:bg-slate-50 transition">
              キャンセル
            </button>
            <button type="submit" disabled={isLoading || workTanks.length === 0}
              className="flex-1 py-3 rounded-xl bg-orange-500 text-white text-sm font-black hover:opacity-90 transition disabled:opacity-50 shadow-lg shadow-orange-500/20">
              {isLoading ? "保存中..." : (isEditing ? "変更を保存" : "業務を登録")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
