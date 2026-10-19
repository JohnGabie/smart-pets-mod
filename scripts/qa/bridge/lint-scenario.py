#!/usr/bin/env python3
"""Static checks for live-QA scenarios (python3 stdlib only).

usage: lint-scenario.py FILE [FILE...]     (*.groovy assertions, *.cmds vanilla command setup)
exit 0 = clean, 1 = errors found, 64 = usage. Prints one line per finding: path:line: LEVEL message.

.groovy rules: `// timeoutMs: N` header (1000..300000); no sleep/wait inside sync{}; no quit/leave/join/stop/
process/exit APIs; no library re-load (the runner loads it); no forced window focus; no raw tp/teleport through
spCommand (use spTeleportSetup, which logs SETUP_TELEPORT); must `return spReport()`.
.cmds rules: header `# scenario:` and `# purpose:`; `# needs:` values known; `# wait N ticks|ms` well formed;
no server-admin/destructive commands.
"""
import re
import sys

FORBIDDEN_GROOVY = [
    (r"\bmc_quit_client\b|\.quit\s*\(|\bmc\.stop\s*\(|\.destroy\s*\(", "quits/stops the client"),
    (r"\bleaveServer\b|\bmc_leave_server\b|\bjoinServer\b|\bmc_join_server\b", "leaves/joins a server"),
    (r"\.disconnect\s*\(|disconnectFromWorld|disconnectWithSavingScreen", "raw disconnect: use spCloseWorld()"),
    (r"\bRuntime\b|\bProcessBuilder\b|System\.exit|java\.net\.", "process/network/exit API"),
    (r"debugbridge\.json", "touches the DebugBridge security config"),
    (r"\bevaluate\s*\(|new\s+GroovyShell", "loads code: the runner loads sp-lib.groovy"),
    (r"window\.focused|fabric_focus|grabMouse\s*\(", "forces window focus/mouse grab (headless Xvfb only, not in scenarios)"),
    (r"pauseOnLostFocus\s*=\s*true", "re-enables the pause-on-lost-focus loop"),
    (r"deleteDir\s*\(|Files\.delete|\.delete\s*\(\s*\)", "deletes files"),
    (r"options\.save\s*\(", "persists the maintainer's options.txt"),
]
FORBIDDEN_CMDS = {"stop", "kick", "ban", "ban-ip", "pardon", "pardon-ip", "op", "deop", "whitelist", "publish",
                  "transfer", "save-off", "jfr", "perf", "debug", "reload"}
KNOWN_NEEDS = {"test-world", "in-world"}
SLEEPY = re.compile(r"Thread\.sleep|\bsleep\s*\(|spWait\w*\s*\(|spWalk\s*\(|spHold\s*\(|spBreak\s*\(|spOpenWorld|spCloseWorld|spCreateTestWorld|spEnsure\w*|spCommand|spTime|spGamemode|spSummon\w*|spRunCmds")


def strip_strings_comments(src):
    """Blank out string literals and comments, keeping offsets/newlines (good enough for scenario files)."""
    out, i, n = [], 0, len(src)
    while i < n:
        c = src[i]
        if src.startswith("//", i):
            j = src.find("\n", i)
            j = n if j < 0 else j
            out.append(" " * (j - i)); i = j
        elif src.startswith("/*", i):
            j = src.find("*/", i + 2); j = n if j < 0 else j + 2
            out.append(re.sub(r"[^\n]", " ", src[i:j])); i = j
        elif c in "'\"":
            q = src[i:i + 3] if src[i:i + 3] in ("'''", '"""') else c
            j = i + len(q)
            while j < n and not src.startswith(q, j):
                j += 2 if src[j] == "\\" else 1
            j = min(n, j + len(q))
            out.append(q + re.sub(r"[^\n]", " ", src[i + len(q):j - len(q)]) + q); i = j
        else:
            out.append(c); i += 1
    return "".join(out)


def sync_bodies(code):
    """Yield (start, end) offsets of every sync { ... } body."""
    for m in re.finditer(r"\bsync\s*\{", code):
        depth, j = 1, m.end()
        while j < len(code) and depth:
            depth += {"{": 1, "}": -1}.get(code[j], 0); j += 1
        yield m.end(), j - 1


def lint_groovy(path, src):
    errs = []
    line = lambda off: src.count("\n", 0, off) + 1
    m = re.search(r"^//\s*timeoutMs:\s*(\d+)", src, re.M)
    if not m:
        errs.append((1, "ERROR", "missing header `// timeoutMs: N`"))
    elif not 1000 <= int(m.group(1)) <= 300000:
        errs.append((line(m.start()), "ERROR", "timeoutMs must be 1000..300000"))
    code = strip_strings_comments(src)
    for a, b in sync_bodies(code):
        for s in SLEEPY.finditer(code, a, b):
            errs.append((line(s.start()), "ERROR", "`%s` inside sync{}: waits/commands must run outside sync (it blocks the game thread)" % s.group(0)))
    for rx, why in FORBIDDEN_GROOVY:
        for s in re.finditer(rx, code):
            errs.append((line(s.start()), "ERROR", "forbidden (%s): %s" % (why, s.group(0))))
    for s in re.finditer(r"spCommand\s*\(\s*['\"]/?(tp|teleport)\b", src):
        errs.append((line(s.start()), "ERROR", "teleport via spCommand: use spTeleportSetup (SETUP only)"))
    if not re.search(r"return\s+spReport\s*\(\s*\)\s*$", code.strip()):
        errs.append((line(len(src)), "ERROR", "must end with `return spReport()`"))
    return errs


def lint_cmds(path, src):
    errs, heads = [], {}
    for i, raw in enumerate(src.splitlines(), 1):
        l = raw.strip()
        if not l:
            continue
        if l.startswith("#"):
            m = re.match(r"#\s*(\w[\w-]*):\s*(.*)$", l)
            if m:
                heads[m.group(1)] = m.group(2)
                if m.group(1) == "needs":
                    bad = [x.strip() for x in m.group(2).split(",") if x.strip() and x.strip() not in KNOWN_NEEDS]
                    if bad:
                        errs.append((i, "ERROR", "unknown needs %s (known: %s)" % (bad, sorted(KNOWN_NEEDS))))
            elif re.match(r"#\s*wait\b", l) and not re.match(r"#\s*wait\s+\d+\s*(ticks?|ms)\s*$", l):
                errs.append((i, "ERROR", "bad wait directive (use `# wait N ticks` or `# wait N ms`)"))
            continue
        word = l.lstrip("/").split()[0].lower()
        if word in FORBIDDEN_CMDS:
            errs.append((i, "ERROR", "forbidden command `%s`" % word))
        if word in ("tp", "teleport"):
            errs.append((i, "INFO", "teleport is SETUP only (logged); never inside a 'no teleport' check"))
    for h in ("scenario", "purpose"):
        if h not in heads:
            errs.append((1, "ERROR", "missing header `# %s: ...`" % h))
    return errs


def main(argv):
    if not argv:
        print(__doc__.strip().splitlines()[2], file=sys.stderr)
        return 64
    bad = 0
    for p in argv:
        src = open(p, encoding="utf-8").read()
        if p.endswith(".groovy"):
            errs = lint_groovy(p, src)
        elif p.endswith(".cmds"):
            errs = lint_cmds(p, src)
        else:
            errs = [(1, "ERROR", "unknown scenario type (want .groovy or .cmds)")]
        for ln, lvl, msg in errs:
            print("%s:%d: %s %s" % (p, ln, lvl, msg))
        bad += sum(1 for e in errs if e[1] == "ERROR")
    if not bad:
        print("lint-scenario: clean (%d file(s))" % len(argv))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
