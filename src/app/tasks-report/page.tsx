
"use client";

import { useState, useEffect, Suspense } from "react";
import { format, startOfDay, isSameDay } from "date-fns";
import { ja } from "date-fns/locale";
import AppLayout from "@/components/AppLayout";
import { Printer, Calendar, Beer, ClipboardList, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { isWorkActiveOnDate } from "@/lib/work-utils";

export default function TasksReportPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" /></div>}>
      <TasksReportContent />
    </Suspense>
  );
}

function TasksReportContent() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [data, setData] = useState<{ tanks: any[], batches: any[], workSchedules: any[] }>({ tanks: [], batches: [], workSchedules: [] });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/batches");
      if (res.ok) {
        const json = await res.json();
        setData({
          tanks: json.tanks || [],
          batches: json.batches || [],
          workSchedules: json.workSchedules || []
        });
      }
    } catch (error) {
      console.error("Failed to fetch report data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevDay = () => setSelectedDate(new Date(selectedDate.getTime() - 86400000));
  const handleNextDay = () => setSelectedDate(new Date(selectedDate.getTime() + 86400000));
  const handleToday = () => setSelectedDate(new Date());

  const equipmentTasks = data.batches.flatMap(batch => 
    batch.tasks
      .filter((task: any) => isSameDay(new Date(task.date), selectedDate))
      .map((task: any) => {
        const tank = data.tanks.find(t => t.id === task.tankId);
        return {
          tankName: tank?.name || "不明",
          batchName: batch.name,
          taskName: task.name
        };
      })
  ).sort((a, b) => a.tankName.localeCompare(b.tankName));

  const workTasks = data.workSchedules
    .filter((ws: any) => isWorkActiveOnDate(ws, selectedDate))
    .map((ws: any) => {
      const tank = data.tanks.find(t => t.id === ws.tankId);
      return {
        workName: tank?.name || ws.name,
        taskName: ws.name
      };
    })
    .sort((a, b) => a.workName.localeCompare(b.workName));

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto pb-20">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 print:hidden">
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
              <ClipboardList className="w-8 h-8 text-primary" />
              タスク管理・日報
            </h1>
            <p className="text-slate-500 font-medium">指定日の全作業を一覧表示・印刷します。</p>
          </div>
          
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <button onClick={handlePrevDay} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"><ChevronLeft size={20}/></button>
            <div className="px-4 font-bold text-lg min-w-[160px] text-center">
              {format(selectedDate, "yyyy/MM/dd (eee)", { locale: ja })}
            </div>
            <button onClick={handleNextDay} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"><ChevronRight size={20}/></button>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
            <button onClick={handleToday} className="px-4 py-2 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl">今日</button>
            <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:opacity-90 shadow-lg shadow-primary/20">
              <Printer size={16} /> 印刷
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-slate-500 font-bold animate-pulse">データを読み込み中...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-8 print:gap-4 print:mt-0">
            {/* Printable Header (Visible only when printing) */}
            <div className="hidden print:block text-center border-b-2 border-slate-900 pb-4 mb-4">
              <h1 className="text-2xl font-bold uppercase tracking-widest">作業指示・日報</h1>
              <p className="text-lg font-bold mt-1">{format(selectedDate, "yyyy年 MM月 dd日 (EEEE)", { locale: ja })}</p>
            </div>

            {/* Equipment Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-2 print:px-0">
                <Beer className="w-5 h-5 text-primary print:hidden" />
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 border-l-4 border-primary pl-3">設備・醸造作業</h2>
              </div>
              <div className="overflow-hidden bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl print:shadow-none print:border-slate-900 print:rounded-none">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 print:bg-slate-100">
                      <th className="px-8 py-4 font-black text-slate-540 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 print:border-slate-900 print:px-4">タンク名</th>
                      <th className="px-8 py-4 font-black text-slate-540 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 print:border-slate-900 print:px-4">仕込み名</th>
                      <th className="px-8 py-4 font-black text-slate-540 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 print:border-slate-900 print:px-4">作業・工程</th>
                      <th className="px-8 py-4 font-black text-slate-540 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 print:hidden">完了</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-900">
                    {equipmentTasks.length > 0 ? equipmentTasks.map((task, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-8 py-5 font-bold text-slate-900 dark:text-white print:px-4 print:py-3">{task.tankName}</td>
                        <td className="px-8 py-5 text-slate-600 dark:text-slate-400 font-medium print:px-4 print:py-3">{task.batchName}</td>
                        <td className="px-8 py-5 text-slate-900 dark:text-white font-bold print:px-4 print:py-3 italic">
                          <span className="bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 px-3 py-1 rounded-lg print:p-0 print:bg-transparent print:text-slate-900">
                            {task.taskName}
                          </span>
                        </td>
                        <td className="px-8 py-5 print:hidden">
                           <div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-700 rounded-md" />
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-8 py-10 text-center text-slate-400 italic">本日の設備作業はありません。</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Work Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-2 print:px-0">
                <Calendar className="w-5 h-5 text-orange-500 print:hidden" />
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 border-l-4 border-orange-500 pl-3">業務・カレンダー</h2>
              </div>
              <div className="overflow-hidden bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl print:shadow-none print:border-slate-900 print:rounded-none">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 print:bg-slate-100">
                      <th className="px-8 py-4 font-black text-slate-540 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 print:border-slate-900 print:px-4 w-1/3">項目名</th>
                      <th className="px-8 py-4 font-black text-slate-540 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 print:border-slate-900 print:px-4 w-1/2">内容</th>
                      <th className="px-8 py-4 font-black text-slate-540 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 print:hidden">完了</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-900">
                    {workTasks.length > 0 ? workTasks.map((task, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-8 py-5 font-bold text-slate-900 dark:text-white print:px-4 print:py-3">{task.workName}</td>
                        <td className="px-8 py-5 text-slate-900 dark:text-white font-bold print:px-4 print:py-3 italic">
                          <span className="bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 px-3 py-1 rounded-lg print:p-0 print:bg-transparent print:text-slate-900">
                            {task.taskName}
                          </span>
                        </td>
                        <td className="px-8 py-5 print:hidden">
                           <div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-700 rounded-md" />
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={3} className="px-8 py-10 text-center text-slate-400 italic">本日の業務予定はありません。</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Print Footer */}
            <div className="hidden print:flex justify-between items-center mt-8 pt-4 border-t border-slate-900 text-[10px] text-slate-500">
              <p>出力日時: {format(new Date(), "yyyy/MM/dd HH:mm")}</p>
              <p>Brewery Schedule Management System</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Styles for print */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          aside, nav, header button {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: none !important;
          }
        }
      `}</style>
    </AppLayout>
  );
}
