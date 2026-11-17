"""Buddy routes (docs/API.md, Module 4)."""
import re

from fastapi import APIRouter, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ...platform.auth import CurrentUser, User
from ...platform.http import UUID_RE, err, ok, parse, read_json
from ...platform.rate_limit import limited, rules
from ...platform.security import client_ip
from . import people, service

router = APIRouter(prefix="/api/v1")


def _e(e: service.SocialError):
    return err(str(e), e.status)


@router.get("/users/lookup")
async def lookup(req: Request, handle: str | None = None, email: str | None = None, user: CurrentUser = User):
    if rl := limited((rules.lookup_ip, client_ip(req)), (rules.lookup_user, user.id)):
        return rl
    if not handle and not email:
        return err("Send a handle or an email.")
    return ok(users=await service.lookup(user.id, handle, email))


class InviteBody(BaseModel):
    """Invite onto a selected move, or onto one piece of past-work evidence (exactly one of the two)."""
    selectedMoveId: str | None = Field(default=None, pattern=UUID_RE)
    evidenceId: str | None = Field(default=None, pattern=UUID_RE)
    buddy: str = Field(min_length=3, max_length=254)
    role: str = Field(pattern=r"^(reviewer|tester)$")
    message: str | None = Field(default=None, max_length=500)


@router.post("/invitations")
async def invite(req: Request, user: CurrentUser = User):
    if rl := limited((rules.write_ip, client_ip(req))):
        return rl
    p = parse(InviteBody, await read_json(req, 4096))
    if isinstance(p, JSONResponse):
        return p
    if bool(p.selectedMoveId) == bool(p.evidenceId):
        return err("Send selectedMoveId or evidenceId.")
    try:
        inv = await service.invite(user.id, p.selectedMoveId, p.buddy, p.role, p.message, evidence_id=p.evidenceId)
    except service.SocialError as e:
        return _e(e)
    return JSONResponse(ok(invitation=jsonable_encoder(inv)), status_code=201)


@router.get("/invitations")
async def list_invitations(box: str = "received", user: CurrentUser = User):
    if box not in ("received", "sent"):
        return err("box must be received or sent")
    return ok(invitations=jsonable_encoder(await service.list_invitations(user.id, box)))


@router.post("/invitations/{inv_id}/{action}")
async def respond(inv_id: str, action: str, req: Request, user: CurrentUser = User):
    if action == "feedback":
        return await _feedback(inv_id, req, user)
    if action not in ("accept", "decline", "revoke"):
        return err("not found", 404)
    try:
        return ok(**await service.respond(user.id, inv_id, action))
    except service.SocialError as e:
        return _e(e)


class FeedbackBody(BaseModel):
    evidenceId: str | None = Field(default=None, pattern=UUID_RE)
    rating: int | None = Field(default=None, ge=1, le=5)
    confirms: bool | None = None
    body: str = Field(default="", max_length=1000)


async def _feedback(inv_id: str, req: Request, user: CurrentUser):
    p = parse(FeedbackBody, await read_json(req, 4096))
    if isinstance(p, JSONResponse):
        return p
    try:
        return ok(**await service.submit_feedback(user.id, inv_id, p.evidenceId, p.rating, p.confirms, p.body))
    except service.SocialError as e:
        return _e(e)


@router.get("/reviews/queue")
async def queue(user: CurrentUser = User):
    return ok(queue=jsonable_encoder(await service.review_queue(user.id)))


@router.get("/evidence/{evidence_id}/feedback")
async def evidence_feedback(evidence_id: str, user: CurrentUser = User):
    if not re.fullmatch(UUID_RE, evidence_id):
        return err("not found", 404)
    try:
        return ok(**jsonable_encoder(await service.feedback_for_evidence(user.id, evidence_id)))
    except service.SocialError as e:
        return _e(e)


@router.get("/selected-moves/{sm_id}/feedback")
async def move_feedback(sm_id: str, user: CurrentUser = User):
    try:
        return ok(**jsonable_encoder(await service.feedback_for_move(user.id, sm_id)))
    except service.SocialError as e:
        return _e(e)


# ---- People directory and connections (D-54) ----------------------------------------------------------------------
@router.get("/people")
async def search_people(req: Request, q: str = "", user: CurrentUser = User):
    if rl := limited((rules.lookup_ip, client_ip(req)), (rules.lookup_user, user.id)):
        return rl
    if len(q) > 80:
        return err("Search text is too long.")
    try:
        return ok(people=await people.search(user.id, q))
    except service.SocialError as e:
        return _e(e)


@router.get("/people/{handle}")
async def person(handle: str, user: CurrentUser = User):
    if not re.fullmatch(r"@?[A-Za-z0-9_]{3,24}", handle):
        return err("No one with that handle.", 404)
    try:
        return ok(person=jsonable_encoder(await people.profile(user.id, handle)))
    except service.SocialError as e:
        return _e(e)


class ConnectBody(BaseModel):
    handle: str = Field(pattern=r"^@?[A-Za-z0-9_]{3,24}$")


@router.get("/connections")
async def list_connections(user: CurrentUser = User):
    try:
        return ok(**jsonable_encoder(await people.list_connections(user.id)))
    except service.SocialError as e:
        return _e(e)


@router.post("/connections")
async def connect(req: Request, user: CurrentUser = User):
    if rl := limited((rules.write_ip, client_ip(req))):
        return rl
    p = parse(ConnectBody, await read_json(req, 1024))
    if isinstance(p, JSONResponse):
        return p
    try:
        return JSONResponse(ok(connection=await people.connect(user.id, p.handle)), status_code=201)
    except service.SocialError as e:
        return _e(e)


@router.post("/connections/{conn_id}/{action}")
async def respond_connection(conn_id: str, action: str, user: CurrentUser = User):
    if action not in ("accept", "decline", "remove") or not re.fullmatch(UUID_RE, conn_id):
        return err("not found", 404)
    try:
        return ok(connection=await people.respond(user.id, conn_id, action))
    except service.SocialError as e:
        return _e(e)
