"use client";

import { AlertTriangle, X } from "lucide-react";

interface Props {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export default function ConfirmDialog({
  isOpen, title, description, confirmLabel = "削除する",
  onConfirm, onCancel, isDestructive = true,
}: Props) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-sm mx-4 overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${isDestructive ? "bg-red-100 dark:bg-red-900/30" : "bg-amber-100 dark:bg-amber-900/30"}`}>
              <AlertTriangle className={`w-5 h-5 ${isDestructive ? "text-red-500" : "text-amber-500"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-black text-slate-900 dark:text-white">{title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{description}</p>
            </div>
            <button onClick={onCancel} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition">
            キャンセル
          </button>
          <button onClick={() => { onConfirm(); }}
            className={`flex-1 py-2.5 rounded-xl text-white text-sm font-black transition ${isDestructive ? "bg-red-500 hover:bg-red-600" : "bg-amber-500 hover:bg-amber-600"}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
