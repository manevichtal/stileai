# tests/test_downstream.py
import json
import sys

from interlock.downstream import Downstream

# Launch the sample server with THIS interpreter so it's found on any machine.
def _sample_cfg():
    target = json.dumps([sys.executable, "-m", "sample_tools.server"])
    return {"name": "sample", "transport": "stdio", "target": target, "auth": None}

async def test_downstream_lists_and_calls_sample_tools():
    d = Downstream(_sample_cfg())
    names = {t.name for t in await d.list_tools()}
    assert {"charge_card", "read_data"} <= names
    res = await d.call("read_data", {"query": "x"})
    assert res.content  # got a result back
    assert d.name == "sample"
