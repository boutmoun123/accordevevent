from app.core.errors import AppError
from app.models.enums import MatchCaseStatus

ALLOWED_TRANSITIONS: dict[MatchCaseStatus, set[MatchCaseStatus]] = {
    MatchCaseStatus.CANDIDATE_SELECTED: {
        MatchCaseStatus.MALE_VERIFICATION,
        MatchCaseStatus.REJECTED,
        MatchCaseStatus.CLOSED,
    },
    MatchCaseStatus.MALE_VERIFICATION: {MatchCaseStatus.PAYMENT_PENDING, MatchCaseStatus.REJECTED},
    MatchCaseStatus.PAYMENT_PENDING: {
        MatchCaseStatus.READY_TO_CONTACT_FEMALE,
        MatchCaseStatus.CLOSED,
    },
    MatchCaseStatus.READY_TO_CONTACT_FEMALE: {MatchCaseStatus.WAITING_FEMALE},
    MatchCaseStatus.WAITING_FEMALE: {MatchCaseStatus.FEMALE_ACCEPTED, MatchCaseStatus.REJECTED},
    MatchCaseStatus.FEMALE_ACCEPTED: {MatchCaseStatus.WAITING_MALE},
    MatchCaseStatus.WAITING_MALE: {MatchCaseStatus.MUTUAL_ACCEPTANCE, MatchCaseStatus.REJECTED},
    MatchCaseStatus.MUTUAL_ACCEPTANCE: {MatchCaseStatus.MEETING_SCHEDULED, MatchCaseStatus.CLOSED},
    MatchCaseStatus.MEETING_SCHEDULED: {MatchCaseStatus.MEETING_COMPLETED, MatchCaseStatus.CLOSED},
    MatchCaseStatus.MEETING_COMPLETED: {MatchCaseStatus.FOLLOW_UP, MatchCaseStatus.CLOSED},
    MatchCaseStatus.FOLLOW_UP: {
        MatchCaseStatus.SERIOUS_CONTACT,
        MatchCaseStatus.MEETING_SCHEDULED,
        MatchCaseStatus.CLOSED,
    },
    MatchCaseStatus.SERIOUS_CONTACT: {MatchCaseStatus.ENGAGED, MatchCaseStatus.CLOSED},
    MatchCaseStatus.ENGAGED: {MatchCaseStatus.MARRIED, MatchCaseStatus.CLOSED},
    MatchCaseStatus.MARRIED: set(),
    MatchCaseStatus.REJECTED: set(),
    MatchCaseStatus.CLOSED: set(),
}


def ensure_transition(current: MatchCaseStatus, target: MatchCaseStatus) -> None:
    if target not in ALLOWED_TRANSITIONS[current]:
        raise AppError(
            "INVALID_STATE_TRANSITION",
            f"لا يمكن الانتقال من {current.value} إلى {target.value}.",
            409,
        )
