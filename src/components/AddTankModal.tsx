"use client";

import React, { useState, FormEvent, useEffect } from "react";
import { X, Beer, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddTankModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  category?: "TANK" | "WORK";
  tank?: any;
}

export default function AddTankModal({ isOpen, onClose, onSuccess, category = "TANK", tank }: AddTankModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (tank) {
        setName(tank.name || "");
        setColor(tank.color || null);
      } else {
        setName("");
        setColor(null);
      }
      setError(null);
    }
  }, [isOpen, tank]);

  if (!isOpen) return null;

  const COLORS = [
    "#C2410C", // Orange-700
    "#EA580C", // Orange-600
    "#F97316", // Orange-500
    "#F59E0B", // Amber-500
    "#EAB308", // Yellow-500
    "#FACC15", // Yellow-400
    "#A3E635", // Lime-400
    "#84CC16", // Lime-500
  ];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("名前を入力してください");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const resp = await fetch("/api/tanks", {
        method: tank ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          id: tank?.id,
          name: name.trim(), 
          color,
          category: tank ? undefined : category,
          type: tank ? undefined : (category === "TANK" ? "FV" : "OTHER"),
          capacity: tank ? undefined : (category === "TANK" ? 0 : null) 
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "保存に失敗しました");
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error("Failed to save tank/column:", err);
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEditing = !!tank;
  const title = isEditing ? "項目を編集" : (category === "TANK" ? "タンクを追加" : "業務を追加");
  const label = category === "TANK" ? "タンク名" : "業務名";
  const placeholder = category === "TANK" ? "例: FV-04" : "例: イベント出店";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            {category === "TANK" ? <Beer className="w-5 h-5 text-primary" /> : <Calendar className="w-5 h-5 text-primary" />}
            {title}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-black text-slate-700 dark:text-slate-300 ml-1">{label}</label>
              <input
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={placeholder}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-black text-slate-700 dark:text-slate-300 ml-1">カラー設定</label>
              <div className="grid grid-cols-4 gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c === color ? null : c)}
                    className={cn(
                      "h-10 rounded-xl border-4 transition-all",
                      c === color ? "scale-95 border-slate-900 dark:border-white" : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-xs font-bold text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-2xl text-sm font-black text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-[2] py-3 px-4 bg-primary text-white rounded-2xl text-sm font-black hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
            >
              {isSubmitting ? "保存中..." : (isEditing ? "変更を保存" : "追加する")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
