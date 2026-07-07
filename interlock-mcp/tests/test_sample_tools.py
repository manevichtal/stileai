# tests/test_sample_tools.py
import json
from sample_tools.server import TOOLS  # dict name -> callable

def test_charge_card_returns_receipt():
    out = json.loads(TOOLS["charge_card"](customer="c1", amount=4200))
    assert out["performed"] is True and out["amount"] == 4200
