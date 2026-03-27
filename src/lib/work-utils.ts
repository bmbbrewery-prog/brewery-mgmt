import { startOfDay, addDays, getDay, addMonths } from "date-fns";

/**
 * 指定した日付に、特定の業務スケジュール（単発または繰り返し）が該当するか判定する
 */
export function isWorkActiveOnDate(ws: any, targetDate: Date): boolean {
  const target = startOfDay(targetDate);
  const start = startOfDay(new Date(ws.startDate));
  const end = ws.endDate ? startOfDay(new Date(ws.endDate)) : null;

  // 開始日より前なら対象外
  if (target < start) return false;
  
  // 終了日が設定されていて、それを過ぎていれば対象外
  if (end && target > end) return false;

  // 繰り返し設定がない場合
  if (!ws.isRecurring) {
    // 期間設定（endDate）がある場合は、すでに範囲内であることが確定している
    if (end) return true;
    // 期間設定がない場合は、開始日当日である必要がある
    return target.getTime() === start.getTime();
  }

  // 繰り返し設定がある場合：曜日のチェック
  if (ws.recurringDay !== null && ws.recurringDay !== undefined) {
    return getDay(target) === ws.recurringDay;
  }

  return false;
}

/**
 * 指定した期間内において、特定の業務スケジュール（単発または繰り返し）が発生するすべての日付データを返す
 */
export function getWorkOccurrencesInRange(ws: any, rangeStart: Date, rangeEnd: Date): any[] {
  if (!ws.isRecurring) {
    return isWorkActiveOnDate(ws, new Date(ws.startDate)) ? [ws] : [];
  }

  const results: any[] = [];
  // 繰り返しの上限（無限ループ防止のため、開始から12ヶ月、または表示範囲の終端まで）
  const wsStart = startOfDay(new Date(ws.startDate));
  const limitDate = addMonths(wsStart, 12);
  
  // 計算の開始地点と終了地点を決定
  const scanStart = new Date(Math.max(rangeStart.getTime(), wsStart.getTime()));
  const scanEnd = new Date(Math.min(rangeEnd.getTime(), limitDate.getTime()));
  
  let cur = startOfDay(scanStart);
  while (cur <= scanEnd) {
    if (isWorkActiveOnDate(ws, cur)) {
      results.push({
        ...ws,
        startDate: cur.toISOString(),
        // startDateを発生日に書き換えて返すことで、カレンダー上で個別の要素として扱えるようにする
      });
    }
    cur = addDays(cur, 1);
  }
  
  return results;
}
