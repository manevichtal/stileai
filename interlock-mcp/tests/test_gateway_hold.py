# tests/test_gateway_hold.py — uses a fake sink; tests only the pure wait_for_approval helper
import asyncio

import pytest

from interlock.gateway import wait_for_approval  # pure helper we add


class FakeSink:
    def __init__(self):
        self.status = "pending"

    def get_pending(self, did):
        class P:  # minimal
            status = self.status

        return P()


@pytest.mark.asyncio
async def test_wait_returns_when_approved():
    sink = FakeSink()

    async def approve_soon():
        await asyncio.sleep(0.05)
        sink.status = "approved"

    asyncio.create_task(approve_soon())
    result = await wait_for_approval(sink, "d1", poll=0.01, timeout=2)
    assert result == "approved"


@pytest.mark.asyncio
async def test_wait_times_out_to_denied():
    sink = FakeSink()
    result = await wait_for_approval(sink, "d1", poll=0.01, timeout=0.05)
    assert result == "denied"  # fail-safe
