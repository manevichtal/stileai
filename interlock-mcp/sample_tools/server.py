# sample_tools/server.py
"""Demo downstream MCP server with realistic risky tools. NOT real side effects."""
import json
from mcp.server.fastmcp import FastMCP

def _read_data(query: str = "") -> str:
    return json.dumps({"performed": True, "rows": [{"id": 1}, {"id": 2}], "query": query})

def _send_email(to: str, subject: str = "", body: str = "") -> str:
    return json.dumps({"performed": True, "detail": f"(demo) email to {to}"})

def _charge_card(customer: str, amount: float) -> str:
    return json.dumps({"performed": True, "customer": customer, "amount": amount,
                       "detail": "(demo) card charged"})

def _delete_records(table: str, where: str = "") -> str:
    return json.dumps({"performed": True, "detail": f"(demo) deleted from {table} where {where}"})

TOOLS = {"read_data": _read_data, "send_email": _send_email,
         "charge_card": _charge_card, "delete_records": _delete_records}

mcp = FastMCP("sample-tools")
mcp.tool(name="read_data")(_read_data)
mcp.tool(name="send_email")(_send_email)
mcp.tool(name="charge_card")(_charge_card)
mcp.tool(name="delete_records")(_delete_records)

def main() -> None:
    mcp.run()  # stdio

if __name__ == "__main__":
    main()
