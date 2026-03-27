"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import { Plus, Trash2, Beer, Layout, Calendar, Settings, Edit2, AlertTriangle, X, ChevronUp, ChevronDown, Layers, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import AddTankModal from "@/components/AddTankModal";
import AddTemplateModal from "@/components/AddTemplateModal";
import ConfirmDialog from "@/components/ConfirmDialog";

interface Tank {
  id: string;
  name: string;
  type: string;
  capacity?: number;
  category?: string;
  sortOrder: number;
}

interface Template {
  id: string;
  name: string;
  description?: string;
  tasks: any[];
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"EQUIPMENT" | "WORK" | "TEMPLATES" | "SETTINGS" | "MANUAL">("EQUIPMENT");
  const [mounted, setMounted] = useState(false);
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isTankModalOpen, setIsTankModalOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState<"TANK" | "WORK">("TANK");
  const [editingTank, setEditingTank] = useState<any>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  // Confirmation state
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string; type: "TANK" | "WORK" | "TEMPLATE" } | null>(null);

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, []);

  useEffect(() => {
    const tab = searchParams.get("tab") as any;
    if (["EQUIPMENT", "WORK", "TEMPLATES", "SETTINGS", "MANUAL"].includes(tab)) {
      setActiveTab(tab);
    } else {
      setActiveTab("SETTINGS");
    }
  }, [searchParams]);

  const openTankModal = (cat: "TANK" | "WORK", tank?: any) => {
    setModalCategory(cat);
    setEditingTank(tank || null);
    setIsTankModalOpen(true);
  };

  const openCreateTemplate = () => {
    setEditingTemplate(null);
    setIsTemplateModalOpen(true);
  };

  const openEditTemplate = (template: Template) => {
    setEditingTemplate(template);
    setIsTemplateModalOpen(true);
  };

  const handleReorder = async (tankId: string, direction: 'UP' | 'DOWN') => {
    const list = tanks.sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = list.findIndex(t => t.id === tankId);
    if (idx === -1) return;
    if (direction === 'UP' && idx === 0) return;
    if (direction === 'DOWN' && idx === list.length - 1) return;

    const newList = [...list];
    const targetIdx = direction === 'UP' ? idx - 1 : idx + 1;
    [newList[idx], newList[targetIdx]] = [newList[targetIdx], newList[idx]];

    // Re-assign sortOrder
    const reorderData = newList.map((t, index) => ({ id: t.id, sortOrder: index + 1 }));

    setIsLoading(true);
    try {
      const res = await fetch("/api/tanks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reorder: reorderData }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [tanksRes, templatesRes] = await Promise.all([
        fetch("/api/tanks"),
        fetch("/api/templates"),
      ]);
      if (tanksRes.ok) setTanks(await tanksRes.json());
      if (templatesRes.ok) setTemplates(await templatesRes.json());
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    const { id, type } = confirmDelete;
    
    setIsLoading(true);
    setError(null);
    try {
      const url = type === "TEMPLATE" ? "/api/templates" : "/api/tanks";
      const res = await fetch(url, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      
      const data = await res.json();
      if (res.ok) {
        setConfirmDelete(null);
        fetchData();
      } else {
        setError(data.error || "削除中にエラーが発生しました。");
        setConfirmDelete(null);
      }
    } catch (error) {
      console.error(error);
      setError("通信エラーが発生しました。");
      setConfirmDelete(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col min-h-full gap-8 w-full pb-12">
        <header className="space-y-1">
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            {activeTab === "EQUIPMENT" ? "設備管理" : 
             activeTab === "WORK" ? "業務管理" : 
             activeTab === "TEMPLATES" ? "テンプレート管理" : 
             activeTab === "MANUAL" ? "操作マニュアル" : "設定"}
          </h1>
          <p className="text-slate-500 font-medium text-lg">
            {activeTab === "MANUAL" ? "アプリの各機能と効率的な操作方法を解説します。" :
             activeTab === "TEMPLATES" ? "バッチのスムーズな進行のためのスケジュールの雛形を管理します。" : "各種マスタ設定を行います。"}
          </p>
        </header>

        <div className="glass rounded-[2.5rem] p-10 border border-slate-200 dark:border-slate-800 shadow-2xl">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-bold">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-100 dark:hover:bg-red-800 rounded-lg transition-colors"><X className="w-4 h-4"/></button>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
          ) : activeTab === "EQUIPMENT" ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div><h3 className="text-xl font-bold flex items-center gap-2"><Beer className="w-5 h-5 text-primary" /> 醸造タンク</h3></div>
                <button onClick={() => openTankModal("TANK")} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"><Plus className="w-4 h-4" /> タンク追加</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tanks.filter(t => t.category === "TANK" || !t.category).map((tank, idx, filtered) => (
                  <div key={tank.id} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between group px-6">
                    <p className="font-bold text-slate-900 dark:text-white flex-grow">{tank.name}</p>
                    <div className="flex items-center gap-1">
                      <div className="flex gap-0.5 mr-4 border-r border-slate-200 dark:border-slate-700 pr-4">
                        <button disabled={idx === 0} onClick={() => handleReorder(tank.id, 'UP')}
                          className="p-1.5 text-slate-400 hover:text-primary transition-colors disabled:opacity-20"><ChevronUp size={16}/></button>
                        <button disabled={idx === filtered.length - 1} onClick={() => handleReorder(tank.id, 'DOWN')}
                          className="p-1.5 text-slate-400 hover:text-primary transition-colors disabled:opacity-20"><ChevronDown size={16}/></button>
                      </div>
                      <button onClick={() => openTankModal("TANK", tank)} className="p-2 text-slate-400 hover:text-primary transition-colors"><Edit2 className="w-4 h-4"/></button>
                      <button onClick={() => setConfirmDelete({ id: tank.id, name: tank.name, type: "TANK" })} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : activeTab === "WORK" ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div><h3 className="text-xl font-bold flex items-center gap-2"><Calendar className="w-5 h-5 text-orange-500" /> 業務・カレンダー項目</h3></div>
                <button onClick={() => openTankModal("WORK")} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold shadow-lg hover:opacity-90 transition-opacity"><Plus className="w-4 h-4" /> 項目追加</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tanks.filter(t => t.category === "WORK").map((tank, idx, filtered) => (
                  <div key={tank.id} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between group px-6">
                    <p className="font-bold text-slate-900 dark:text-white flex-grow">{tank.name}</p>
                    <div className="flex items-center gap-1">
                      <div className="flex gap-0.5 mr-4 border-r border-slate-200 dark:border-slate-700 pr-4">
                        <button disabled={idx === 0} onClick={() => handleReorder(tank.id, 'UP')}
                          className="p-1.5 text-slate-400 hover:text-primary transition-colors disabled:opacity-20"><ChevronUp size={16}/></button>
                        <button disabled={idx === filtered.length - 1} onClick={() => handleReorder(tank.id, 'DOWN')}
                          className="p-1.5 text-slate-400 hover:text-primary transition-colors disabled:opacity-20"><ChevronDown size={16}/></button>
                      </div>
                      <button onClick={() => openTankModal("WORK", tank)} className="p-2 text-slate-400 hover:text-primary transition-colors"><Edit2 className="w-4 h-4"/></button>
                      <button onClick={() => setConfirmDelete({ id: tank.id, name: tank.name, type: "WORK" })} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : activeTab === "TEMPLATES" ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div><h3 className="text-xl font-bold">仕込みテンプレート</h3></div>
                <button onClick={openCreateTemplate} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold shadow-lg hover:opacity-90"><Plus className="w-4 h-4" /> 作成する</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => (
                  <div key={template.id} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between group px-6">
                    <div className="flex items-center gap-4">
                       <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500"><Layout className="w-4 h-4" /></div>
                       <div><p className="font-bold text-slate-900 dark:text-white">{template.name}</p><p className="text-[10px] text-slate-500 font-bold uppercase">{template.tasks.length} 工程</p></div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                       <button onClick={() => openEditTemplate(template)} className="p-2 text-slate-400 hover:text-blue-500 transition-colors"><Edit2 className="w-4 h-4"/></button>
                       <button onClick={() => setConfirmDelete({ id: template.id, name: template.name, type: "TEMPLATE" })} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : activeTab === "MANUAL" ? (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-8 bg-blue-500/5 rounded-[2rem] border border-blue-500/10 flex flex-col gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600"><Layers className="w-6 h-6" /></div>
                  <h4 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">ビューの切り替え</h4>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">ダッシュボード上盤の「仕込み前 / 仕込み後」タブで表示を切り替えます。</p>
                  <ul className="text-xs font-bold text-slate-400 space-y-2">
                    <li className="flex gap-2"><span>・</span><span>前フェーズ：仕込み(Day 0)以前が前景、以後が背面(透過30%)になります。</span></li>
                    <li className="flex gap-2"><span>・</span><span>後フェーズ：仕込み以後が前景、以前が背面になります。</span></li>
                    <li className="flex gap-2"><span>・</span><span>青ラベル：仕込み日(Day 0)はどちらのモードでも常に前景に表示されます。</span></li>
                  </ul>
                </div>

                <div className="p-8 bg-purple-500/5 rounded-[2rem] border border-purple-500/10 flex flex-col gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-600"><Trash2 className="w-6 h-6" /></div>
                  <h4 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">項目の削除</h4>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">ラベルをタップ/クリックし、右上のゴミ箱アイコンを押すと削除確認が表示されます。</p>
                  <ul className="text-xs font-bold text-slate-400 space-y-2">
                    <li className="flex gap-2 text-amber-500"><span>※</span><span>CIP（洗浄）ラベルは仕様上削除できません。</span></li>
                    <li className="flex gap-2"><span>・</span><span>移送工程を削除すると、関連する移送先の工程も影響を受ける場合があります。</span></li>
                  </ul>
                </div>

                <div className="p-8 bg-emerald-500/5 rounded-[2rem] border border-emerald-500/10 flex flex-col gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600"><AlertTriangle className="w-6 h-6" /></div>
                  <h4 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">タンクの衝突検知</h4>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">同一タンク上で滞在期間が重なる場合、警告が表示され登録/移動が制限されます。</p>
                  <ul className="text-xs font-bold text-slate-400 space-y-2">
                    <li className="flex gap-2"><span>・</span><span>占有対象：仕込み日(Day 0) 〜 CIP(赤ラベル) までの期間。</span></li>
                    <li className="flex gap-2"><span>・</span><span>例外：仕込み日より1日前までの準備期間は衝突検知の対象外です。</span></li>
                  </ul>
                </div>

                <div className="p-8 bg-amber-500/5 rounded-[2rem] border border-amber-500/10 flex flex-col gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600"><Settings className="w-6 h-6" /></div>
                  <h4 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">表示の調整</h4>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">ダッシュボード上部のスライダーでグリッドの縮尺を調整できます。</p>
                  <ul className="text-xs font-bold text-slate-400 space-y-2">
                    <li className="flex gap-2"><span>・</span><span>今日ボタン：いつでも現在の日付位置にスクロールで戻ります。</span></li>
                    <li className="flex gap-2"><span>・</span><span>設定の保存：スライダー位置はブラウザに自動保存されます。</span></li>
                  </ul>
                </div>
              </div>

              <div className="p-10 bg-slate-900 rounded-[2.5rem] text-white flex flex-col items-center text-center gap-6">
                 <div className="w-16 h-16 rounded-3xl bg-primary/20 flex items-center justify-center text-primary"><Zap className="w-8 h-8" /></div>
                 <div className="space-y-2">
                    <h4 className="text-2xl font-black uppercase tracking-tight">クイック・リスケジュール</h4>
                    <p className="text-slate-400 font-medium max-w-lg">仕込み当日（青ラベル）をドラッグして移動させると、関連する全ての工程を一括で相対的にリスケジュールできます。</p>
                 </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title={`${confirmDelete?.type === "TEMPLATE" ? "テンプレート" : confirmDelete?.type === "WORK" ? "業務項目" : "タンク"}の削除`}
        description={`${confirmDelete?.name} を削除してもよろしいですか？この操作は取り消せません。`}
        onConfirm={executeDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      <AddTankModal isOpen={isTankModalOpen} onClose={() => setIsTankModalOpen(false)} onSuccess={fetchData} category={modalCategory} tank={editingTank} />
      <AddTemplateModal isOpen={isTemplateModalOpen} onClose={() => setIsTemplateModalOpen(false)} onSuccess={fetchData} editingTemplate={editingTemplate} />
    </AppLayout>
  );
}

export default function SettingsPage() {
  return (<Suspense fallback={<div>Loading...</div>}><SettingsContent /></Suspense>);
}
