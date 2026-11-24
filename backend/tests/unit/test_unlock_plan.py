"""How-to-unlock plans for locked opportunities (growth/scoring.unlock_plan)."""
from app.modules.growth.scoring import SkillFacts, unlock_plan
from app.policies.scoring.rules import ScoringRules


def test_picks_the_skill_closest_to_the_tier_and_lists_its_gates():
    rules = ScoringRules(version="test")
    sql = ({"skillId": "sql", "name": "SQL", "tier": "Familiar"}, SkillFacts(points=60, validated_items=1), 60.0)
    py = ({"skillId": "python", "name": "Python", "tier": "Not started"}, SkillFacts(points=80), 80.0)
    plan = unlock_plan("Proficient", [py, sql], rules, "admin_endorsement")
    assert plan["skillId"] == "sql" and plan["currentTier"] == "Familiar"   # higher tier wins over more points
    pts, items = plan["steps"][:2]
    assert pts["action"] == "earn_points" and pts["current"] == 60 and pts["target"] == 100 and not pts["met"]
    assert items["action"] == "validate_items" and items["current"] == 1 and items["target"] == rules.proficient_min_items


def test_no_skills_yet():
    plan = unlock_plan("Familiar", [], ScoringRules(version="test"), "admin_endorsement")
    assert plan["skillId"] is None and plan["steps"][0]["rule"] == "reach Familiar in any skill"
