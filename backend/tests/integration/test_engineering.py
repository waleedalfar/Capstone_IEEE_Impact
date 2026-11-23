"""Engineering students of any discipline (D-08, D-55): a listed engineering career, and a career that isn't listed
("Other"), whose own profile skills are then tracked, tag moves and take evidence."""
import uuid

from app.policies import loader
from tests.integration.test_flow import evidence, make_wish, pick
from tests.integration.test_past_work import past_work


def eng_profile(handle: str, career: str | None = None, other: str | None = None, skills=("MATLAB", "Radiation Safety")) -> dict:
    return {"handle": handle, "displayName": handle.title(), "headline": "Nuclear engineering senior",
            "education": {"major": "Nuclear Engineering"}, "position": "Student", "targetCareerId": career,
            "targetCareerOther": other, "skills": list(skills), "interests": ["fusion"], "strengths": ["lab work"],
            "growthAreas": ["technical writing"], "featuredContributions": [], "completeOnboarding": True}


async def test_other_career_tracks_own_skills(api, users):
    a = await users.make("noor")
    h = f"noor_{uuid.uuid4().hex[:6]}"

    # Neither a listed career nor Other: onboarding asks for one.
    r = await api.put("/api/v1/profile", json=eng_profile(h), headers=a["h"])
    assert r.status_code == 400 and "target career" in r.json()["error"]

    r = await api.put("/api/v1/profile", json=eng_profile(h, other="  Nuclear Engineer "), headers=a["h"])
    assert r.status_code == 200, r.text
    p = r.json()["profile"]
    assert p["targetCareerId"] is None and p["targetCareerOther"] == "Nuclear Engineer" and p["schemaVersion"] == "0.2"

    g = (await api.get("/api/v1/growth", headers=a["h"])).json()["growth"]
    assert {s["skillId"] for s in g["skills"]} == {"matlab", "radiation_safety"}
    assert g["careerId"] is None and g["roleTier"] == "Not started"
    home = (await api.get("/api/v1/home", headers=a["h"])).json()
    assert home["profileCard"]["targetCareer"] == "Nuclear Engineer"

    # Moves are tagged with the student's own skills, and evidence is scored against them.
    wid = await make_wish(api, a, "Pass the FE exam")
    moves, sm = await pick(api, a, wid)
    assert all(m["skillId"] in {"matlab", "radiation_safety"} for m in moves)
    ev = await evidence(api, a, sm["selectedMoveId"], "Worked 40 FE practice problems in thermodynamics and logged my misses.")
    assert ev["status"] == "awaiting_review" and ev["skillId"] in {"matlab", "radiation_safety"}
    assert (await past_work(api, a, wid, "radiation_safety")).status_code == 202
    assert (await past_work(api, a, wid, "sql")).status_code == 400

    # Picking a listed career clears the typed one.
    r = await api.put("/api/v1/profile", json=eng_profile(h, career="mechanical_engineer", other="Nuclear Engineer"), headers=a["h"])
    assert r.status_code == 200 and r.json()["profile"]["targetCareerOther"] is None


async def test_other_career_off_requires_a_listed_one(api, users):
    a = await users.make("omar")
    h = f"omar_{uuid.uuid4().hex[:6]}"
    with loader.override(CAREER_OTHER=False):
        r = await api.put("/api/v1/profile", json=eng_profile(h, other="Nuclear Engineer"), headers=a["h"])
        assert r.status_code == 400 and "from the list" in r.json()["error"]
        r = await api.put("/api/v1/profile", json=eng_profile(h), headers=a["h"])
        assert r.status_code == 400 and r.json()["error"] == "Choose a target career."


async def test_listed_engineering_career(api, users):
    a = await users.make("mei")
    h = f"mei_{uuid.uuid4().hex[:6]}"
    r = await api.put("/api/v1/profile", json=eng_profile(h, career="mechanical_engineer"), headers=a["h"])
    assert r.status_code == 200, r.text
    mech = {"cad", "mechanics", "thermal", "manufacturing", "matlab"}
    g = (await api.get("/api/v1/growth", headers=a["h"])).json()["growth"]
    assert g["careerId"] == "mechanical_engineer" and {s["skillId"] for s in g["skills"]} == mech
    wid = await make_wish(api, a, "Get fluent in SolidWorks")
    moves, _ = await pick(api, a, wid)
    assert all(m["skillId"] in mech for m in moves)
