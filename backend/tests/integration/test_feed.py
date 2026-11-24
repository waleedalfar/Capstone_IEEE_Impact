"""Read notifications can be deleted one at a time, or every read one in the list the user is looking at."""
from app.contracts.events import DomainEvent
from app.platform.bus import publish_now


async def _seed(user_id: str) -> None:
    await publish_now(DomainEvent(name="ProfileUpdated", userId=user_id, refs={"completed": True}))
    await publish_now(DomainEvent(name="TierReached", userId=user_id, refs={"skillId": "sql", "skillName": "SQL", "tier": "Familiar"}))


def _by_kind(body: dict) -> dict:
    return {i["kind"]: i for i in body["items"]}


async def test_delete_read_notifications(api, users):
    a = await users.make("notes")
    b = await users.make("notes-other")
    await _seed(a["id"])
    await _seed(b["id"])

    items = _by_kind((await api.get("/api/v1/feed", headers=a["h"])).json())
    profile, tier = items["profile_completed"], items["tier_reached"]

    unknown = await api.post("/api/v1/feed/delete-read?chip=Nope", headers=a["h"])
    assert unknown.status_code == 200 and unknown.json()["deleted"] == 0

    unread = await api.post(f"/api/v1/feed/{profile['id']}/delete", headers=a["h"])
    assert unread.status_code == 409
    assert (await api.post(f"/api/v1/feed/{profile['id']}/delete", headers=b["h"])).status_code == 404
    assert (await api.post("/api/v1/feed/not-a-uuid/delete", headers=a["h"])).status_code == 404

    assert (await api.post(f"/api/v1/feed/{profile['id']}/read", json={"read": True}, headers=a["h"])).status_code == 200
    # The search matches the still-unread tier, so nothing is removed.
    missed = await api.post("/api/v1/feed/delete-read?q=SQL", headers=a["h"])
    assert missed.status_code == 200 and missed.json()["deleted"] == 0
    # People is Social and Pro: only the read profile notification goes.
    cleared = await api.post("/api/v1/feed/delete-read?chip=People", headers=a["h"])
    assert cleared.json()["deleted"] == 1
    left = _by_kind((await api.get("/api/v1/feed", headers=a["h"])).json())
    assert set(left) == {"tier_reached"}
    assert set(_by_kind((await api.get("/api/v1/feed", headers=b["h"])).json())) == {"profile_completed", "tier_reached"}

    assert (await api.post(f"/api/v1/feed/{tier['id']}/read", json={"read": True}, headers=a["h"])).status_code == 200
    assert (await api.post(f"/api/v1/feed/{tier['id']}/delete", headers=a["h"])).status_code == 200
    assert (await api.get("/api/v1/feed", headers=a["h"])).json()["items"] == []
    assert (await api.post(f"/api/v1/feed/{tier['id']}/delete", headers=a["h"])).status_code == 404
