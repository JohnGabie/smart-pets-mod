#!/usr/bin/env python3
"""Standalone DebugBridge client (python3 stdlib only, no MCP, no `websockets` package).

Talks the DebugBridge wire protocol (one JSON object per WebSocket text frame,
{id, type, payload} -> {id, success, result, output, error}) over a minimal
RFC 6455 client written on plain sockets. Loopback only.

Usage:
  bridge.py status
  bridge.py wait [--timeout-s 120]             # block until a bridge answers
  bridge.py exec -f file.groovy [--lib] [--timeout ms]
  bridge.py exec -e 'return 1+1' [--lib] [--timeout ms]
  bridge.py snapshot
  bridge.py screenshot [--out file.jpg]
  bridge.py wait-in-world [--timeout-s 60]
  bridge.py check-report FILE --nonce N --scenario S   # validate an on-disk spReport file (no bridge needed)
  bridge.py raw <type> ['{json payload}']       # READ-ONLY allowlist only (see RAW_ALLOW)

--lib loads scripts/qa/bridge/sp-lib.groovy into the persistent binding first
(same call, via evaluate(new File(...)); verified allowed by the sandbox) and sets
SP_FAST / SP_ALLOW_ANY_WORLD from the environment (SP_FAST=1, SP_ALLOW_ANY_WORLD=1; default false).
exec code is checked by lint-scenario.py --snippet first (safety rules); --no-lint skips that
(only for code you have read; it is logged in the output).

Exit codes: 0 ok; 1 script result has ok:false; 2 bridge/script error;
3 no bridge reachable; 4 timeout; 5 gameDir mismatch; 64 usage error; 65 lint refused the code.
Output: one compact JSON object on stdout.
"""
import argparse
import base64
import json
import os
import socket
import struct
import sys
import time

sys.dont_write_bytecode = True  # importing lint-scenario.py must not leave __pycache__ in the repo
HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.join(HERE, "sp-lib.groovy")
REPO = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
PORTS = range(9876, 9887)
# read-only request types; everything that runs code or changes state goes through `exec` (linted)
RAW_ALLOW = {"status", "snapshot", "screenshot", "chatHistory", "screenInspect", "nearbyEntities", "nearbyBlocks",
             "entityDetails", "blockDetails", "search", "version", "info"}
GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"


class BridgeError(Exception):
    def __init__(self, msg, code=2):
        super().__init__(msg)
        self.code = code


class WS:
    """Minimal RFC 6455 client: text frames, masking, fragmentation, ping/pong, close."""

    def __init__(self, port, timeout=3.0):
        self.sock = socket.create_connection(("127.0.0.1", port), timeout=timeout)
        key = base64.b64encode(os.urandom(16)).decode()
        req = (
            "GET / HTTP/1.1\r\nHost: 127.0.0.1:%d\r\nUpgrade: websocket\r\n"
            "Connection: Upgrade\r\nSec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n"
        ) % (port, key)
        self.sock.sendall(req.encode())
        head = b""
        while b"\r\n\r\n" not in head:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise BridgeError("handshake: connection closed", 3)
            head += chunk
        head, self.buf = head.split(b"\r\n\r\n", 1)
        lines = head.decode("latin-1").split("\r\n")
        if " 101 " not in lines[0] + " ":
            raise BridgeError("handshake refused: " + lines[0], 3)
        import hashlib

        want = base64.b64encode(hashlib.sha1((key + GUID).encode()).digest()).decode()
        hdrs = {l.split(":", 1)[0].strip().lower(): l.split(":", 1)[1].strip() for l in lines[1:] if ":" in l}
        if hdrs.get("sec-websocket-accept") != want:
            raise BridgeError("handshake: bad Sec-WebSocket-Accept", 3)

    def _send_frame(self, opcode, data):
        hdr = bytes([0x80 | opcode])
        n = len(data)
        if n < 126:
            hdr += bytes([0x80 | n])
        elif n < 65536:
            hdr += bytes([0x80 | 126]) + struct.pack(">H", n)
        else:
            hdr += bytes([0x80 | 127]) + struct.pack(">Q", n)
        mask = os.urandom(4)
        body = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
        self.sock.sendall(hdr + mask + body)

    def send_text(self, text):
        self._send_frame(0x1, text.encode("utf-8"))

    def _read(self, n):
        while len(self.buf) < n:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise BridgeError("connection closed by bridge", 2)
            self.buf += chunk
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def recv_text(self):
        parts = []
        while True:
            b1, b2 = self._read(2)
            fin, opcode = b1 & 0x80, b1 & 0x0F
            if b1 & 0x70:
                raise BridgeError("protocol error: RSV bits set (no extensions negotiated)", 2)
            n = b2 & 0x7F
            if n == 126:
                n = struct.unpack(">H", self._read(2))[0]
            elif n == 127:
                n = struct.unpack(">Q", self._read(8))[0]
            mask = self._read(4) if b2 & 0x80 else None
            data = self._read(n)
            if mask:
                data = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
            if opcode == 0x9:  # ping
                self._send_frame(0xA, data)
                continue
            if opcode == 0xA:
                continue
            if opcode == 0x8:
                try:
                    self._send_frame(0x8, data[:2])  # echo the close code, per RFC 6455
                except OSError:
                    pass
                raise BridgeError("bridge closed the connection", 2)
            if opcode not in (0x0, 0x1, 0x2):
                raise BridgeError("protocol error: unknown opcode %d" % opcode, 2)
            parts.append(data)
            if fin:
                raw = b"".join(parts)
                try:
                    return raw.decode("utf-8")
                except UnicodeDecodeError:
                    return ""  # binary/non-UTF-8 payload: not a JSON reply, caller skips it

    def close(self):
        try:
            self._send_frame(0x8, struct.pack(">H", 1000))
        except OSError:
            pass
        self.sock.close()


class Bridge:
    def __init__(self, port=None):
        env = os.environ.get("DEBUGBRIDGE_PORT")
        ports = [port] if port else ([int(env)] if env else list(PORTS))
        last = None
        for p in ports:
            try:
                self.ws = WS(p)
                self.port = p
                break
            except (OSError, BridgeError) as e:
                last = e
        else:
            raise BridgeError("no DebugBridge on 127.0.0.1:%s (%s)" % (ports[0] if len(ports) == 1 else "9876-9886", last), 3)
        self.n = 0

    def request(self, type_, payload=None, timeout_s=15.0):
        self.n += 1
        rid = "sp_%d_%d" % (os.getpid(), self.n)
        self.ws.sock.settimeout(timeout_s)
        self.ws.send_text(json.dumps({"id": rid, "type": type_, "payload": payload or {}}))
        deadline = time.time() + timeout_s
        while True:
            if time.time() > deadline:
                raise BridgeError("%s timed out after %.0fs" % (type_, timeout_s), 4)
            try:
                raw = self.ws.recv_text()
            except socket.timeout:
                raise BridgeError("%s timed out after %.0fs" % (type_, timeout_s), 4)
            try:
                msg = json.loads(raw)
            except ValueError:
                continue
            if msg.get("id") != rid:
                continue  # late reply from an older request: drop
            if not msg.get("success"):
                raise BridgeError(msg.get("error") or "unknown bridge error", 2)
            return msg

    def close(self):
        self.ws.close()


WRAP_TYPES = {"table", "map", "object", "array", "list", "string", "number", "boolean", "nil"}


def is_wrapper(v):
    return isinstance(v, dict) and v.get("type") in WRAP_TYPES and set(v.keys()) <= {"type", "value"}


def unwrap(v):
    """Flatten bridge-typed results ({type: table|string|number|boolean|nil, value}). Children of a table/list are
    themselves wrappers, so a user map that happens to have keys type/value arrives wrapped and is kept intact.
    Untyped results (status, snapshot) are returned unchanged."""
    if not is_wrapper(v):
        return v
    t, val = v["type"], v.get("value")
    if t == "nil":
        return None
    if isinstance(val, dict):
        return {k: unwrap(x) for k, x in val.items()}
    if isinstance(val, list):
        return [unwrap(x) for x in val]
    return val


def lib_prelude():
    path = LIB.replace("\\", "/").replace("'", "\\'")
    flag = lambda k: "true" if os.environ.get(k) == "1" else "false"
    # explicit load argument; the library defaults both flags to false on every load and removes SP_LIB_ARGS
    return "SP_LIB_ARGS = [fast: %s, allowAnyWorld: %s]\nevaluate(new File('%s'))\n" % (flag("SP_FAST"), flag("SP_ALLOW_ANY_WORLD"), path)


def lint_snippet(code):
    """Run lint-scenario.py safety rules on exec code; returns a list of finding lines."""
    import importlib.util

    spec = importlib.util.spec_from_file_location("lint_scenario", os.path.join(HERE, "lint-scenario.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return ["%d: %s %s" % e for e in m.lint_snippet(code) if e[1] == "ERROR"]


def out(obj, code=0):
    print(json.dumps(obj, separators=(",", ":"), ensure_ascii=False))
    return code


def check_gamedir(info):
    gd = (info or {}).get("gameDir") or ""
    want = os.environ.get("SP_EXPECT_GAMEDIR", os.path.join(REPO, "mod", "run"))
    if want != "any" and os.path.realpath(gd) != os.path.realpath(want):
        raise BridgeError("gameDir mismatch: bridge reports %s, expected %s (dev instance only)" % (gd, want), 5)


def cmd_exec(b, a):
    if bool(a.file) == bool(a.expr):
        raise BridgeError("exec needs exactly one of -f FILE or -e CODE", 64)
    check_gamedir(unwrap(b.request("status").get("result")))
    code = open(a.file, encoding="utf-8").read() if a.file else a.expr
    if not a.no_lint:
        bad = lint_snippet(code)
        if bad:
            raise BridgeError("lint refused the code: " + " | ".join(bad), 65)
    flag = lambda k: "true" if os.environ.get(k) == "1" else "false"
    if a.lib:
        pre = lib_prelude()
    else:  # library already in the binding (or not): flags still come from THIS call's environment
        pre = "if (binding.hasVariable('spResetFlags')) { SP_FAST = %s; SP_ALLOW_ANY_WORLD = %s }\n" % (flag("SP_FAST"), flag("SP_ALLOW_ANY_WORLD"))
    # the code runs inside a closure so the flags are reset afterwards even on error/return; consequence: no
    # `import` lines in exec code (use fully-qualified names or java.type)
    code = (pre + "try { return ({ ->\n" + code + "\n}).call() } finally { if (binding.hasVariable('spResetFlags')) { spResetFlags()%s } }\n"
            % ("; spRestoreDisplay()" if os.environ.get("SP_FAST") == "1" else ""))
    t = max(1000, min(a.timeout, 300000))
    msg = b.request("execute", {"code": code, "timeoutMs": t}, timeout_s=t / 1000.0 + 5)
    res = unwrap(msg.get("result"))
    o = {"ok": True, "result": res}
    if a.no_lint:
        o["lint"] = "skipped (--no-lint)"
    if msg.get("output"):
        o["output"] = msg["output"]
    if isinstance(res, dict) and res.get("ok") is False:
        o["ok"] = False
        return out(o, 1)
    return out(o)


def main(argv=None):
    p = argparse.ArgumentParser(description="DebugBridge client (stdlib only)")
    p.add_argument("--port", type=int)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("status")
    w = sub.add_parser("wait")
    w.add_argument("--timeout-s", type=float, default=120)
    e = sub.add_parser("exec")
    e.add_argument("-f", "--file")
    e.add_argument("-e", "--expr")
    e.add_argument("--lib", action="store_true", help="load sp-lib.groovy first")
    e.add_argument("--timeout", type=int, default=10000, help="execute timeoutMs (1000..300000)")
    e.add_argument("--no-lint", action="store_true", help="skip the safety lint (only for code you have read)")
    sub.add_parser("snapshot")
    s = sub.add_parser("screenshot")
    s.add_argument("--out")
    ww = sub.add_parser("wait-in-world")
    ww.add_argument("--timeout-s", type=float, default=60)
    cr = sub.add_parser("check-report")
    cr.add_argument("file")
    cr.add_argument("--nonce", required=True)
    cr.add_argument("--scenario", required=True)
    r = sub.add_parser("raw")
    r.add_argument("type")
    r.add_argument("payload", nargs="?", default="{}")
    try:
        a = p.parse_args(argv)
    except SystemExit as ex:
        return 64 if ex.code else 0
    if a.cmd == "check-report":  # offline: the runner's recovery path after a dropped connection
        try:
            rep = json.load(open(a.file, encoding="utf-8"))
        except (OSError, ValueError) as ex:
            return out({"ok": False, "error": "unreadable report: %s" % ex, "exit": 2}, 2)
        if rep.get("nonce") != a.nonce or rep.get("scenario") != a.scenario:
            return out({"ok": False, "error": "report does not belong to this run (nonce/scenario mismatch)",
                        "got": {"nonce": rep.get("nonce"), "scenario": rep.get("scenario")}, "exit": 2}, 2)
        return out({"ok": bool(rep.get("ok")), "result": rep, "recovered": "from on-disk report after a dropped bridge connection"},
                   0 if rep.get("ok") else 1)
    try:
        if a.cmd == "wait":
            end = time.time() + a.timeout_s
            while True:
                try:
                    b = Bridge(a.port)
                    info = unwrap(b.request("status", timeout_s=5).get("result"))
                    b.close()
                    return out({"ok": True, "port": b.port, "gameDir": info.get("gameDir"), "version": info.get("version") or info.get("minecraftVersion")})
                except BridgeError as ex:
                    if time.time() > end:
                        raise BridgeError("bridge not up after %.0fs: %s" % (a.timeout_s, ex), 4)
                    time.sleep(1)
        b = Bridge(a.port)
        try:
            if a.cmd == "status":
                return out({"ok": True, "port": b.port, "result": unwrap(b.request("status").get("result"))})
            if a.cmd == "exec":
                return cmd_exec(b, a)
            if a.cmd == "snapshot":
                return out({"ok": True, "result": unwrap(b.request("snapshot").get("result"))})
            if a.cmd == "screenshot":
                res = unwrap(b.request("screenshot", timeout_s=20).get("result"))
                data = None
                if isinstance(res, dict):
                    for k in ("base64", "data", "image", "jpeg", "base64Jpeg"):
                        if isinstance(res.get(k), str):
                            data = res[k]
                            break
                if a.out and (data or (isinstance(res, dict) and res.get("path"))):
                    if data:  # older bridges: base64 JPEG inline
                        with open(a.out, "wb") as f:
                            f.write(base64.b64decode(data))
                    else:  # 2.1.0: JPEG written by the mod to a temp path on this machine
                        import shutil

                        shutil.copyfile(res["path"], a.out)
                    meta = {k: v for k, v in res.items() if not isinstance(v, str) or len(v) < 300}
                    return out({"ok": True, "out": a.out, "meta": meta})
                if isinstance(res, dict):
                    res = {k: (v if not isinstance(v, str) or len(v) < 300 else "<%d chars>" % len(v)) for k, v in res.items()}
                return out({"ok": True, "result": res})
            if a.cmd == "wait-in-world":
                end = time.time() + a.timeout_s
                while True:
                    snap = unwrap(b.request("snapshot", timeout_s=5).get("result")) or {}
                    if isinstance(snap, dict) and snap.get("player"):
                        pl = snap["player"]
                        return out({"ok": True, "player": {k: pl.get(k) for k in ("name", "x", "y", "z") if k in pl}})
                    if time.time() > end:
                        raise BridgeError("not in a world after %.0fs" % a.timeout_s, 4)
                    time.sleep(1)
            if a.cmd == "raw":
                if a.type not in RAW_ALLOW:
                    raise BridgeError("raw %s refused: only read-only types %s; run code with `exec` (linted)" % (a.type, sorted(RAW_ALLOW)), 64)
                msg = b.request(a.type, json.loads(a.payload), timeout_s=20)
                return out({"ok": True, "result": unwrap(msg.get("result"))})
        finally:
            b.close()
    except BridgeError as ex:
        return out({"ok": False, "error": str(ex), "exit": ex.code}, ex.code)
    except OSError as ex:
        return out({"ok": False, "error": "socket: %s" % ex, "exit": 3}, 3)


if __name__ == "__main__":
    sys.exit(main())
