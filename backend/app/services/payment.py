from app.core.errors import AppError
from app.models.enums import PaymentStatus, VerificationStatus


def ensure_contact_allowed(verification: VerificationStatus, payment: PaymentStatus) -> None:
    if verification != VerificationStatus.VERIFIED:
        raise AppError("MALE_NOT_VERIFIED", "يجب التحقق من الشاب قبل التواصل.", 409)
    if payment not in {PaymentStatus.PAID, PaymentStatus.WAIVED}:
        raise AppError("PAYMENT_REQUIRED", "يجب تسجيل الدفع أو الإعفاء قبل التواصل.", 409)


VALID_PAYMENT_TRANSITIONS = {
    PaymentStatus.PENDING: {PaymentStatus.PAID, PaymentStatus.WAIVED},
    PaymentStatus.PAID: {PaymentStatus.REFUNDED},
    PaymentStatus.WAIVED: set(),
    PaymentStatus.REFUNDED: set(),
}


def ensure_payment_transition(current: PaymentStatus, target: PaymentStatus) -> None:
    if target not in VALID_PAYMENT_TRANSITIONS[current]:
        raise AppError("INVALID_PAYMENT_STATE", "انتقال حالة الدفع غير مسموح.", 409)
