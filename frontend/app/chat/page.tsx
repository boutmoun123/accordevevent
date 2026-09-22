"use client";

import { Bot, Check, ChevronRight, LoaderCircle, LockKeyhole, LogIn, Moon, Pencil, RotateCcw, Sun, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { ChatComposer } from "@/components/chat/chat-composer";
import { RequestSuccess } from "@/components/chat/request-success";
import { useAuth } from "@/components/providers/auth-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/feedback";
import { governorateOptions, languageLabel } from "@/lib/i18n";
import { api } from "@/services/api";
import type { MalePhoneChallenge, MaleRequest } from "@/types";

type Section = "desired" | "self";
type Localized = { ar: string; en: string };
type Quick = { value: string; label: Localized };
type Step = {
  id: string;
  section: Section;
  field: string;
  question: Localized;
  hint: Localized;
  quick?: Quick[];
  optional?: boolean;
};
type Message = { id: string; role: "assistant" | "user"; content: string; hint?: string; quick?: Quick[]; stepId?: string; edited?: boolean; value?: string; kind?: "phone" };

const q = (value: string, ar: string, en: string): Quick => ({ value, label: { ar, en } });
const choice = {
  noPreference: q("NO_PREFERENCE", "لا يهم", "No preference"),
  skip: q("SKIP", "تخطي", "Skip"),
  yes: q("YES", "نعم", "Yes"),
  no: q("NO", "لا", "No"),
};
const ageQuick = [
  q("18-25", "18-25", "18-25"),
  q("26-30", "26-30", "26-30"),
  q("31-35", "31-35", "31-35"),
  q("36-40", "36-40", "36-40"),
  q("41-45", "41-45", "41-45"),
  q("46-50", "46-50", "46-50"),
  q("OVER_50", "أكثر من 50", "Over 50"),
  choice.noPreference,
];
const governorateQuick = governorateOptions.slice(0, 8).map((item) => q(item.value, item.ar, item.en));

const steps: Step[] = [
  { id: "preferred_marital_status", section: "desired", field: "marital_status", question: { ar: "ما الحالة الاجتماعية المقبولة لديك؟", en: "What marital status would you prefer?" }, hint: { ar: "اختر الحالات المقبولة لديك، ويمكنك اختيار لا يهم.", en: "Choose acceptable statuses, or choose no preference." }, quick: [q("SINGLE", "عزباء", "Single"), q("DIVORCED", "منفصلة", "Divorced"), q("WIDOWED", "أرملة", "Widowed"), q("DIVORCED_OR_WIDOWED", "منفصلة أو أرملة", "Divorced or widowed"), choice.noPreference] },
  { id: "desired_age", section: "desired", field: "age", question: { ar: "ما العمر الذي تفضله لشريكة حياتك؟", en: "What age range would you prefer for your partner?" }, hint: { ar: "مثلا: 24-30 سنة، أو اختر من الخيارات.", en: "For example: 24-30, or choose one of the options." }, quick: ageQuick },
  { id: "desired_origin", section: "desired", field: "origin", question: { ar: "من أي محافظة تفضل أن تكون بالأصل؟", en: "Which original governorate would you prefer?" }, hint: { ar: "يمكنك اختيار محافظة محددة أو لا يهم.", en: "You can choose a governorate or no preference." }, quick: [...governorateQuick, choice.noPreference] },
  { id: "desired_height", section: "desired", field: "height", question: { ar: "ما الطول الذي تفضله؟", en: "What height would you prefer?" }, hint: { ar: "مثلا: 160-170 سم، أو لا يهم.", en: "For example: 160-170 cm, or no preference." }, quick: [q("UNDER_150", "أقل من 150", "Under 150"), q("150-159", "150-159", "150-159"), q("160-169", "160-169", "160-169"), q("170-179", "170-179", "170-179"), q("180_PLUS", "180 فأكثر", "180 or more"), choice.noPreference] },
  { id: "desired_education", section: "desired", field: "education", question: { ar: "ما المستوى التعليمي الذي تفضله؟", en: "What education level would you prefer?" }, hint: { ar: "اختر المستوى الأقرب لتفضيلك.", en: "Choose the closest preferred education level." }, quick: [q("BASIC", "تعليم أساسي", "Basic education"), q("HIGH_SCHOOL", "ثانوي", "High school"), q("INSTITUTE", "معهد", "Institute"), q("UNIVERSITY", "جامعي", "University"), q("POSTGRADUATE", "دراسات عليا", "Postgraduate"), choice.noPreference] },
  { id: "desired_occupation", section: "desired", field: "occupation", question: { ar: "ما الوضع المهني الذي تفضله للفتاة؟", en: "What work status would you prefer?" }, hint: { ar: "مثلا موظفة، صاحبة عمل، أو لا يهم.", en: "For example: employee, business owner, or no preference." }, quick: [q("EMPLOYEE", "موظفة", "Employee"), q("BUSINESS_OWNER", "صاحبة عمل", "Business owner"), q("FREELANCE", "عمل حر", "Freelance"), q("STUDENT", "طالبة", "Student"), q("NOT_WORKING", "لا تعمل حاليا", "Not currently working"), q("HOMEMAKER", "سيدة منزل", "Homemaker"), choice.noPreference] },
  { id: "desired_residence", section: "desired", field: "residence", question: { ar: "في أي محافظة تفضل أن تكون مقيمة؟", en: "Where would you prefer her to live?" }, hint: { ar: "يمكنك اختيار محافظة محددة أو لا يهم.", en: "You can choose a governorate or no preference." }, quick: [...governorateQuick, choice.noPreference] },
  { id: "desired_children", section: "desired", field: "children", question: { ar: "هل تقبل بفتاة لديها أطفال؟", en: "Would you accept someone who has children?" }, hint: { ar: "حدد إن كان وجود أطفال مقبولا بالنسبة لك.", en: "Tell us whether having children is acceptable for you." }, quick: [choice.yes, choice.no, choice.noPreference, q("PREFER_SINGLE", "أريد عزباء", "I prefer single")] },
  { id: "desired_religion", section: "desired", field: "religion", question: { ar: "ما الديانة أو الانتماء الديني المقبول لديك؟", en: "What religion or religious background would be acceptable?" }, hint: { ar: "اختر ما يناسبك، أو لا يهم.", en: "Choose what suits you, or no preference." }, quick: [q("SUNNI_MUSLIM", "مسلمة سنية", "Sunni Muslim"), q("ALAWITE_MUSLIM", "مسلمة علوية", "Alawite Muslim"), q("SHIA_MUSLIM", "مسلمة شيعية", "Shia Muslim"), q("CHRISTIAN", "مسيحية", "Christian"), choice.noPreference] },
  { id: "desired_commitment", section: "desired", field: "commitment", question: { ar: "ما درجة الالتزام الديني التي تفضلها؟", en: "What level of religious commitment would you prefer?" }, hint: { ar: "اختر المستوى الأقرب لتفضيلك.", en: "Choose the closest level to your preference." }, quick: [q("COMMITTED", "ملتزمة", "Committed"), q("MODERATE", "متوسطة الالتزام", "Moderately committed"), q("NOT_VERY", "غير ملتزمة كثيرا", "Not very committed"), choice.noPreference] },
  { id: "desired_smoking", section: "desired", field: "smoking", question: { ar: "هل التدخين مقبول بالنسبة لك؟", en: "Is smoking acceptable for you?" }, hint: { ar: "هل تقبل بفتاة تدخن؟", en: "Would you accept someone who smokes?" }, quick: [choice.yes, choice.no, choice.noPreference] },
  { id: "desired_hijab", section: "desired", field: "hijab", question: { ar: "ما طبيعة اللباس التي تفضلها؟", en: "What dress style would you prefer?" }, hint: { ar: "اختر التفضيل المناسب أو لا يهم.", en: "Choose the suitable preference, or no preference." }, quick: [q("HIJAB", "محجبة", "Hijab"), q("NONE", "غير محجبة", "No hijab"), choice.noPreference] },
  { id: "desired_work", section: "desired", field: "work_after_marriage", question: { ar: "ما رأيك بعمل الزوجة بعد الزواج؟", en: "What do you think about your spouse working after marriage?" }, hint: { ar: "اختر رأيك الأقرب بعد الزواج.", en: "Choose the closest view." }, quick: [q("SHOULD_WORK", "أرغب أن تعمل", "I prefer that she works"), q("SHOULD_NOT_WORK", "أفضل ألا تعمل", "I prefer that she does not work"), q("HER_CHOICE", "الأمر يعود لها", "It is her choice"), q("DEPENDS", "حسب الظروف", "Depends on circumstances"), choice.noPreference] },
  { id: "self_smoking", section: "self", field: "smoking", question: { ar: "هل أنت مدخن؟", en: "Do you smoke?" }, hint: { ar: "أجب بما يناسبك.", en: "Answer what fits you." }, quick: [choice.no, choice.yes, q("SOMETIMES", "أحيانا", "Sometimes")] },
  { id: "self_commitment", section: "self", field: "commitment", question: { ar: "كيف تصف درجة التزامك الديني؟", en: "How would you describe your religious commitment?" }, hint: { ar: "اختر المستوى الأقرب لوصفك.", en: "Choose the closest level." }, quick: [q("COMMITTED", "ملتزم", "Committed"), q("MODERATE", "متوسط الالتزام", "Moderately committed"), q("NOT_VERY", "غير ملتزم كثيرا", "Not very committed")] },
  { id: "self_education", section: "self", field: "education", question: { ar: "ما مستواك التعليمي؟", en: "What is your education level?" }, hint: { ar: "اكتب أو اختر أقرب مستوى.", en: "Write it or choose the closest level." }, quick: [q("BASIC", "تعليم أساسي", "Basic education"), q("HIGH_SCHOOL", "ثانوي", "High school"), q("INSTITUTE", "معهد متوسط", "Intermediate institute"), q("UNIVERSITY_STUDENT", "طالب جامعي", "University student"), q("UNIVERSITY_GRADUATE", "خريج جامعي", "University graduate"), q("POSTGRADUATE", "دراسات عليا", "Postgraduate")] },
  { id: "self_residence", section: "self", field: "residence", question: { ar: "في أي محافظة تقيم حاليا؟", en: "Which governorate do you currently live in?" }, hint: { ar: "اكتب أو اختر المحافظة الحالية.", en: "Write or choose your current governorate." }, quick: [...governorateQuick, q("OUTSIDE_SYRIA", "خارج سوريا", "Outside Syria")] },
  { id: "self_marital", section: "self", field: "marital_status", question: { ar: "ما حالتك الاجتماعية؟", en: "What is your marital status?" }, hint: { ar: "اختر الحالة الحالية.", en: "Choose your current status." }, quick: [q("SINGLE", "أعزب", "Single"), q("DIVORCED", "منفصل", "Divorced"), q("WIDOWED", "أرمل", "Widowed")] },
  { id: "self_money", section: "self", field: "financial_status", question: { ar: "كيف تصف وضعك المادي؟", en: "How would you describe your financial situation?" }, hint: { ar: "اختر الأقرب لوضعك الحالي.", en: "Choose the closest description." }, quick: [q("LIMITED", "دخل محدود", "Limited income"), q("AVERAGE", "متوسط الدخل", "Average income"), q("COMFORTABLE", "مستور", "Comfortable"), q("STABLE", "مستقر ماديا", "Financially stable"), q("WELL_OFF", "ميسور الحال", "Well-off")] },
  { id: "self_other", section: "self", field: "other_criteria", question: { ar: "هل لديك مواصفات أخرى تبحث عنها؟", en: "Do you have any other preferences?" }, hint: { ar: "يمكنك كتابة أي تفاصيل مهمة أو تخطي السؤال.", en: "You can write any important details, or skip this question." }, quick: [choice.skip], optional: true },
  { id: "self_age", section: "self", field: "age", question: { ar: "كم عمرك؟", en: "How old are you?" }, hint: { ar: "مثلا: 32 سنة.", en: "For example: 32 years old." }, quick: ageQuick.filter((item) => item.value !== "NO_PREFERENCE") },
  { id: "self_height", section: "self", field: "height", question: { ar: "ما طولك؟", en: "What is your height?" }, hint: { ar: "مثلا: 175 سم.", en: "For example: 175 cm." }, quick: [q("UNDER_160", "أقل من 160", "Under 160"), q("160-169", "160-169", "160-169"), q("170-179", "170-179", "170-179"), q("180-189", "180-189", "180-189"), q("190_PLUS", "190 فأكثر", "190 or more")] },
  { id: "self_occupation", section: "self", field: "occupation", question: { ar: "ما وضعك المهني؟", en: "What is your work status?" }, hint: { ar: "مثلا موظف، صاحب عمل، عمل حر.", en: "For example: employee, business owner, freelance." }, quick: [q("EMPLOYEE", "موظف", "Employee"), q("BUSINESS_OWNER", "صاحب عمل", "Business owner"), q("FREELANCE", "عمل حر", "Freelance"), q("STUDENT", "طالب", "Student"), q("NOT_WORKING", "لا أعمل حاليا", "Not currently working")] },
  { id: "self_origin", section: "self", field: "origin", question: { ar: "أنت بالأصل من أي محافظة؟", en: "Which governorate are you originally from?" }, hint: { ar: "اكتب المحافظة الأصلية أو اخترها.", en: "Write or choose your original governorate." }, quick: [...governorateQuick, q("OUTSIDE_SYRIA", "خارج سوريا", "Outside Syria")] },
  { id: "self_children", section: "self", field: "children", question: { ar: "هل لديك أطفال؟", en: "Do you have children?" }, hint: { ar: "حدد إن كان لديك أطفال.", en: "Tell us whether you have children." }, quick: [choice.no, q("YES_WITH_ME", "نعم، يعيشون معي", "Yes, they live with me"), q("YES_NOT_WITH_ME", "نعم، لا يعيشون معي", "Yes, they do not live with me"), q("NOT_APPLICABLE", "لا ينطبق", "Not applicable")] },
  { id: "self_religion", section: "self", field: "religion", question: { ar: "ما ديانتك أو انتماؤك الديني؟", en: "What is your religion or religious background?" }, hint: { ar: "اكتب أو اختر الأقرب.", en: "Write it or choose the closest option." }, quick: [q("SUNNI_MUSLIM", "مسلم سني", "Sunni Muslim"), q("ALAWITE_MUSLIM", "مسلم علوي", "Alawite Muslim"), q("SHIA_MUSLIM", "مسلم شيعي", "Shia Muslim"), q("CHRISTIAN", "مسيحي", "Christian")] },
];

const chatText = {
  ar: {
    login: "تسجيل الدخول", privateChat: "محادثة خاصة", newRequest: "طلب جديد", editHint: "عدّل إجابتك ثم اضغط حفظ. سنحافظ على مكانك الحالي في المحادثة.", edit: "تعديل", edited: "تم التعديل", saved: "تم التعديل", saving: "جاري الحفظ...", loading: "جاري تجهيز الصفحة...", saveProgress: "احفظ تقدمك", saveProgressHint: "أدخل رقم هاتفك لنحفظ إجاباتك وتتمكن من متابعة طلبك لاحقا. لن يظهر رقمك للآخرين.", enterPhone: "أدخل رقم هاتف صحيحا", sendOtp: "تعذر إرسال رمز التحقق", enterOtp: "أدخل رمز التحقق", otpSent: "أدخل رمز التحقق المرسل إلى رقمك.", devCode: "رمز التطوير", otpHint: "الرمز صالح لبضع دقائق.", otpInvalid: "رمز التحقق غير صحيح", verifyContinue: "تحقق وتابع", saveFailed: "تعذر حفظ طلبك", editMode: "تعديل إجابة سابقة", cancel: "إلغاء", saveEdit: "حفظ التعديل", composerHint: "يمكنك الضغط على خيار سريع أو كتابة إجابة طبيعية.", placeholder: "اكتب إجابتك هنا...", sendCode: "إرسال رمز التحقق",
  },
  en: {
    login: "Sign in", privateChat: "Private chat", newRequest: "New request", editHint: "Edit your answer, then save. We will keep your current place in the chat.", edit: "Edit", edited: "Edited", saved: "Edited", saving: "Saving...", loading: "Preparing the page...", saveProgress: "Save your progress", saveProgressHint: "Enter your phone number so we can save your answers and let you continue your request later. Your number will not be shown to others.", enterPhone: "Enter a valid phone number", sendOtp: "Could not send the verification code", enterOtp: "Enter the verification code", otpSent: "Enter the verification code sent to your number.", devCode: "Development code", otpHint: "The code is valid for a few minutes.", otpInvalid: "The verification code is incorrect", verifyContinue: "Verify and continue", saveFailed: "Could not save your request", editMode: "Editing a previous answer", cancel: "Cancel", saveEdit: "Save edit", composerHint: "Choose a quick reply or type a natural answer.", placeholder: "Type your answer here...", sendCode: "Send verification code",
  },
};

const rangeMap: Record<string, [number, number]> = {
  "18-25": [18, 25], "26-30": [26, 30], "31-35": [31, 35], "36-40": [36, 40], "41-45": [41, 45], "46-50": [46, 50], OVER_50: [51, 90], NO_PREFERENCE: [18, 90],
};
const heightMap: Record<string, [number | undefined, number | undefined]> = {
  UNDER_150: [120, 149], "150-159": [150, 159], "160-169": [160, 169], "170-179": [170, 179], "180_PLUS": [180, 230], UNDER_160: [120, 159], "180-189": [180, 189], "190_PLUS": [190, 230], NO_PREFERENCE: [undefined, undefined],
};

function uuid() {
  return crypto.randomUUID();
}
function label(value: Localized, language: "ar" | "en") {
  return value[language];
}
function displayQuestion(step: Step, language: "ar" | "en"): Message {
  return { id: uuid(), role: "assistant", content: label(step.question, language), hint: label(step.hint, language), quick: step.quick };
}
function rangeFromText(text: string, fallback?: [number, number]) {
  if (rangeMap[text]) return rangeMap[text];
  const nums = [...text.matchAll(/\d{2,3}/g)].map((match) => Number(match[0]));
  if (nums.length >= 2) return [Math.min(nums[0], nums[1]), Math.max(nums[0], nums[1])] as [number, number];
  return fallback;
}
function selectedGovernorates(text: string) {
  if (!text || text === "NO_PREFERENCE") return [];
  return governorateOptions.some((item) => item.value === text) ? [text] : [];
}
function optionalValue(value?: string) {
  return value && value !== "NO_PREFERENCE" && value !== "SKIP" ? value : undefined;
}
function marital(value?: string) {
  if (!value || value === "NO_PREFERENCE") return undefined;
  if (value === "DIVORCED_OR_WIDOWED") return "DIVORCED";
  return ["SINGLE", "DIVORCED", "WIDOWED"].includes(value) ? value : undefined;
}
function boolPref(value?: string) {
  if (!value || value === "NO_PREFERENCE") return undefined;
  if (value === "YES") return true;
  if (value === "NO" || value === "PREFER_SINGLE") return false;
  return undefined;
}
function buildPayload(self: Record<string, string>, desired: Record<string, string>) {
  const [selfAge] = rangeFromText(self.age || "", [30, 30]) || [30, 30];
  const [ageMin, ageMax] = rangeFromText(desired.age || "", [18, 90]) || [18, 90];
  const [height] = heightMap[self.height] || rangeFromText(self.height || "", [170, 170]) || [170];
  const [heightMin, heightMax] = heightMap[desired.height] || [];
  return {
    male_characteristics: {
      age: selfAge,
      governorate: self.residence || "OUTSIDE_SYRIA",
      marital_status: marital(self.marital_status),
      height,
      education: optionalValue(self.education),
      occupation: optionalValue(self.occupation),
      employment_status: optionalValue(self.financial_status),
      religious_preference: optionalValue(self.religion),
      children: self.children?.startsWith("YES") ? true : false,
      values: [optionalValue(self.commitment), optionalValue(self.smoking)].filter(Boolean),
      personality_traits: [optionalValue(self.other_criteria)].filter(Boolean),
    },
    desired_female_characteristics: {
      age_min: ageMin,
      age_max: ageMax,
      governorates: selectedGovernorates(desired.residence || desired.origin || ""),
      height_min: heightMin,
      height_max: heightMax,
      education: optionalValue(desired.education),
      occupation: optionalValue(desired.occupation),
      marital_status: marital(desired.marital_status),
      children: boolPref(desired.children),
      children_preference: boolPref(desired.children),
      hijab_status: optionalValue(desired.hijab),
      religious_preference: optionalValue(desired.religion),
      values: [optionalValue(desired.commitment), optionalValue(desired.smoking), optionalValue(desired.work_after_marriage)].filter(Boolean),
      traits: [],
      other_criteria: desired.origin && desired.origin !== "NO_PREFERENCE" ? `preferred_origin:${desired.origin}` : undefined,
    },
  };
}

export default function ChatPage() {
  const { loading: authLoading, refresh } = useAuth();
  const { dir, isDark, language, toggleLanguage, toggleTheme } = usePreferences();
  const text = chatText[language];
  const [messages, setMessages] = useState<Message[]>(() => [displayQuestion(steps[0], language)]);
  const [input, setInput] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [desired, setDesired] = useState<Record<string, string>>({});
  const [self, setSelf] = useState<Record<string, string>>({});
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [challenge, setChallenge] = useState<MalePhoneChallenge | null>(null);
  const [phoneStage, setPhoneStage] = useState<"none" | "phone" | "otp" | "verified">("none");
  const [busy, setBusy] = useState(false);
  const [request, setRequest] = useState<MaleRequest | null>(null);
  const [editing, setEditing] = useState<{ messageId: string; step: Step; resumeIndex: number } | null>(null);
  const [editingPhone, setEditingPhone] = useState<{ messageId: string } | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const current = steps[stepIndex];
  const progress = useMemo(() => Math.round(((stepIndex + 1) / steps.length) * 100), [stepIndex]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Re-label existing assistant messages when the shared language changes.
    setMessages((old) => old.map((message) => {
      if (message.role === "assistant" && message.stepId) {
        const step = steps.find((item) => item.id === message.stepId);
        return step ? { ...message, content: label(step.question, language), hint: label(step.hint, language), quick: step.quick } : message;
      }
      return message;
    }));
  }, [language]);

  const append = (items: Message[]) => setMessages((old) => [...old, ...items]);
  const saveAnswer = (step: Step, value: string) => {
    if (step.optional && value === "SKIP") return;
    if (step.section === "desired") setDesired((old) => ({ ...old, [step.field]: value }));
    else setSelf((old) => ({ ...old, [step.field]: value }));
  };
  const beginEdit = (message: Message) => {
    const step = steps.find((item) => item.id === message.stepId);
    if (!step || busy) return;
    setEditing({ messageId: message.id, step, resumeIndex: stepIndex });
    setInput(message.value || message.content);
    append([{ ...displayQuestion(step, language), hint: text.editHint }]);
  };
  const beginPhoneEdit = (message: Message) => {
    if (busy) return;
    setEditing(null);
    setEditingPhone({ messageId: message.id });
    setInput(message.value || message.content);
  };
  const cancelEdit = () => {
    setEditing(null);
    setEditingPhone(null);
    setInput("");
  };
  const savePhoneEdit = async (answer: string) => {
    if (!editingPhone) return;
    const editedPhone = answer.trim();
    if (editedPhone.length < 8) return toast.error(text.enterPhone);
    setBusy(true);
    try {
      const result = await api.startMalePhone(editedPhone);
      await refresh();
      const displayPhone = result.phone || editedPhone;
      setPhone(displayPhone);
      setInput("");
      setEditingPhone(null);
      setMessages((old) => old.map((message) => (
        message.id === editingPhone.messageId
          ? { ...message, content: displayPhone, value: displayPhone, edited: true }
          : message
      )));
      toast.success(text.saved);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : text.sendOtp);
    } finally {
      setBusy(false);
    }
  };
  const saveEdit = async (answer: string) => {
    if (!editing) return;
    const editedValue = answer.trim();
    if (!editedValue || busy) return;
    const { step, messageId, resumeIndex } = editing;
    setInput("");
    setEditing(null);
    saveAnswer(step, editedValue);
    setStepIndex(resumeIndex);
    setMessages((old) => old.map((message) => (message.id === messageId ? { ...message, content: editedValue, value: editedValue, edited: true } : message)));
    toast.success(text.saved);
  };
  const advance = async (answer: string, displayAnswer = answer) => {
    const value = answer.trim();
    const display = displayAnswer.trim();
    if (!value || busy || !current) return;
    if (editingPhone) {
      await savePhoneEdit(value);
      return;
    }
    if (editing) {
      await saveEdit(value);
      return;
    }
    setInput("");
    append([{ id: uuid(), role: "user", content: display, value, stepId: current.id }]);
    saveAnswer(current, value);
    const nextIndex = stepIndex + 1;
    if (nextIndex === 13 && phoneStage === "none") {
      setPhoneStage("phone");
      append([{ id: uuid(), role: "assistant", content: text.saveProgress, hint: text.saveProgressHint }]);
      setStepIndex(nextIndex);
      return;
    }
    if (nextIndex < steps.length) {
      setStepIndex(nextIndex);
      const nextMessage = displayQuestion(steps[nextIndex], language);
      append([{ ...nextMessage, stepId: steps[nextIndex].id }]);
      return;
    }
    await finish();
  };
  const startOtp = async () => {
    if (phone.trim().length < 8) return toast.error(text.enterPhone);
    setBusy(true);
    try {
      const result = await api.startMalePhone(phone.trim());
      await refresh();
      if (!result.otp_required) {
        setPhoneStage("verified");
        const displayPhone = result.phone || phone.trim();
        setPhone(displayPhone);
        append([{ id: uuid(), role: "user", content: displayPhone, value: displayPhone, kind: "phone" }, { ...displayQuestion(steps[stepIndex], language), stepId: steps[stepIndex].id }]);
        return;
      }
      setChallenge(result);
      setPhoneStage("otp");
      append([{ id: uuid(), role: "user", content: phone, value: phone, kind: "phone" }, { id: uuid(), role: "assistant", content: text.otpSent, hint: result.mock_otp ? `${text.devCode}: ${result.mock_otp}` : text.otpHint }]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : text.sendOtp);
    } finally {
      setBusy(false);
    }
  };
  const verifyOtp = async () => {
    if (!challenge || otp.trim().length < 4) return toast.error(text.enterOtp);
    setBusy(true);
    try {
      await api.verifyMalePhone(challenge.challenge_id, otp.trim());
      await refresh();
      setPhoneStage("verified");
      append([{ id: uuid(), role: "user", content: otp }, { ...displayQuestion(steps[stepIndex], language), stepId: steps[stepIndex].id }]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : text.otpInvalid);
    } finally {
      setBusy(false);
    }
  };
  const finish = async () => {
    setBusy(true);
    try {
      setRequest(await api.post<MaleRequest>("/male/request", buildPayload(self, desired)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : text.saveFailed);
    } finally {
      setBusy(false);
    }
  };
  const reset = () => {
    setMessages([{ ...displayQuestion(steps[0], language), stepId: steps[0].id }]);
    setStepIndex(0);
    setDesired({});
    setSelf({});
    setPhone("");
    setOtp("");
    setChallenge(null);
    setPhoneStage("none");
    setRequest(null);
    setEditingPhone(null);
  };

  if (authLoading) return <LoadingState label={text.loading} />;
  if (request?.request_code) {
    return (
      <main dir={dir} className="min-h-screen px-4 py-8">
        <div className="mx-auto mb-10 flex max-w-5xl items-center justify-between">
          <Logo />
          <Button variant="ghost" onClick={reset}><RotateCcw size={16} /> {text.newRequest}</Button>
        </div>
        <RequestSuccess code={request.request_code} />
      </main>
    );
  }

  return (
    <main dir={dir} className={`flex min-h-[100dvh] flex-col transition-colors ${isDark ? "bg-[#180B13] text-[#FFF7FA]" : "bg-[#faf9f8] text-[#111936]"}`}>
      <header className={`sticky top-0 z-20 border-b backdrop-blur ${isDark ? "border-[#4A2134] bg-[#21101A]/95" : "bg-white/90"}`}>
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label={language === "ar" ? "العودة" : "Back"}><ChevronRight className={dir === "ltr" ? "rotate-180" : ""} /></Link>
            <Logo />
          </div>
          <div className="flex items-center gap-2" dir="ltr">
            <Button type="button" size="sm" variant="outline" className={`h-9 ${isDark ? "border-[#4A2134] bg-[#2B1421] text-[#FF6F9C] hover:bg-[#3A1730]" : ""}`} onClick={toggleLanguage}>{languageLabel[language]}</Button>
            <Button type="button" size="icon" variant="outline" className={`h-9 w-9 ${isDark ? "border-[#4A2134] bg-[#2B1421] text-[#FF6F9C] hover:bg-[#3A1730]" : ""}`} onClick={toggleTheme} aria-label={isDark ? "Light mode" : "Dark mode"}>{isDark ? <Moon size={15} /> : <Sun size={15} />}</Button>
            <Button asChild size="sm" variant="outline" className={`h-9 ${isDark ? "border-[#4A2134] bg-[#2B1421] text-[#FF6F9C] hover:bg-[#3A1730]" : ""}`}><Link href="/auth/login"><LogIn size={15} /> {text.login}</Link></Button>
            <span className="hidden items-center gap-1.5 text-xs text-green-700 sm:flex"><LockKeyhole size={14} /> {text.privateChat}</span>
          </div>
        </div>
      </header>
      <div className={`mx-auto mt-4 h-2 w-full max-w-3xl overflow-hidden rounded-full ${isDark ? "bg-[#2B1421]" : "bg-slate-200"}`}><div className="h-full bg-brand-rose transition-all" style={{ width: `${progress}%` }} /></div>
      <section className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 pb-52">
        <div className="space-y-6">
          {messages.map((message) => (
            <div key={message.id} className={`group flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${message.role === "assistant" ? "bg-brand-rose text-white" : "bg-brand-navy text-white"}`}>{message.role === "assistant" ? <Bot size={18} /> : <UserRound size={18} />}</div>
              <div className={`max-w-[84%] rounded-2xl px-4 py-3 leading-7 ${message.role === "assistant" ? (isDark ? "rounded-tr-sm border border-[#4A2134] bg-[#21101A] text-[#FFF7FA]" : "rounded-tr-sm border bg-white") : "rounded-tl-sm bg-brand-navy text-white"}`}>
                <div className="flex items-start gap-2">
                  <p className="min-w-0 flex-1">{message.content}</p>
                  {message.role === "user" && (message.stepId || message.kind === "phone") && <button type="button" aria-label={text.edit} title={text.edit} onClick={() => message.kind === "phone" ? beginPhoneEdit(message) : beginEdit(message)} className="shrink-0 rounded-full p-1 text-white/70 transition hover:bg-white/10 hover:text-white"><Pencil size={14} /></button>}
                </div>
                {message.edited && <p className="mt-1 text-[11px] text-white/60">{text.edited}</p>}
                {message.hint && <p className={`mt-2 text-sm ${isDark ? "text-[#C9A8B5]" : "text-slate-400"}`}>{message.hint}</p>}
                {message.quick && message.id === messages[messages.length - 1]?.id && phoneStage !== "phone" && phoneStage !== "otp" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.quick.map((quick) => <button key={quick.value} type="button" onClick={() => void advance(quick.value, quick.label[language])} className={`rounded-full border px-3 py-1.5 text-xs hover:border-brand-rose ${isDark ? "border-[#4A2134] bg-[#2B1421] text-[#E8D7DE]" : "bg-white text-slate-600"}`}>{quick.label[language]}</button>)}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && <div className={`flex items-center gap-3 text-sm ${isDark ? "text-[#C9A8B5]" : "text-slate-400"}`}><LoaderCircle className="animate-spin" size={18} /> {text.saving}</div>}
          <div ref={end} />
        </div>
      </section>
      <div className={`fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t px-4 pb-4 pt-10 ${isDark ? "from-[#180B13] via-[#180B13] to-transparent" : "from-[#faf9f8] via-[#faf9f8] to-transparent"}`}>
        <div className="mx-auto max-w-3xl">
          {phoneStage === "phone" ? (
            <div className={`rounded-2xl border p-3 shadow-soft ${isDark ? "border-[#4A2134] bg-[#21101A]" : "bg-white"}`}>
              <input dir="ltr" inputMode="tel" className="field" placeholder="09xxxxxxxx" value={phone} onChange={(event) => setPhone(event.target.value)} />
              <Button className="mt-3 w-full" disabled={busy} onClick={startOtp}>{language === "ar" ? "متابعة" : "Continue"}</Button>
            </div>
          ) : phoneStage === "otp" ? (
            <div className={`rounded-2xl border p-3 shadow-soft ${isDark ? "border-[#4A2134] bg-[#21101A]" : "bg-white"}`}>
              <input dir="ltr" inputMode="numeric" className="field text-center font-mono text-xl tracking-[0.35em]" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} />
              <Button className="mt-3 w-full" disabled={busy} onClick={verifyOtp}>{text.verifyContinue}</Button>
            </div>
          ) : (
            <div>
              {(editing || editingPhone) && <div className={`mb-2 flex items-center justify-between rounded-xl border px-3 py-2 text-sm shadow-soft ${isDark ? "border-[#4A2134] bg-[#21101A]" : "bg-white"}`}><span className={isDark ? "text-[#E8D7DE]" : "text-slate-600"}>{text.editMode}</span><button type="button" onClick={cancelEdit} className={`rounded-full p-1 ${isDark ? "text-[#C9A8B5] hover:bg-[#2B1421] hover:text-white" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"}`} aria-label={text.cancel}><X size={16} /></button></div>}
              <ChatComposer value={input} onChange={setInput} onSend={() => void advance(input)} disabled={busy || Boolean(request)} dir={dir} placeholder={editingPhone ? "09xxxxxxxx" : text.placeholder} />
              {editing && <Button className="mt-2 w-full" disabled={busy} onClick={() => void saveEdit(input)}><Check size={16} /> {text.saveEdit}</Button>}
              {editingPhone && <Button className="mt-2 w-full" disabled={busy} onClick={() => void savePhoneEdit(input)}><Check size={16} /> {text.saveEdit}</Button>}
            </div>
          )}
          <p className={`mt-2 text-center text-[11px] ${isDark ? "text-[#8F7783]" : "text-slate-400"}`}>{text.composerHint}</p>
        </div>
      </div>
    </main>
  );
}
