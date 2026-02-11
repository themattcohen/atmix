#!/usr/bin/env python3
"""
Baserow MCP Client - Creates fields via MCP protocol.
"""

import asyncio
import aiohttp
import json
import sys

BASE = "https://api.baserow.io"
MCP_TOKEN = "inxXZun40JoohcJyS8aokPqO2zI2YPP5"
MCP_SSE = f"{BASE}/mcp/{MCP_TOKEN}/sse"

async def mcp_session():
    """Run MCP session to create fields."""

    async with aiohttp.ClientSession() as session:
        print("=== Connecting to Baserow MCP ===")

        # Open SSE connection
        async with session.get(MCP_SSE, headers={"Accept": "text/event-stream"}) as sse:
            # Read endpoint event to get session ID
            session_id = None
            async for line in sse.content:
                line = line.decode('utf-8').strip()
                if "session_id=" in line:
                    data = line.split("data: ")[-1] if "data: " in line else line
                    session_id = data.split("session_id=")[1].strip()
                    break

            if not session_id:
                print("Failed to get session ID")
                return

            print(f"Session: {session_id}")
            msg_url = f"{BASE}/mcp/messages/?session_id={session_id}"

            # Initialize
            print("\n1. Initializing...")
            await session.post(msg_url, json={
                "jsonrpc": "2.0", "id": 1, "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "claude-code", "version": "1.0"}
                }
            })

            # Read init response
            async for line in sse.content:
                line = line.decode('utf-8').strip()
                if line.startswith("data: {"):
                    data = line[6:]
                    try:
                        msg = json.loads(data)
                        if msg.get("id") == 1:
                            print(f"   Server: {msg.get('result', {}).get('serverInfo', {}).get('name', 'unknown')}")
                            break
                    except:
                        pass

            # Send initialized notification
            await session.post(msg_url, json={
                "jsonrpc": "2.0", "method": "notifications/initialized"
            })
            await asyncio.sleep(0.3)

            # Get tools list
            print("\n2. Getting tools...")
            await session.post(msg_url, json={
                "jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}
            })

            tools = []
            async for line in sse.content:
                line = line.decode('utf-8').strip()
                if line.startswith("data: {"):
                    try:
                        msg = json.loads(line[6:])
                        if msg.get("id") == 2 and "result" in msg:
                            tools = msg["result"].get("tools", [])
                            break
                    except:
                        pass

            print(f"   Found {len(tools)} tools:")
            for t in tools:
                print(f"   - {t['name']}: {t.get('description', '')[:50]}")

            # Look for field creation tool
            create_field_tool = None
            for t in tools:
                if "field" in t["name"].lower() and "create" in t["name"].lower():
                    create_field_tool = t["name"]
                    print(f"\n   Found field creation tool: {create_field_tool}")
                    print(f"   Schema: {json.dumps(t.get('inputSchema', {}), indent=2)[:500]}")
                    break

            if not create_field_tool:
                print("\n   No field creation tool found. Available tools:")
                for t in tools:
                    print(f"   - {t['name']}")
                return

            # Create ghl_contact_id field
            print(f"\n3. Creating ghl_contact_id field...")
            await session.post(msg_url, json={
                "jsonrpc": "2.0", "id": 3, "method": "tools/call",
                "params": {
                    "name": create_field_tool,
                    "arguments": {
                        "table_id": 817355,
                        "name": "ghl_contact_id",
                        "type": "text"
                    }
                }
            })

            # Read response
            async for line in sse.content:
                line = line.decode('utf-8').strip()
                if line.startswith("data: {"):
                    try:
                        msg = json.loads(line[6:])
                        if msg.get("id") == 3:
                            print(f"   Result: {json.dumps(msg, indent=2)[:500]}")
                            break
                    except:
                        pass

            # Create ghl_opportunity_id field
            print(f"\n4. Creating ghl_opportunity_id field...")
            await session.post(msg_url, json={
                "jsonrpc": "2.0", "id": 4, "method": "tools/call",
                "params": {
                    "name": create_field_tool,
                    "arguments": {
                        "table_id": 817373,
                        "name": "ghl_opportunity_id",
                        "type": "text"
                    }
                }
            })

            async for line in sse.content:
                line = line.decode('utf-8').strip()
                if line.startswith("data: {"):
                    try:
                        msg = json.loads(line[6:])
                        if msg.get("id") == 4:
                            print(f"   Result: {json.dumps(msg, indent=2)[:500]}")
                            break
                    except:
                        pass

if __name__ == "__main__":
    asyncio.run(mcp_session())
