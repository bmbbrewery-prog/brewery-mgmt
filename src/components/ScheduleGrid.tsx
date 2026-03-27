"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { 
  Plus, Calendar, Search, Filter, ZoomIn, ZoomOut, Save, GripVertical, Trash2, X, ChevronLeft, ChevronRight,
  MoreVertical, Edit3, Settings, RefreshCw, Activity, ChevronDown, Beer, Target
} from "lucide-react";
import { 
  format, addDays, startOfDay, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, 
  isToday, isSaturday, isSunday, differenceInDays, parseISO, startOfToday,
  addMonths, subMonths, isSameMonth, getDay
} from "date-fns";
import { ja } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getWorkOccurrencesInRange } from "@/lib/work-utils";
import AddBatchModal from "./AddBatchModal";
import BatchDetailModal from "./BatchDetailModal";
import AddWorkModal from "./AddWorkModal";
import ConfirmDialog from "./ConfirmDialog";

interface Task {
  id: string;
  name: string;
  date: string | Date;
  offsetDays: number;
  isTankMovement: boolean;
  isCIP: boolean;
  tankId: string;
}

interface TankStay {
  batchId: string;
  batchName: string;
  tankId: string;
  startDate: Date;
  endDate: Date;
  occupancyStart: Date | null;
  occupancyEnd: Date | null;
  hasPre: boolean;
  hasPost: boolean;
  tasks: Task[];
  brewDate: string;
}

interface Confirm {
  title: string;
  message: string;
  confirmLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
}

export default function ScheduleGrid() {
  const [viewMode, setViewMode] = useState<"PRE" | "POST">("POST");
  const [isBrewModalOpen, setIsBrewModalOpen] = useState(false);
  const [isWorkModalOpen, setIsWorkModalOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [selectedBatchEdit, setSelectedBatchEdit] = useState<{ batch: any, isBrew: boolean } | null>(null);
  const [selectedWorkEdit, setSelectedWorkEdit] = useState<any | null>(null);
  const [selectedTaskEdit, setSelectedTaskEdit] = useState<any | null>(null);

  const [cellPopover, setCellPopover] = useState<{
    batchId: string; tankId: string; date: string; taskName: string;
  } | null>(null);

  const [rowHeight, setRowHeight] = useState(48);
  const [columnWidth, setColumnWidth] = useState(200);
  const settingsLoaded = useRef(false);

  useEffect(() => {
    if (!settingsLoaded.current) {
      const v = typeof localStorage !== 'undefined' ? localStorage.getItem("brewery_vh") : null;
      const h = typeof localStorage !== 'undefined' ? localStorage.getItem("brewery_hw") : null;
      if (v) setRowHeight(parseInt(v));
      if (h) setColumnWidth(parseInt(h));
      settingsLoaded.current = true;
      return;
    }
    localStorage.setItem("brewery_vh", rowHeight.toString());
    localStorage.setItem("brewery_hw", columnWidth.toString());
  }, [rowHeight, columnWidth]);

  const [tanks, setTanks] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [workSchedules, setWorkSchedules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [anchorDate] = useState(new Date());
  const [topVisibleDate, setTopVisibleDate] = useState(new Date());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const didScrollInitial = useRef(false);

  const handleRowHeightChange = (newVal: number) => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const oldScrollTop = container.scrollTop;
    const viewportH = container.clientHeight;
    const centerDateIdx = (oldScrollTop + viewportH / 2) / rowHeight;
    setRowHeight(newVal);
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = (centerDateIdx * newVal) - (viewportH / 2);
      }
    });
  };

  const fetchData = async () => {
    setIsLoading(true);
    const now = Date.now();
    try {
      const res = await fetch(`/api/batches?v=${now}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setTanks(data.tanks || []);
        setBatches(data.batches || []);
        setTemplates(data.templates || []);
        setWorkSchedules(data.workSchedules || []);
      }
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setIsLoading(false);
      setIsInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const dates = useMemo(() => {
    const start = subMonths(startOfMonth(anchorDate), 3);
    const end = addMonths(start, 24);
    return eachDayOfInterval({ start, end });
  }, [anchorDate]);

  useEffect(() => {
    if (!isInitialLoading && !didScrollInitial.current && dates.length > 0) {
      setTimeout(() => {
        scrollToToday();
        didScrollInitial.current = true;
      }, 500);
    }
  }, [isInitialLoading, dates]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const scrollTop = scrollContainerRef.current.scrollTop;
    const dateIdx = Math.floor(scrollTop / rowHeight);
    const dateAtTop = dates[dateIdx];
    if (dateAtTop && !isSameMonth(dateAtTop, topVisibleDate)) {
      setTopVisibleDate(dateAtTop);
    }
  };

  const tankStays: TankStay[] = useMemo(() => {
    if (!Array.isArray(batches)) return [];
    return batches.flatMap(batch => {
      const allTasks = (batch.tasks || []).sort((a: any, b: any) => (a.offsetDays || 0) - (b.offsetDays || 0));
      const tasksByTank: Record<string, any[]> = {};
      allTasks.forEach((t: any) => {
        if (!t.tankId) return;
        if (!tasksByTank[t.tankId]) tasksByTank[t.tankId] = [];
        tasksByTank[t.tankId].push(t);
      });

      const stays: TankStay[] = [];
      Object.entries(tasksByTank).forEach(([tankId, tasksInTank]) => {
        const sortedInTank = [...tasksInTank].sort((a,b) => (a.offsetDays || 0) - (b.offsetDays || 0));
        let currentSegmentTasks: any[] = [];
        
        sortedInTank.forEach((t, i) => {
          currentSegmentTasks.push(t);
          if (t.isCIP || i === sortedInTank.length - 1) {
             const startDate = new Date(Math.min(...currentSegmentTasks.map(tk => startOfDay(new Date(tk.date)).getTime())));
             const endDate = new Date(Math.max(...currentSegmentTasks.map(tk => startOfDay(new Date(tk.date)).getTime())));
 
             stays.push({
               batchId: batch.id, batchName: batch.name, tankId,
               brewDate: batch.brewDate,
               startDate, 
               endDate,
               occupancyStart: startDate,
               occupancyEnd: endDate,
               hasPre: false,
               hasPost: false,
               tasks: [...currentSegmentTasks],
             });
             currentSegmentTasks = [];
          }
        });
      });
      return stays;
    });
  }, [batches]);

  const workOccurrences = useMemo(() => {
    if (!Array.isArray(workSchedules) || dates.length === 0) return [];
    const rangeStart = dates[0];
    const rangeEnd = dates[dates.length - 1];
    return workSchedules.flatMap((ws: any) => getWorkOccurrencesInRange(ws, rangeStart, rangeEnd));
  }, [workSchedules, dates]);

  const mergedStays = useMemo(() => {
    const stays: any[] = [];
    workOccurrences.forEach((ws: any) => {
      const s = startOfDay(new Date(ws.startDate));
      const e = ws.endDate ? startOfDay(new Date(ws.endDate)) : s;
      stays.push({
        isWork: true, id: ws.id, batchName: ws.name, tankId: ws.tankId,
        brewDate: ws.startDate,
        startDate: s, endDate: e, occupancyStart: s, occupancyEnd: e,
        tasks: [{ id: ws.id, name: ws.name, date: s, offsetDays: 0 }]
      });
    });
    stays.push(...tankStays);
    return stays;
  }, [tankStays, workOccurrences]);

  const sortedTanks = [...tanks].sort((a, b) => {
    if (a.category === b.category) return (a.sortOrder || 0) - (b.sortOrder || 0);
    return a.category === "TANK" ? -1 : 1;
  });

  const scrollToToday = () => {
    const today = new Date();
    const idx = dates.findIndex(d => isSameDay(d, today));
    if (idx !== -1 && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = idx * rowHeight;
    }
  };

  const deleteWorkSchedule = (id: string, name: string) => {
    setConfirm({
      title: "業務削除",
      message: `「${name}」を削除してもよろしいですか？`,
      isDestructive: true,
      onConfirm: async () => {
        await fetch(`/api/work-schedules/${id}`, { method: "DELETE" });
        await fetchData();
      }
    });
  };

  const submitAddTask = async () => {
    if (!cellPopover?.taskName || !cellPopover?.batchId) return;
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: cellPopover.taskName, date: cellPopover.date,
        batchId: cellPopover.batchId, tankId: cellPopover.tankId,
      })
    });
    setCellPopover(null);
    fetchData();
  };

  const handleDragStart = (e: React.DragEvent, type: "BATCH" | "WORK", id: string, originalDate: Date, taskId?: string, isBrewLabel?: boolean) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ type, id, originalDate, taskId, isBrewLabel }));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleRowDragOverDate = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleRowDrop = async (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData("application/json");
      if (!dataStr) return;
      const data = JSON.parse(dataStr);
      const { type, id, originalDate, taskId, isBrewLabel } = data;
      const targetDate = dates[targetIdx];
      if (!targetDate) return;

      const diffDays = differenceInDays(startOfDay(targetDate), startOfDay(new Date(originalDate)));
      if (diffDays === 0) return;

      if (type === "BATCH") {
        if (isBrewLabel) {
          setConfirm({
            title: "バッチ全体のリスケジュール",
            message: "仕込み日（青ラベル）を基準に、バッチ全体のスケジュールを一括で移動させますか？",
            onConfirm: async () => {
              setIsLoading(true);
              const b = batches.find(bx => bx.id === id);
              if (!b) return;
              const newBrewDate = addDays(new Date(b.brewDate), diffDays);
              const res = await fetch(`/api/batches/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date: format(newBrewDate, "yyyy-MM-dd") })
              });
              if (!res.ok) {
                const errData = await res.json();
                alert(errData.error || "リスケジュールに失敗しました。");
              }
              await fetchData();
              setIsLoading(false);
            }
          });
        } else if (taskId) {
          setIsLoading(true);
          const res = await fetch(`/api/tasks/${taskId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date: format(targetDate, "yyyy-MM-dd") })
          });
          if (!res.ok) {
            const errData = await res.json();
            alert(errData.error || "工程の移動に失敗しました。");
          }
          await fetchData();
          setIsLoading(false);
        }
      } else if (type === "WORK") {
        setIsLoading(true);
        const ws = workSchedules.find(w => w.id === id);
        if (!ws) return;
        const newStart = addDays(new Date(ws.startDate), diffDays);
        const newEnd = ws.endDate ? addDays(new Date(ws.endDate), diffDays) : null;
        await fetch("/api/work-schedules", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...ws, id,
            startDate: format(newStart, "yyyy-MM-dd"),
            endDate: newEnd ? format(newEnd, "yyyy-MM-dd") : null
          })
        });
        await fetchData();
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Drop error:", err);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden relative">
      <div className="flex flex-col h-full bg-white dark:bg-slate-950 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden font-sans">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-4">
            <div className="flex p-1 bg-slate-200 dark:bg-slate-800 rounded-xl">
              {(["PRE", "POST"] as const).map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={cn("px-5 py-1.5 rounded-lg text-sm font-bold transition-all",
                    viewMode === mode ? "bg-white dark:bg-slate-700 shadow-md text-primary" : "text-slate-500")}>
                  {mode === "PRE" ? "仕込み前" : "仕込み後"}
                </button>
              ))}
            </div>
            <button onClick={scrollToToday} className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-black rounded-xl hover:bg-slate-100 transition-all shadow-sm">今日</button>
            {isLoading && <Activity className="w-3 h-3 text-primary animate-pulse" />}
            <div className="hidden lg:flex items-center gap-6 border-l border-slate-300 dark:border-slate-700 pl-6">
              {[
                { label: "VERTICAL", value: rowHeight, min: 24, max: 144, set: handleRowHeightChange },
                { label: "HORIZONTAL", value: columnWidth, min: 100, max: 400, set: setColumnWidth },
              ].map(({ label, value, min, max, set }) => (
                <div key={label} className="flex flex-col gap-1 w-32 text-[10px] font-black uppercase text-slate-400">
                  <div className="flex justify-between"><span>{label}</span><span>{value}PX</span></div>
                  <input type="range" min={min} max={max} value={value} onChange={e => set(parseInt(e.target.value))} className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary" />
                </div>
              ))}
            </div>
          </div>
          <div className="relative" ref={addMenuRef}>
            <button onClick={() => setIsAddMenuOpen(!isAddMenuOpen)} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-black hover:scale-105 transition-all shadow-lg shadow-primary/20"><Plus className="w-4 h-4" />追加<ChevronDown className="w-3 h-3" /></button>
            {isAddMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50">
                <button onClick={() => { setIsAddMenuOpen(false); setIsBrewModalOpen(true); }} className="flex items-center gap-3 w-full px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-left"><Beer className="w-4 h-4 text-primary" /><p className="text-sm font-bold">仕込み登録</p></button>
                <button onClick={() => { setIsAddMenuOpen(false); setIsWorkModalOpen(true); }} className="flex items-center gap-3 w-full px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-left"><Calendar className="w-4 h-4 text-orange-500" /><p className="text-sm font-bold">業務を追加</p></button>
              </div>
            )}
          </div>
        </div>

        <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-grow overflow-auto relative scrollbar-hide">
          {!isInitialLoading && (
            <table className="w-full border-collapse table-fixed" style={{ width: `calc(80px + ${sortedTanks.length * columnWidth}px)` }}>
              <thead className="sticky top-0 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md">
                <tr className="border-b border-slate-300 dark:border-slate-700">
                  <th className="w-20 p-2 border-r border-slate-300 dark:border-slate-700 sticky left-0 z-40 bg-slate-50 dark:bg-slate-900">
                    <div className="flex flex-col items-center text-[9px] text-primary font-black uppercase">
                      <span>{format(topVisibleDate, "yyyy年")}</span>
                      <span className="text-[11px]">{format(topVisibleDate, "M月")}</span>
                    </div>
                  </th>
                  {sortedTanks.map(t => (
                    <th key={t.id} style={{ width: columnWidth }} className="p-3 border-r border-slate-300 dark:border-slate-700 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="flex items-center gap-1">
                          {t.category === "WORK" ? <Calendar className="w-3 h-3 text-orange-500" /> : <Beer className="w-3 h-3 text-primary" />}
                          <span className="text-xs font-black truncate max-w-[140px] uppercase">{t.name}</span>
                        </div>
                        <span className="text-[8px] opacity-40 uppercase font-black">{t.type || (t.category==='WORK'?'LOC':'TANK')}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dates.map((date, dIdx) => {
                  const dayToday = isToday(date);
                  const weekend = getDay(date)===0 || getDay(date)===6;
                  return (
                    <tr key={date.toISOString()} 
                      style={{ height: rowHeight }} 
                      className={cn("divide-x divide-slate-100 dark:divide-slate-900 transition-colors", dayToday ? "bg-primary/5" : weekend ? "bg-slate-50/50 dark:bg-slate-900/40" : "")}
                      onDragOver={handleRowDragOverDate}
                      onDrop={(e) => handleRowDrop(e, dIdx)}
                    >
                      <td className={cn("sticky left-0 z-20 p-1 border-r border-slate-300 dark:border-slate-700 text-center backdrop-blur-sm w-20", dayToday?"bg-primary/10":"bg-slate-50/80 dark:bg-slate-900/80")}>
                        <div className="flex flex-row items-baseline justify-center gap-1 leading-none">
                          <span className={cn(rowHeight > 40 ? "text-sm" : "text-[11px]", "font-black", dayToday?"text-primary":"text-slate-800 dark:text-slate-200")}>{format(date, "d")}</span>
                          <span className={cn("text-[9px] font-black uppercase tracking-tighter opacity-80", dayToday?"text-primary":getDay(date)===0?"text-red-500":getDay(date)===6?"text-blue-500":"text-slate-400")}>{format(date, "EEEEEE", { locale: ja })}</span>
                        </div>
                      </td>
                      {sortedTanks.map(tank => {
                        const dayStays = mergedStays.filter(s => s.tankId === tank.id && (isSameDay(date, s.startDate) || (date > s.startDate && date <= s.endDate)));
                        return (
                          <td key={`${tank.id}-${date.toISOString()}`} className={cn("p-0 relative border-r border-b border-slate-300 dark:border-slate-700", tank.category==="WORK"?"bg-slate-50/30 dark:bg-slate-900/20":"bg-transparent")}>
                            {(() => {
                               const staysWithZ = dayStays.map(s => {
                                  const isBrewDay = isSameDay(date, new Date(s.brewDate));
                                  const isPhaseActive = isBrewDay || (
                                     viewMode === "PRE" 
                                       ? (startOfDay(date) < startOfDay(new Date(s.brewDate))) 
                                       : (startOfDay(date) > startOfDay(new Date(s.brewDate)))
                                  );
                                  const zBase = s.isWork ? 10 : (isPhaseActive ? 20 : 0);
                                  // Add lIdx to break ties while keeping tiers (Active: 20-29, Work: 10-19, Inactive: 0-9)
                                  const lIdx = mergedStays.indexOf(s);
                                  return { stay: s, isPhaseActive, zIndex: zBase + lIdx };
                               });

                               const maxZ = Math.max(...staysWithZ.map(s => s.zIndex), -1);

                               return staysWithZ.map(({ stay, isPhaseActive, zIndex }) => {
                                 const tasksOnDay = stay.tasks.filter((t: any) => isSameDay(new Date(t.date), date));
                                 const isSolid = stay.isWork || isPhaseActive;
                                 const isTop = zIndex === maxZ && maxZ !== -1;
                                 const batchRef = batches.find(b => b.id === stay.batchId);
                                 const customBatchColor = batchRef?.color;
                                 const activeBgColor = stay.isWork ? (tank.color || "#f1f5f9") : (customBatchColor || "#f8fafc");

                                 const getTaskColor = (t: any) => {
                                   const isB = t.offsetDays === 0 && !stay.isWork;
                                   if (isB) return "bg-blue-600 text-white";
                                   if (t.isCIP) return "bg-red-600 text-white";
                                   if (t.isTankMovement) return "bg-purple-600 text-white";
                                   if (t.offsetDays < 0) return "bg-orange-500 text-slate-900";
                                   if (t.offsetDays > 0) return "bg-emerald-500 text-slate-900";
                                   return "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300";
                                 };

                                 return (
                                   <div key={stay.isWork ? `w-${stay.id}` : stay.batchId} 
                                     style={{ zIndex, backgroundColor: activeBgColor }}
                                     className={cn("absolute inset-x-0.5 inset-y-0 shadow-sm overflow-hidden transition-all group/band",
                                       stay.isWork ? "cursor-pointer hover:brightness-110" : "cursor-default",
                                       isSolid ? "opacity-100" : "opacity-30",
                                       isSameDay(date, stay.startDate) && "rounded-t-lg top-0.5",
                                       isSameDay(date, stay.endDate) && "rounded-b-lg bottom-0.5")}
                                   >
                                     {isTop && (
                                       <div className="px-1 py-1 flex flex-col gap-1 h-full overflow-y-auto scrollbar-hide">
                                         <div className="flex items-center gap-1 min-h-[14px]">
                                            <span className="text-[10px] font-black truncate flex-grow text-slate-900/60 uppercase">{stay.batchName}</span>
                                            {!stay.isWork && (
                                               <button 
                                                 onClick={(e) => {
                                                   e.stopPropagation();
                                                   setCellPopover({
                                                     batchId: stay.batchId,
                                                     tankId: stay.tankId,
                                                     date: format(date, "yyyy-MM-dd"),
                                                     taskName: ""
                                                   });
                                                 }}
                                                 className="p-0.5 opacity-0 group-hover/band:opacity-100 hover:bg-black/10 rounded-full transition-all text-slate-900"
                                               >
                                                 <Plus size={10} />
                                               </button>
                                            )}
                                            {stay.isWork && (
                                               <button onClick={e => { e.stopPropagation(); deleteWorkSchedule(stay.id, stay.batchName); }} className="opacity-0 group-hover/band:opacity-100 p-0.5 rounded hover:bg-black/20 ml-auto text-white"><Trash2 size={10} /></button>
                                            )}
                                         </div>

                                         <div className="flex flex-col gap-0.5">
                                           {stay.isWork ? (
                                             <div 
                                               draggable 
                                               onClick={(e) => {
                                                 e.stopPropagation();
                                                 const ws = workSchedules.find(w => w.id === stay.id);
                                                 if (ws) setSelectedWorkEdit(ws);
                                               }}
                                               onDragStart={(e) => handleDragStart(e, "WORK", stay.id, date)}
                                               className="flex items-center gap-1 p-1 bg-white/20 rounded-md cursor-pointer hover:bg-white/30 transition-all font-bold text-[10px] text-white"
                                             >
                                               <GripVertical size={10} className="shrink-0" />
                                               <span className="truncate">{stay.batchName}</span>
                                             </div>
                                           ) : (
                                             tasksOnDay.map((t: any) => {
                                                const isB = t.offsetDays === 0 && !stay.isWork;
                                                return (
                                                  <div key={t.id} 
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      if (isB) {
                                                        const b = batches.find(bx => bx.id === stay.batchId);
                                                        if (b) setSelectedBatchEdit({ batch: b, isBrew: true });
                                                      } else {
                                                        setSelectedTaskEdit(t);
                                                      }
                                                    }}
                                                    className={cn("flex items-center gap-1 p-0.5 rounded shadow-sm text-[9px] font-black transition-all cursor-pointer hover:brightness-110", getTaskColor(t))}
                                                  >
                                                     <div 
                                                       draggable 
                                                       onDragStart={(e) => handleDragStart(e, "BATCH", stay.batchId, date, t.id, isB)}
                                                       className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-black/10 transition-all"
                                                     >
                                                        <GripVertical size={8} />
                                                     </div>
                                                     <span className="truncate">{t.name}</span>
                                                  </div>
                                                )
                                             })
                                           )}
                                         </div>
                                       </div>
                                     )}
                                   </div>
                                 );
                               });
                            })()}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <AddBatchModal isOpen={isBrewModalOpen} onClose={() => setIsBrewModalOpen(false)} tanks={tanks.filter(t=>t.category==='TANK')} templates={templates} onSuccess={fetchData} />
      <AddWorkModal 
        isOpen={isWorkModalOpen || !!selectedWorkEdit} 
        onClose={() => { setIsWorkModalOpen(false); setSelectedWorkEdit(null); }} 
        workTanks={tanks.filter(t=>t.category==='WORK' || t.category==='TANK')} 
        work={selectedWorkEdit}
        onSuccess={fetchData} 
      />
      {selectedBatchEdit && <BatchDetailModal isOpen={true} onClose={()=>setSelectedBatchEdit(null)} batch={selectedBatchEdit.batch} isBrew={selectedBatchEdit.isBrew} allTanks={tanks} onUpdate={fetchData} onDelete={fetchData} />}
      <ConfirmDialog 
        isOpen={!!confirm} 
        title={confirm?.title || ""} 
        description={confirm?.message || ""} 
        onConfirm={() => { confirm?.onConfirm(); setConfirm(null); }} 
        onCancel={() => setConfirm(null)} 
        isDestructive={confirm?.isDestructive} 
      />

      {cellPopover && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md px-4">
           <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-2xl w-full max-w-sm space-y-5 border border-slate-200 dark:border-slate-800 transform animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3">
                 <div className="p-3 bg-primary/10 rounded-2xl"><Plus className="w-5 h-5 text-primary" /></div>
                 <div>
                    <h3 className="text-lg font-black text-slate-800 dark:text-white leading-tight">作業を追加</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Add new task</p>
                 </div>
              </div>

              <div className="space-y-1.5">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 px-1">作業名</label>
                 <input 
                   autoFocus
                   value={cellPopover.taskName} 
                   onChange={e => setCellPopover({...cellPopover, taskName: e.target.value})}
                   onKeyDown={e => e.key === 'Enter' && submitAddTask()}
                   className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-primary outline-none transition-all font-bold text-sm dark:text-white"
                   placeholder="例: サンプリング..."
                 />
              </div>

              <div className="flex gap-3 pt-2">
                 <button onClick={() => setCellPopover(null)} className="flex-1 py-3 text-sm font-black text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all">キャンセル</button>
                 <button 
                   onClick={submitAddTask}
                   disabled={!cellPopover.taskName.trim()}
                   className="flex-[2] py-3 bg-primary text-white font-black text-sm rounded-2xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
                 >
                   登録する
                 </button>
              </div>
           </div>
        </div>
      )}
      {selectedTaskEdit && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-md px-4">
           <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-2xl w-full max-w-sm space-y-5 border border-slate-200 dark:border-slate-800 transform animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between gap-3">
                 <div className="flex items-center gap-3">
                    <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-2xl"><Edit3 className="w-5 h-5 text-amber-600 dark:text-amber-400" /></div>
                    <div>
                        <h3 className="text-lg font-black text-slate-800 dark:text-white leading-tight">工程を編集</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Edit process</p>
                    </div>
                 </div>
                 {!(selectedTaskEdit.isCIP || selectedTaskEdit.name?.toLowerCase().includes("cip")) && (
                   <button 
                     onClick={() => {
                        const targetTask = selectedTaskEdit;
                        setConfirm({
                          title: "工程の削除",
                          message: `「${targetTask.name}」を削除しますか？\n※移送工程の場合、以降の工程も削除される場合があります。`,
                          isDestructive: true,
                          onConfirm: async () => {
                            setIsLoading(true);
                            await fetch(`/api/tasks/${targetTask.id}`, { method: "DELETE" });
                            await fetchData();
                            setIsLoading(false);
                          }
                        });
                        setSelectedTaskEdit(null);
                     }}
                     className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                   >
                     <Trash2 size={18} />
                   </button>
                 )}
              </div>

              <div className="space-y-1.5">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 px-1">工程名</label>
                 <input 
                   autoFocus
                   value={selectedTaskEdit.name} 
                   onChange={e => setSelectedTaskEdit({...selectedTaskEdit, name: e.target.value})}
                   onKeyDown={e => e.key === 'Enter' && (async () => {
                      setIsLoading(true);
                      await fetch(`/api/tasks/${selectedTaskEdit.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name: selectedTaskEdit.name })
                      });
                      await fetchData();
                      setSelectedTaskEdit(null);
                      setIsLoading(false);
                   })()}
                   className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-primary outline-none transition-all font-bold text-sm dark:text-white"
                 />
              </div>

              <div className="flex gap-3 pt-2">
                 <button onClick={() => setSelectedTaskEdit(null)} className="flex-1 py-3 text-sm font-black text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all">キャンセル</button>
                 <button 
                   onClick={async () => {
                      setIsLoading(true);
                      await fetch(`/api/tasks/${selectedTaskEdit.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name: selectedTaskEdit.name })
                      });
                      await fetchData();
                      setSelectedTaskEdit(null);
                      setIsLoading(false);
                   }}
                   className="flex-[2] py-3 bg-primary text-white font-black text-sm rounded-2xl shadow-lg shadow-primary/20 hover:opacity-90 transition-all"
                 >
                   保存する
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
