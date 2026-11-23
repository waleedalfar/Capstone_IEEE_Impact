"""Module 4: people directory and connections (D-54). Signed-in users search each other by name or handle, open a
public profile, and connect. A public profile shows what the person has earned (Impact Score, tiers, badges, unlocks,
featured contributions), never their email, evidence or points ledger. PEOPLE_DIRECTORY=off turns all of it off."""
from sqlalchemy import and_, delete, func, or_, select, update

from ... import db, policies
from ...contracts import DomainEvent
from ...platform import bus
from .service import SocialError
from .tables import connections


def _profile():
    from ..profile import api
    return api


def _growth():
    from ..growth import api
    return api


def _require_on() -> None:
    if policies.get("PEOPLE_DIRECTORY") != "on":
        raise SocialError("The people directory is switched off.", 404)


def _pair(a: str, b: str):
    return or_(and_(connections.c.requester_id == a, connections.c.addressee_id == b),
               and_(connections.c.requester_id == b, connections.c.addressee_id == a))


def _status(row, me: str) -> str:
    """none | outgoing | incoming | connected, from me's side. A declined request isn't announced to the person who
    sent it: they keep seeing "requested" and can't ask again (as with buddy invites, D-33). The person who declined
    sees "none" and may still send their own request later."""
    if not row:
        return "none"
    if row.status == "accepted":
        return "connected"
    mine = str(row.requester_id) == me
    if row.status == "pending":
        return "outgoing" if mine else "incoming"
    return "outgoing" if mine else "none"


async def _rows_with(me: str, others: list[str]) -> dict[str, object]:
    if not others:
        return {}
    async with db.read() as c:
        rows = (await c.execute(select(connections).where(or_(
            and_(connections.c.requester_id == me, connections.c.addressee_id.in_(others)),
            and_(connections.c.addressee_id == me, connections.c.requester_id.in_(others)))))).all()
    return {str(r.addressee_id if str(r.requester_id) == me else r.requester_id): r for r in rows}


async def search(me: str, query: str) -> list[dict]:
    _require_on()
    found = await _profile().search_people(query, me)
    rows = await _rows_with(me, [p["userId"] for p in found])
    return [{"handle": p["handle"], "displayName": p["displayName"], "headline": p["headline"],
             "targetCareer": _growth().career_name(p["targetCareerId"]) or p.get("targetCareerOther"),
             "connection": _status(rows.get(p["userId"]), me)} for p in found]


async def _count(user_id: str) -> int:
    async with db.read() as c:
        return (await c.execute(select(func.count()).select_from(connections).where(
            connections.c.status == "accepted",
            or_(connections.c.requester_id == user_id, connections.c.addressee_id == user_id)))).scalar()


async def profile(me: str, handle: str) -> dict:
    _require_on()
    uid = await _profile().user_for_handle(handle)
    if not uid:
        raise SocialError("No one with that handle.", 404)
    state = await _profile().get_professional_state(uid)
    g = await _growth().get_growth_state(uid)
    row = (await _rows_with(me, [uid])).get(uid) if uid != me else None
    return {
        "handle": state.handle, "displayName": state.displayName or state.handle, "headline": state.headline, "bio": state.bio,
        "position": state.position, "education": {"institution": state.education.institution, "major": state.education.major,
                                                  "gradYear": state.education.gradYear},
        "targetCareer": _growth().career_name(state.targetCareerId) or state.targetCareerOther, "skills": state.skills, "interests": state.interests,
        "contributions": [{"title": c.title, "type": c.type, "description": c.description, "verified": c.verificationStatus == "verified"}
                          for c in state.featuredContributions],
        "growth": {
            "impact": g.totals.impact, "validated": g.totals.validated, "roleTier": g.roleTier,
            "skills": [{"skillId": s.skillId, "name": s.name, "core": s.core, "tier": s.tier, "points": s.points,
                        "nextTier": s.nextTier, "progress": s.progress} for s in g.skills],
            "badges": [b.model_dump() for b in g.badges],
            "unlocks": [{"opportunityId": u.opportunityId, "title": u.title, "tier": u.tier, "description": u.description}
                        for u in g.unlocks],
        },
        "connections": await _count(uid),
        "connection": "self" if uid == me else _status(row, me),
        "connectionId": str(row.id) if row else None,
    }


async def connect(me: str, handle: str) -> dict:
    _require_on()
    other = await _profile().user_for_handle(handle)
    if not other:
        raise SocialError("No one with that handle.", 404)
    if other == me:
        raise SocialError("You can't connect with yourself.")
    async with db.tx() as c:
        row = (await c.execute(select(connections).where(_pair(me, other)))).first()
        if row and row.status == "accepted":
            raise SocialError("You're already connected.", 409)
        if row and row.status == "pending" and str(row.requester_id) == me:
            raise SocialError("You already asked to connect.", 409)
        if row and row.status == "pending":
            # They already asked me: asking back is accepting.
            return await _set(c, row, "accepted", me)
        if row and row.status == "declined" and str(row.requester_id) == me:
            raise SocialError("You already asked to connect.", 409)
        if row:  # I declined them earlier and now ask them: the request turns around
            await c.execute(update(connections).where(connections.c.id == row.id).values(
                requester_id=me, addressee_id=other, status="pending", created_at=func.now(), responded_at=None))
            conn_id = str(row.id)
        else:
            conn_id = str((await c.execute(connections.insert().values(requester_id=me, addressee_id=other)
                                          .returning(connections.c.id))).scalar_one())
        cards = await _profile().handle_cards([me])
        bus.publish(DomainEvent(name="ConnectionRequested", userId=other, refs={
            "connectionId": conn_id, "requesterName": cards.get(me, {}).get("displayName", "Someone"),
            "handle": cards.get(me, {}).get("handle")}))
    return {"id": conn_id, "status": "pending"}


async def _set(c, row, status: str, me: str) -> dict:
    await c.execute(update(connections).where(connections.c.id == row.id).values(status=status, responded_at=func.now()))
    if status == "accepted":
        cards = await _profile().handle_cards([me])
        bus.publish(DomainEvent(name="ConnectionAccepted", userId=str(row.requester_id), refs={
            "connectionId": str(row.id), "addresseeName": cards.get(me, {}).get("displayName", "Someone"),
            "handle": cards.get(me, {}).get("handle")}))
    return {"id": str(row.id), "status": status}


async def respond(me: str, connection_id: str, action: str) -> dict:
    """accept / decline (the person asked), remove (either side: withdraw a request or end a connection)."""
    _require_on()
    async with db.tx() as c:
        row = (await c.execute(select(connections).where(connections.c.id == connection_id))).first()
        if not row or me not in (str(row.requester_id), str(row.addressee_id)):
            raise SocialError("Connection not found.", 404)
        if action in ("accept", "decline"):
            if str(row.addressee_id) != me or row.status != "pending":
                raise SocialError("There's no request to answer.", 409)
            return await _set(c, row, "accepted" if action == "accept" else "declined", me)
        if action == "remove":
            if row.status == "declined":   # kept so a declined request can't be withdrawn and sent again
                raise SocialError("Connection not found.", 404)
            await c.execute(delete(connections).where(connections.c.id == row.id))
            return {"id": connection_id, "status": "removed"}
    raise SocialError("Unknown action.")


async def list_connections(me: str) -> dict:
    """{connections, received, sent}, each item with the other person's card and the connection id."""
    _require_on()
    async with db.read() as c:
        rows = (await c.execute(select(connections).where(
            or_(connections.c.requester_id == me, connections.c.addressee_id == me)).order_by(connections.c.created_at.desc()))).all()
    others = {str(r.addressee_id if str(r.requester_id) == me else r.requester_id) for r in rows}
    cards = await _profile().handle_cards(list(others))
    out = {"connections": [], "received": [], "sent": []}
    for r in rows:
        if r.status == "declined":
            continue
        other = str(r.addressee_id if str(r.requester_id) == me else r.requester_id)
        item = {"id": str(r.id), "person": cards.get(other), "createdAt": r.created_at, "respondedAt": r.responded_at}
        st = _status(r, me)
        if st == "connected":
            out["connections"].append(item)
        elif st == "incoming":
            out["received"].append(item)
        elif st == "outgoing":
            out["sent"].append(item)
    return out
