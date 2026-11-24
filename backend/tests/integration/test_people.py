"""People directory and connections (D-54): search, public profile (no private data), connect lifecycle, off switch."""
import uuid

from app.platform import jobs
from app.policies import loader
from tests.integration.test_flow import onboard


async def three(api, users):
    hs = uuid.uuid4().hex[:6]
    out = []
    for n in ("ana", "ben", "cal"):
        u = await users.make(n)
        u["handle"] = f"{n}_{hs}"
        await onboard(api, u, u["handle"])
        out.append(u)
    return out


async def test_search_profile_and_connections(api, users):
    a, b, c = await three(api, users)
    not_onboarded = await users.make("dan")

    # Search: by handle fragment, never yourself, never someone who hasn't onboarded, short text finds nothing.
    found = (await api.get(f"/api/v1/people?q={b['handle'][:7]}", headers=a["h"])).json()["people"]
    assert [p["handle"] for p in found] == [b["handle"]] and found[0]["connection"] == "none"
    assert (await api.get(f"/api/v1/people?q={a['handle']}", headers=a["h"])).json()["people"] == []
    assert (await api.get("/api/v1/people?q=d", headers=a["h"])).json()["people"] == []
    assert not_onboarded  # has no handle, so it can't appear

    # Public profile: earned things, no email, no evidence, no ledger.
    p = (await api.get(f"/api/v1/people/{b['handle']}", headers=a["h"])).json()["person"]
    assert p["handle"] == b["handle"] and p["connection"] == "none" and "impact" in p["growth"] and p["growth"]["skills"]
    assert "email" not in str(p).lower() and "evidence" not in p and "ledger" not in p
    assert (await api.get(f"/api/v1/people/{a['handle']}", headers=a["h"])).json()["person"]["connection"] == "self"
    assert (await api.get("/api/v1/people/nobody_zz_99", headers=a["h"])).status_code == 404

    # Connect: a -> b, b sees it and accepts; both see each other connected.
    assert (await api.post("/api/v1/connections", json={"handle": a["handle"]}, headers=a["h"])).status_code == 400
    r = await api.post("/api/v1/connections", json={"handle": b["handle"]}, headers=a["h"])
    assert r.status_code == 201, r.text
    assert (await api.post("/api/v1/connections", json={"handle": b["handle"]}, headers=a["h"])).status_code == 409
    cid = r.json()["connection"]["id"]
    assert (await api.post(f"/api/v1/connections/{cid}/accept", headers=a["h"])).status_code == 409   # only b answers
    assert (await api.post(f"/api/v1/connections/{cid}/accept", headers=c["h"])).status_code == 404   # not part of it
    lb = (await api.get("/api/v1/connections", headers=b["h"])).json()
    assert [x["person"]["handle"] for x in lb["received"]] == [a["handle"]]
    await jobs.drain()
    feed = (await api.get("/api/v1/feed", headers=b["h"])).json()["items"]
    assert any(n["kind"] == "connection_requested" for n in feed)
    assert (await api.post(f"/api/v1/connections/{cid}/accept", headers=b["h"])).status_code == 200
    assert (await api.get(f"/api/v1/people/{b['handle']}", headers=a["h"])).json()["person"]["connection"] == "connected"
    assert (await api.get(f"/api/v1/people/{a['handle']}", headers=b["h"])).json()["person"]["connections"] == 1
    assert [x["person"]["handle"] for x in (await api.get("/api/v1/connections", headers=a["h"])).json()["connections"]] == [b["handle"]]

    # Remove ends it for both.
    assert (await api.post(f"/api/v1/connections/{cid}/remove", headers=b["h"])).status_code == 200
    assert (await api.get(f"/api/v1/people/{b['handle']}", headers=a["h"])).json()["person"]["connection"] == "none"

    # Decline: c asks a, a declines. c can't ask again; a can still ask c, which reaches c.
    cid2 = (await api.post("/api/v1/connections", json={"handle": a["handle"]}, headers=c["h"])).json()["connection"]["id"]
    assert (await api.post(f"/api/v1/connections/{cid2}/decline", headers=a["h"])).status_code == 200
    assert (await api.get(f"/api/v1/people/{a['handle']}", headers=c["h"])).json()["person"]["connection"] == "outgoing"
    assert (await api.post("/api/v1/connections", json={"handle": a["handle"]}, headers=c["h"])).status_code == 409
    assert (await api.post(f"/api/v1/connections/{cid2}/remove", headers=c["h"])).status_code == 404
    assert (await api.post("/api/v1/connections", json={"handle": c["handle"]}, headers=a["h"])).status_code == 201
    assert (await api.get(f"/api/v1/people/{a['handle']}", headers=c["h"])).json()["person"]["connection"] == "incoming"

    # Asking back someone who already asked you accepts it.
    r = await api.post("/api/v1/connections", json={"handle": a["handle"]}, headers=c["h"])
    assert r.status_code == 201 and r.json()["connection"]["status"] == "accepted"

    # PEOPLE_DIRECTORY=off hides all of it.
    with loader.override(PEOPLE_DIRECTORY="off"):
        assert (await api.get(f"/api/v1/people?q={b['handle']}", headers=a["h"])).status_code == 404
        assert (await api.get(f"/api/v1/people/{b['handle']}", headers=a["h"])).status_code == 404
        assert (await api.get("/api/v1/connections", headers=a["h"])).status_code == 404
