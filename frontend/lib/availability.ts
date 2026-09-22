export const weekdays = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];
export type TimeRange = { start_time: string; end_time: string };
export type WeeklyDay = {
  weekday: number;
  is_active: boolean;
  ranges: TimeRange[];
};
export type WeeklySchedule = {
  slot_duration_minutes: number;
  booking_horizon_days: number;
  revision: number;
  days: WeeklyDay[];
};
export type ContactSlot = {
  id: string;
  matchmaker_id: string;
  appointment_date: string;
  scheduled_at: string;
  ends_at: string;
  status: "AVAILABLE";
};
export function scheduleError(schedule: WeeklySchedule): string | null {
  for (const day of schedule.days) {
    if (day.is_active && !day.ranges.length)
      return `أضيفي فترة واحدة على الأقل ليوم ${weekdays[day.weekday]}`;
    const ranges = [...day.ranges].sort((a, b) =>
      a.start_time.localeCompare(b.start_time),
    );
    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i];
      if (
        !range.start_time ||
        !range.end_time ||
        range.end_time <= range.start_time
      )
        return `${weekdays[day.weekday]}: ساعة النهاية يجب أن تكون بعد البداية`;
      if (i && ranges[i - 1].end_time > range.start_time)
        return `${weekdays[day.weekday]}: الفترات المتداخلة غير مسموحة`;
    }
  }
  return null;
}
