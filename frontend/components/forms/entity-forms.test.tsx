import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/services/api";
import { toast } from "sonner";
import { FemaleProfileForm, MeetingForm, PaymentForm } from "./entity-forms";

vi.mock("@/services/api", () => ({ api: { post: vi.fn(), patch: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => vi.resetAllMocks());

describe("API forms", () => {
  it("omits blank optional numbers when creating a female profile", async () => {
    vi.mocked(api.post).mockResolvedValue({});
    const done = vi.fn();
    const { container } = render(<FemaleProfileForm done={done} />);

    fireEvent.change(screen.getByLabelText(/الاسم الأول/), { target: { value: "سارة" } });
    fireEvent.change(screen.getByLabelText(/الهاتف/), { target: { value: "+963911223344" } });
    fireEvent.change(screen.getByLabelText(/^العمر \*/u), { target: { value: "26" } });
    fireEvent.change(screen.getByLabelText(/المحافظة/), { target: { value: "دمشق" } });
    fireEvent.change(screen.getByLabelText(/^الحالة \*/u), { target: { value: "ACTIVE" } });
    fireEvent.change(screen.getByLabelText(/التفضيل/), { target: { value: "MATCHMAKER" } });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    const [path, body] = vi.mocked(api.post).mock.calls[0];
    expect(path).toBe("/matchmaker/female-profiles");
    const json = JSON.parse(JSON.stringify(body));
    expect(json).toMatchObject({ age: 26, status: "ACTIVE", desired_male: {} });
    expect(json).not.toHaveProperty("height");
    expect(json).not.toHaveProperty("age_min");
  });

  it("patches an existing female profile with translated select values", async () => {
    vi.mocked(api.patch).mockResolvedValue({});
    const done = vi.fn();
    const { container } = render(
      <FemaleProfileForm
        done={done}
        initial={{
          id: "profile-1",
          first_name: "سارة",
          phone: "+963911223344",
          age: 26,
          governorate: "دمشق",
          status: "ACTIVE",
          contact_preference: "GUARDIAN_FIRST",
          desired_male: { age_min: 25, age_max: 30, height_min: 160, marital_status: "SINGLE" },
        }}
      />,
    );

    expect(screen.getByDisplayValue("التواصل مع ولي الأمر أولا")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/الطول الأدنى/), { target: { value: "170" } });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    const [path, body] = vi.mocked(api.patch).mock.calls[0];
    expect(path).toBe("/matchmaker/female-profiles/profile-1");
    expect(JSON.parse(JSON.stringify(body))).toMatchObject({
      desired_male: { height_min: 170, marital_status: "SINGLE" },
      contact_preference: "GUARDIAN_FIRST",
    });
  });

  it("uses the server fee when the payment amount is blank", async () => {
    vi.mocked(api.post).mockResolvedValue({});
    const { container } = render(<PaymentForm done={vi.fn()} />);
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(vi.mocked(api.post).mock.calls[0][1]).not.toHaveProperty("amount");
    expect(vi.mocked(api.post).mock.calls[0][1]).not.toHaveProperty("match_case_id");
  });

  it("shows a clear Arabic message for API validation failures and leaves the form open", async () => {
    vi.mocked(api.post).mockRejectedValue(Object.assign(new Error("server validation"), { status: 422 }));
    const done = vi.fn();
    const { container } = render(<FemaleProfileForm done={done} />);
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "راجع القيم المدخلة. بعض الحقول خارج الحدود المسموحة أو بصيغة غير صحيحة.",
      ),
    );
    expect(done).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "حفظ الملف" })).toBeEnabled();
  });

  it("sends meeting participants as an array", async () => {
    vi.mocked(api.post).mockResolvedValue({});
    const { container } = render(<MeetingForm done={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/المشاركون/), { target: { value: "ولي الأمر, الخطابة" } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(vi.mocked(api.post).mock.calls[0][1]).toMatchObject({ participants: ["ولي الأمر", "الخطابة"] });
  });
});
