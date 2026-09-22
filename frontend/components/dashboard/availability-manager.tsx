"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/services/api";
import {
  scheduleError,
  weekdays,
  type WeeklySchedule,
  type WeeklyDay,
} from "@/lib/availability";

const labels: Record<string, string> = {
  BOOKED: "محجوز",
  COMPLETED: "مكتمل",
  CANCELLED: "ملغى",
  NO_SHOW: "لم يتم الحضور",
};
type Appointment = {
  id: string;
  scheduled_at: string;
  ends_at: string;
  status: string;
  phone: string;
  governorate: string;
  notes?: string;
};
const fetchData = () =>
  Promise.all([
    api.get<WeeklySchedule>("/matchmaker/availability"),
    api.get<Appointment[]>("/matchmaker/appointments"),
  ]);
export function AvailabilityManager() {
  const [schedule, setSchedule] = useState<WeeklySchedule>();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [validation, setValidation] = useState("");
  const [dirty, setDirty] = useState(false);
  const applyData = ([weekly, bookings]: [WeeklySchedule, Appointment[]]) => {
    setSchedule(weekly);
    setAppointments(bookings);
    setError("");
    setDirty(false);
  };
  useEffect(() => {
    let active = true;
    fetchData().then(
      (data) => {
        if (active) applyData(data);
      },
      () => {
        if (active) setError("تعذر تحميل جدول المواعيد");
      },
    );
    return () => {
      active = false;
    };
  }, []);
  const reload = async () => {
    try {
      applyData(await fetchData());
      setValidation("");
    } catch {
      setError("تعذر تحميل جدول المواعيد");
    }
  };
  const updateDay = (
    index: number,
    transform: (day: WeeklyDay) => WeeklyDay,
  ) => {
    setSchedule(
      (current) =>
        current && {
          ...current,
          days: current.days.map((day, i) =>
            i === index ? transform(day) : day,
          ),
        },
    );
    setDirty(true);
    setValidation("");
  };
  const save = async () => {
    if (!schedule) return;
    const message = scheduleError(schedule);
    if (message) {
      setValidation(message);
      return;
    }
    setBusy(true);
    setValidation("");
    try {
      const body = {
        slot_duration_minutes: schedule.slot_duration_minutes,
        booking_horizon_days: schedule.booking_horizon_days,
        revision: schedule.revision,
        days: schedule.days,
      };
      setSchedule(
        await api.patch<WeeklySchedule>("/matchmaker/availability", body),
      );
      setDirty(false);
      toast.success("تم حفظ جدول المواعيد");
    } catch (e) {
      setValidation(e instanceof Error ? e.message : "تعذر حفظ الجدول");
    } finally {
      setBusy(false);
    }
  };
  const changeStatus = async (id: string, status: string) => {
    setBusy(true);
    try {
      await api.patch(`/matchmaker/appointments/${id}`, { status });
      setAppointments(await api.get<Appointment[]>("/matchmaker/appointments"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر تحديث الحجز");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">مواعيد التواصل</h1>
      <p className="text-sm text-slate-500">
        حددي جدولك الأسبوعي المتكرر حسب توقيت دمشق. تبقى الحجوزات القائمة محفوظة
        عند تعديل الجدول.
      </p>
      {error && (
        <p role="alert">
          {error}{" "}
          <Button variant="outline" onClick={reload}>
            إعادة المحاولة
          </Button>
        </p>
      )}
      {!schedule && !error && <p role="status">جارٍ تحميل الجدول...</p>}
      {schedule && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <fieldset disabled={busy} className="space-y-4">
            <div className="grid gap-4 rounded-2xl bg-white p-5 sm:grid-cols-2">
              <label className="label">
                مدة موعد التواصل
                <select
                  className="field"
                  value={schedule.slot_duration_minutes}
                  onChange={(e) => {
                    setSchedule({
                      ...schedule,
                      slot_duration_minutes: Number(e.target.value),
                    });
                    setDirty(true);
                  }}
                >
                  {[15, 30, 45, 60].map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} دقيقة
                    </option>
                  ))}
                </select>
              </label>
              <label className="label">
                عرض المواعيد القادمة لمدة
                <select
                  className="field"
                  value={schedule.booking_horizon_days}
                  onChange={(e) => {
                    setSchedule({
                      ...schedule,
                      booking_horizon_days: Number(e.target.value),
                    });
                    setDirty(true);
                  }}
                >
                  <option value={7}>أسبوع (7 أيام)</option>
                  <option value={14}>أسبوعين (14 يوم)</option>
                  <option value={30}>30 يوم</option>
                </select>
              </label>
            </div>
            {validation && (
              <p role="alert" className="text-sm text-red-600">
                {validation}{" "}
                <button type="button" className="underline" onClick={reload}>
                  إعادة تحميل الجدول
                </button>
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled={busy}>
                {busy ? "جارٍ الحفظ..." : "حفظ جدول المواعيد"}
              </Button>
              {dirty && (
                <span className="text-sm text-slate-500">
                  تغييرات غير محفوظة
                </span>
              )}
            </div>
            {schedule.days.map((day, dayIndex) => (
              <section
                key={day.weekday}
                aria-label={weekdays[day.weekday]}
                className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-bold">{weekdays[day.weekday]}</h2>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={day.is_active}
                    aria-label={`التوفر يوم ${weekdays[day.weekday]}`}
                    className={`rounded-full px-4 py-2 text-sm ${day.is_active ? "bg-brand-pink text-brand-rose" : "bg-slate-100 text-slate-500"}`}
                    onClick={() =>
                      updateDay(dayIndex, (current) => ({
                        ...current,
                        is_active: !current.is_active,
                      }))
                    }
                  >
                    {day.is_active ? "متاحة ✓" : "غير متاحة"}
                  </button>
                </div>
                {day.is_active && (
                  <>
                    {day.ranges.map((range, rangeIndex) => (
                      <div
                        key={rangeIndex}
                        className="grid grid-cols-[1fr_1fr_auto] items-end gap-3"
                      >
                        <label className="label">
                          من
                          <input
                            aria-label={`${weekdays[day.weekday]} بداية الفترة ${rangeIndex + 1}`}
                            type="time"
                            step={60}
                            required
                            className="field"
                            value={range.start_time}
                            onChange={(e) =>
                              updateDay(dayIndex, (current) => ({
                                ...current,
                                ranges: current.ranges.map((r, i) =>
                                  i === rangeIndex
                                    ? { ...r, start_time: e.target.value }
                                    : r,
                                ),
                              }))
                            }
                          />
                        </label>
                        <label className="label">
                          إلى
                          <input
                            aria-label={`${weekdays[day.weekday]} نهاية الفترة ${rangeIndex + 1}`}
                            type="time"
                            step={60}
                            required
                            className="field"
                            value={range.end_time}
                            onChange={(e) =>
                              updateDay(dayIndex, (current) => ({
                                ...current,
                                ranges: current.ranges.map((r, i) =>
                                  i === rangeIndex
                                    ? { ...r, end_time: e.target.value }
                                    : r,
                                ),
                              }))
                            }
                          />
                        </label>
                        <Button
                          type="button"
                          variant="outline"
                          aria-label={`حذف فترة ${weekdays[day.weekday]} ${rangeIndex + 1}`}
                          onClick={() =>
                            updateDay(dayIndex, (current) => ({
                              ...current,
                              ranges: current.ranges.filter(
                                (_, i) => i !== rangeIndex,
                              ),
                            }))
                          }
                        >
                          حذف
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      disabled={day.ranges.length >= 24}
                      onClick={() =>
                        updateDay(dayIndex, (current) => ({
                          ...current,
                          ranges: [
                            ...current.ranges,
                            { start_time: "", end_time: "" },
                          ],
                        }))
                      }
                    >
                      + إضافة فترة أخرى
                    </Button>
                  </>
                )}
              </section>
            ))}
          </fieldset>
        </form>
      )}
      <h2 className="text-xl font-bold">الحجوزات</h2>
      {schedule && !appointments.length && (
        <p className="text-slate-500">لا توجد حجوزات حتى الآن.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {appointments.map((appointment) => (
          <article
            key={appointment.id}
            className="space-y-3 rounded-2xl border border-slate-100 bg-white p-5"
          >
            <p>
              {new Date(appointment.scheduled_at).toLocaleString("ar-SY", {
                timeZone: "Asia/Damascus",
                dateStyle: "full",
                timeStyle: "short",
              })}{" "}
              —{" "}
              {new Date(appointment.ends_at).toLocaleTimeString("ar-SY", {
                timeZone: "Asia/Damascus",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
            <p className="text-brand-rose">{labels[appointment.status]}</p>
            <p>
              <span dir="ltr">{appointment.phone}</span> ·{" "}
              {appointment.governorate}
            </p>
            {appointment.notes && (
              <p className="text-sm text-slate-500">{appointment.notes}</p>
            )}
            {appointment.status === "BOOKED" && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => void changeStatus(appointment.id, "COMPLETED")}
                >
                  تم التواصل
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void changeStatus(appointment.id, "NO_SHOW")}
                >
                  لم يتم الحضور
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void changeStatus(appointment.id, "CANCELLED")}
                >
                  إلغاء الحجز
                </Button>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
