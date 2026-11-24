"""Past-work evidence: logged against a wish while its move is locked in, scored by the rubric, earns effort within the
weekly cap, never moves the move's status, and can get its own reviewer."""
from app.platform import jobs
from tests.integration.test_mike_buddy import setup_three


async def past_work(api, u, wish_id, skill_id, summary="Built a churn model for a club last spring and wrote it up.", **extra):
    data = {"wishId": wish_id, "artifactType": "text", "summary": summary, "skillId": skill_id, "activityType": "create",
            "difficulty": "moderate", **extra}
    return await api.post("/api/v1/evidence", data=data, headers=u["h"])


async def test_past_work_evidence_and_reviewer(api, users):
    a, b, c, sm_id = await setup_three(api, users)
    sm = (await api.get(f"/api/v1/selected-moves/{sm_id}", headers=a["h"])).json()["selectedMove"]
    wish_id = sm["wishId"]
    skill = (await api.get("/api/v1/growth", headers=a["h"])).json()["growth"]["skills"][0]["skillId"]

    # Exactly one target; a skill the user tracks; someone else's wish is not found.
    both = await api.post("/api/v1/evidence", data={"wishId": wish_id, "selectedMoveId": sm_id, "artifactType": "text",
                                                    "summary": "x"}, headers=a["h"])
    assert both.status_code == 400
    assert (await past_work(api, a, wish_id, "not_a_real_skill")).status_code == 400
    assert (await past_work(api, c, wish_id, skill)).status_code == 404

    r = await past_work(api, a, wish_id, skill)
    assert r.status_code == 202, r.text
    await jobs.drain()
    ev = (await api.get(f"/api/v1/evidence/{r.json()['evidence']['id']}", headers=a["h"])).json()["evidence"]
    assert ev["selectedMoveId"] is None and ev["wishId"] == wish_id and ev["skillId"] == skill
    assert ev["aiScore"] is not None and ev["status"] == "awaiting_review"   # ai_then_buddy: graded, pending a reviewer

    # The locked move is untouched, so past work can't open the wish's next step.
    assert (await api.get(f"/api/v1/selected-moves/{sm_id}", headers=a["h"])).json()["selectedMove"]["status"] == "active"
    ledger = (await api.get("/api/v1/score-events", headers=a["h"])).json()["events"]
    assert any(e["kind"] == "effort" and e["reason"] == "past_work" and e["evidenceId"] == ev["id"] for e in ledger)

    # Filters: by wish, and past work only.
    listed = (await api.get(f"/api/v1/evidence?wishId={wish_id}&pastWork=true", headers=a["h"])).json()["evidence"]
    assert [e["id"] for e in listed] == [ev["id"]]

    # A reviewer invited onto the evidence itself confirms it, and the points become validated.
    inv = await api.post("/api/v1/invitations", json={"evidenceId": ev["id"], "buddy": b["handle"], "role": "reviewer"}, headers=a["h"])
    assert inv.status_code == 201, inv.text
    assert inv.json()["invitation"]["move"]["pastWork"] is True
    assert (await api.post("/api/v1/invitations", json={"evidenceId": ev["id"], "selectedMoveId": sm_id, "buddy": b["handle"],
                                                         "role": "reviewer"}, headers=a["h"])).status_code == 400
    assert (await api.get(f"/api/v1/evidence/{ev['id']}", headers=b["h"])).status_code == 404          # pending: no access
    iid = (await api.get("/api/v1/invitations?box=received", headers=b["h"])).json()["invitations"][0]["id"]
    assert (await api.post(f"/api/v1/invitations/{iid}/accept", headers=b["h"])).status_code == 200
    assert (await api.get(f"/api/v1/evidence/{ev['id']}", headers=b["h"])).json()["role"] == "buddy"
    assert (await api.get(f"/api/v1/evidence/{ev['id']}", headers=c["h"])).status_code == 404
    queue = (await api.get("/api/v1/reviews/queue", headers=b["h"])).json()["queue"]
    assert queue[0]["evidence"]["id"] == ev["id"] and queue[0]["needsFeedback"]

    fb = await api.post(f"/api/v1/invitations/{iid}/feedback", json={"evidenceId": ev["id"], "rating": 5, "confirms": True,
                                                                     "body": "Solid model, clear write-up."}, headers=b["h"])
    assert fb.status_code == 200, fb.text
    await jobs.drain()
    done = (await api.get(f"/api/v1/evidence/{ev['id']}", headers=a["h"])).json()["evidence"]
    assert done["status"] == "validated" and done["points"] and done["peerConfirmed"] is True
    on_ev = (await api.get(f"/api/v1/evidence/{ev['id']}/feedback", headers=a["h"])).json()
    assert on_ev["feedback"][0]["body"] == "Solid model, clear write-up." and on_ev["buddies"][0]["status"] == "accepted"
    assert (await api.get(f"/api/v1/evidence/{ev['id']}/feedback", headers=c["h"])).status_code == 404
    assert (await api.get(f"/api/v1/selected-moves/{sm_id}", headers=a["h"])).json()["selectedMove"]["status"] == "active"


async def test_move_evidence_cannot_take_an_evidence_invite(api, users):
    a, b, _, sm_id = await setup_three(api, users)
    r = await api.post("/api/v1/evidence", data={"selectedMoveId": sm_id, "artifactType": "text", "summary": "Did the move."},
                       headers=a["h"])
    await jobs.drain()
    inv = await api.post("/api/v1/invitations", json={"evidenceId": r.json()["evidence"]["id"], "buddy": b["handle"],
                                                       "role": "reviewer"}, headers=a["h"])
    assert inv.status_code == 409   # move evidence keeps using the move's buddy
