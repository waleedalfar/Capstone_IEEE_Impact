"""Analytics event log (from the Wish Engine's /api/events). Batches come with the user's token; on page close
sendBeacon can't send a header, so the batch carries a signed 2-hour ticket instead (T-13)."""
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy.dialects.postgresql import insert

from ... import db
from ...config import config
from ..auth import AuthError, CurrentUser, User, bearer, verify
from ..http import err, ok, parse, read_json
from ..rate_limit import limited, rules
from ..security import client_ip, get_secret, make_token, verify_token
from .schema import EventBatch
from sqlalchemy import text

router = APIRouter(prefix="/api/v1")
TICKET_MS = 2 * 60 * 60 * 1000


@router.post("/events/ticket")
async def ticket(user: CurrentUser = User):
    return ok(ticket=make_token(await get_secret(), f"ev:{user.id}"), expiresInS=TICKET_MS // 1000)


async def _user(req: Request, batch: EventBatch) -> str | None:
    token = bearer(req)
    if token:
        try:
            return (await verify(token)).id
        except AuthError:
            return None
    if batch.ticket:
        payload = verify_token(await get_secret(), batch.ticket, TICKET_MS)
        if payload and payload.startswith("ev:"):
            return payload[3:]
    return None


@router.post("/events")
async def events(req: Request):
    if rl := limited((rules.events_ip, client_ip(req))):
        return rl

    data = await read_json(req, 65_536)
    if data is None:
        return err("invalid body")

    batch = parse(EventBatch, data)
    if isinstance(batch, JSONResponse):
        return batch

    user_id = await _user(req, batch)
    if not user_id:
        return err("unauthorized", 401)

    if rl := limited((rules.events_user, user_id)):
        return rl

    rows = []
    for event in batch.events:
        provider = event.payload.get("used_provider")
        row = {
            "user_id": user_id,
            "client_session_id": event.clientSessionId,
            "wish_id": event.wishId,
            "name": event.name,
            "step": event.step,
            "payload": event.payload,
            "app_version": config.app_version,
            "client_ts": event.clientTs,
            "provider": provider if isinstance(provider, str) else None,
        }
        if event.id:
            row["id"] = event.id
        rows.append(row)

    if rows:
        async with db.tx() as c:
            account_exists = await c.scalar(
                text("""
                    SELECT EXISTS (
                        SELECT 1
                        FROM auth.users
                        WHERE id = CAST(:user_id AS uuid)
                    )
                """),
                {"user_id": user_id},
            )
            if not account_exists:
                return JSONResponse(
                    status_code=401,
                    content={"code": "STALE_SESSION"},
                )

            for group in (
                [row for row in rows if "id" in row],
                [row for row in rows if "id" not in row],
            ):
                if group:
                    await c.execute(
                        insert(db.events).values(group).on_conflict_do_nothing()
                    )

    return ok()