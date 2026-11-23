"""The only functions other modules may call in Module 3 (import-linter enforces this). Returns contracts."""
from ... import policies
from ...contracts import GrowthState, SocialEvidence
from ...policies.scoring.rules import TIER_ORDER
from . import catalog, service


def career_exists(career_id: str | None) -> bool:
    return catalog.career(career_id) is not None


def career_ids() -> list[str]:
    return catalog.career_ids()


def career_name(career_id: str | None) -> str | None:
    c = catalog.career(career_id)
    return c["name"] if c else None


async def get_growth_state(user_id: str) -> GrowthState:
    return await service.growth_state(user_id)


async def allowed_skills(user_id: str, career_id: str | None, profile_skills: list[str]) -> list[dict]:
    """Skills a move may be tagged with (D-08): the target career's list, or the user's own skills when freeform, or
    when their career isn't listed (D-55, CAREER_OTHER)."""
    from .scoring import slug

    if policies.get("SKILL_MODEL") == "taxonomy":
        c = catalog.career(career_id)
        if c:
            return [{"id": s["id"], "name": s["name"]} for s in c["skills"]]
        if not policies.get("CAREER_OTHER"):
            return []
    return [{"id": slug(s), "name": s} for s in own_skills(profile_skills)]


def own_skills(profile_skills: list[str]) -> list[str]:
    """The skills tracked when they come from the profile: the user's own, or "General" if they listed none."""
    return list(profile_skills) or ["General"]


async def recent_outcomes(user_id: str, wish_selected_move_ids: list[str]) -> list[dict]:
    """Outcomes of earlier moves of one wish, for the next move's prompt (D-07)."""
    state = await service.growth_state(user_id)
    return [o.model_dump() for o in state.recentOutcomes if o.selectedMoveId in wish_selected_move_ids]


async def apply_social_evidence(se: SocialEvidence) -> None:
    await service.apply_social_evidence(se)


async def award_reviewer_effort(reviewer_id: str, evidence_id: str) -> None:
    await service.award_reviewer_effort(reviewer_id, evidence_id)


async def reviewer_tier(reviewer_id: str, career_id: str | None) -> str:
    """D-14: a buddy's weight tier: their own role tier in the owner's career (floored at Proficient), Mentor if an
    admin marked them (open question Q1 default), or BUDDY_FIXED_TIER."""
    if await service.is_mentor(reviewer_id):
        return "Mentor"
    if policies.get("BUDDY_TIER_SOURCE") == "fixed":
        return policies.get("BUDDY_FIXED_TIER")
    state = await service.growth_state(reviewer_id)
    tier = state.roleTier if state.careerId == career_id else "Not started"
    return tier if tier in TIER_ORDER and TIER_ORDER.index(tier) >= 1 else "Proficient"


async def evidence_for_review(evidence_id: str) -> dict | None:
    return await service.get_evidence("", evidence_id, viewer_is_buddy=True)


async def evidence_owner(evidence_id: str) -> tuple[str, str | None] | None:
    """(owner user id, selected move id, or None for past-work evidence)."""
    return await service.owner_of(evidence_id)


async def evidence_file_url(evidence_id: str) -> str | None:
    return await service.file_url(evidence_id)


async def list_evidence(user_id: str, selected_move_id: str | None = None) -> list[dict]:
    return await service.list_evidence(user_id, selected_move_id)


async def get_own_evidence(user_id: str, evidence_id: str) -> dict | None:
    """One piece of evidence if user_id owns it (public shape, with selectedMoveId and wishId)."""
    return await service.get_evidence(user_id, evidence_id)


async def is_validated_evidence(user_id: str, evidence_id: str) -> bool:
    return await service.is_validated(user_id, evidence_id)
