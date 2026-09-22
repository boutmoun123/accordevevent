import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { AvailabilityManager } from "./availability-manager";
import { api } from "@/services/api";
import { weekdays, type WeeklySchedule } from "@/lib/availability";

vi.mock("@/services/api", () => ({ api: { get: vi.fn(), patch: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const empty = (): WeeklySchedule => ({
  slot_duration_minutes: 30,
  booking_horizon_days: 14,
  revision: 0,
  days: weekdays.map((_, weekday) => ({
    weekday,
    is_active: false,
    ranges: [],
  })),
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.get).mockImplementation(async (path) =>
    path.endsWith("/availability") ? empty() : [],
  );
  vi.mocked(api.patch).mockImplementation(async (_, body) => ({
    ...(body as WeeklySchedule),
    revision: 1,
  }));
});

async function addRange(
  day: string,
  index: number,
  start: string,
  end: string,
) {
  const region = screen.getByRole("region", { name: day });
  fireEvent.click(
    within(region).getByRole("button", { name: "+ إضافة فترة أخرى" }),
  );
  fireEvent.change(screen.getByLabelText(`${day} بداية الفترة ${index}`), {
    target: { value: start },
  });
  fireEvent.change(screen.getByLabelText(`${day} نهاية الفترة ${index}`), {
    target: { value: end },
  });
}

it("edits all seven days and saves the requested Sunday and Monday ranges", async () => {
  render(<AvailabilityManager />);
  await screen.findByRole("switch", { name: "التوفر يوم الأحد" });
  expect(screen.getAllByRole("switch")).toHaveLength(7);
  expect(screen.getByLabelText("مدة موعد التواصل")).toHaveValue("30");
  expect(screen.getByLabelText("عرض المواعيد القادمة لمدة")).toHaveValue("14");
  fireEvent.click(screen.getByRole("switch", { name: "التوفر يوم الأحد" }));
  await addRange("الأحد", 1, "17:00", "19:00");
  await addRange("الأحد", 2, "21:00", "22:00");
  fireEvent.click(screen.getByRole("switch", { name: "التوفر يوم الاثنين" }));
  await addRange("الاثنين", 1, "17:00", "19:00");
  fireEvent.click(screen.getByRole("button", { name: "حفظ جدول المواعيد" }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledOnce());
  const [url, data] = vi.mocked(api.patch).mock.calls[0];
  expect(url).toBe("/matchmaker/availability");
  expect((data as WeeklySchedule).days[0].ranges).toEqual([
    { start_time: "17:00", end_time: "19:00" },
    { start_time: "21:00", end_time: "22:00" },
  ]);
  expect((data as WeeklySchedule).days[1].is_active).toBe(true);
});

it("blocks overlapping and reversed ranges before saving", async () => {
  render(<AvailabilityManager />);
  fireEvent.click(
    await screen.findByRole("switch", { name: "التوفر يوم الأحد" }),
  );
  await addRange("الأحد", 1, "17:00", "19:00");
  await addRange("الأحد", 2, "18:00", "20:00");
  fireEvent.click(screen.getByRole("button", { name: "حفظ جدول المواعيد" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "الفترات المتداخلة غير مسموحة",
  );
  expect(api.patch).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("الأحد نهاية الفترة 2"), {
    target: { value: "16:00" },
  });
  fireEvent.click(screen.getByRole("button", { name: "حفظ جدول المواعيد" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "ساعة النهاية يجب أن تكون بعد البداية",
  );
});

it("keeps ranges when a day is disabled and lets the matchmaker remove a range", async () => {
  render(<AvailabilityManager />);
  fireEvent.click(
    await screen.findByRole("switch", { name: "التوفر يوم الأحد" }),
  );
  await addRange("الأحد", 1, "17:00", "19:00");
  fireEvent.click(screen.getByRole("switch", { name: "التوفر يوم الأحد" }));
  expect(
    screen.queryByLabelText("الأحد بداية الفترة 1"),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "حفظ جدول المواعيد" }));
  await waitFor(() => expect(api.patch).toHaveBeenCalled());
  expect(
    (vi.mocked(api.patch).mock.calls[0][1] as WeeklySchedule).days[0],
  ).toMatchObject({
    is_active: false,
    ranges: [{ start_time: "17:00", end_time: "19:00" }],
  });
  await waitFor(() =>
    expect(
      screen.getByRole("switch", { name: "التوفر يوم الأحد" }),
    ).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("switch", { name: "التوفر يوم الأحد" }));
  expect(screen.getByLabelText("الأحد بداية الفترة 1")).toHaveValue("17:00");
  fireEvent.click(screen.getByRole("button", { name: "حذف فترة الأحد 1" }));
  expect(
    screen.queryByLabelText("الأحد بداية الفترة 1"),
  ).not.toBeInTheDocument();
});
