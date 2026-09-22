import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import FemalePage from "./page";
import { PreferencesProvider } from "@/components/providers/preferences-provider";
import { api } from "@/services/api";

vi.mock("@/services/api", () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

beforeEach(() => vi.resetAllMocks());

const slots = [1, 2, 3].map((index) => ({
  id: `00000000-0000-4000-8000-00000000000${index}`,
  matchmaker_id: "00000000-0000-4000-8000-000000000099",
  appointment_date: "2030-09-13",
  scheduled_at: `2030-09-13T${14 + index}:00:00Z`,
  ends_at: `2030-09-13T${14 + index}:30:00Z`,
  status: "AVAILABLE",
}));

function renderFemalePage() {
  return render(
    <PreferencesProvider>
      <FemalePage />
    </PreferencesProvider>,
  );
}

it("shows three choices and submits only contact details and the selected appointment", async () => {
  vi.mocked(api.get).mockResolvedValue(slots);
  vi.mocked(api.post).mockResolvedValue({});
  renderFemalePage();
  fireEvent.click(screen.getByRole("button", { name: "اتركي رقمك لتتواصل معك الخطّابة" }));
  const radios = await screen.findAllByRole("radio");
  expect(radios).toHaveLength(3);
  expect(screen.queryByText(/الاسم الأول|العمر|أفضل وقت للتواصل/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("رقم الهاتف *"), {
    target: { value: "+963966112233" },
  });
  fireEvent.change(screen.getByLabelText("المحافظة *"), {
    target: { value: "DAMASCUS" },
  });
  fireEvent.click(radios[0]);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "إرسال الطلب بأمان" }));
  await screen.findByText("وصل طلبك بأمان");
  expect(api.post).toHaveBeenCalledWith("/female-leads", {
    phone: "+963966112233",
    governorate: "DAMASCUS",
    matchmaker_id: slots[0].matchmaker_id,
    scheduled_at: slots[0].scheduled_at,
    consent: true,
    notes: "",
  });
});

it("shows the required empty message and prevents submission", async () => {
  vi.mocked(api.get).mockResolvedValue([]);
  renderFemalePage();
  fireEvent.click(screen.getByRole("button", { name: "اتركي رقمك لتتواصل معك الخطّابة" }));
  await screen.findByText("لا توجد مواعيد متاحة حاليا، يرجى المحاولة لاحقا.");
  expect(screen.getByRole("button", { name: "إرسال الطلب بأمان" })).toBeDisabled();
});

it("refreshes choices when another visitor has booked the selected slot", async () => {
  vi.mocked(api.get).mockResolvedValueOnce(slots).mockResolvedValue(slots.slice(1));
  vi.mocked(api.post).mockRejectedValue(new Error("الموعد محجوز"));
  renderFemalePage();
  fireEvent.click(screen.getByRole("button", { name: "اتركي رقمك لتتواصل معك الخطّابة" }));
  fireEvent.click((await screen.findAllByRole("radio"))[0]);
  fireEvent.change(screen.getByLabelText("رقم الهاتف *"), {
    target: { value: "+963966112233" },
  });
  fireEvent.change(screen.getByLabelText("المحافظة *"), {
    target: { value: "DAMASCUS" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "إرسال الطلب بأمان" }));
  await waitFor(() => expect(screen.getAllByRole("radio")).toHaveLength(2));
  expect(screen.getAllByRole("radio").every((radio) => !(radio as HTMLInputElement).checked)).toBe(true);
});
