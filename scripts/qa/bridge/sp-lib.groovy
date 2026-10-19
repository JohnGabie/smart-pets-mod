// sp-lib.groovy - Smart Pets live-QA helper library for DebugBridge (Groovy 5, MC 26.2, Mojang names).
//
// Load once per client session into the persistent binding (closures survive across mc_execute calls):
//   evaluate(new File('<repo>/scripts/qa/bridge/sp-lib.groovy'))
// `bridge.py exec --lib` does this for you. Re-loading is safe: closures are redefined, run state is kept.
//
// Rules: game-thread work runs inside sync{}; waits/sleeps run OUTSIDE sync{}; helpers take and return
// small maps; every helper appends one JSONL line to <gameDir>/qa-runs/<runId>.jsonl.
// Status of every helper (VERIFIED/UNVERIFIED/FAILED, with evidence): scripts/qa/bridge/README.md.

spLibVersion = '1'

// ---------- run state, log, report ----------
if (!binding.hasVariable('spState') || spState == null) {
  spState = [runId: null, steps: [], setup: [], arena: null, t0: System.currentTimeMillis()]
}

spStamp = { -> java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern('yyyyMMdd-HHmmss')) }  // Groovy 5: no Date.format

spBegin = { String name = 'run' ->
  def ts = spStamp()
  spState = [runId: "${ts}-${name}".toString(), steps: [], setup: [], arena: spState?.arena, prevVsync: spState?.prevVsync, t0: System.currentTimeMillis()]
  def dir = new File('qa-runs'); dir.mkdirs()
  spLog('begin', [name: name, display: spFast()])
  return [runId: spState.runId, log: new File(dir, spState.runId + '.jsonl').canonicalPath]
}

spPlain = { v ->  // make any value JSON-safe (strings for unknown objects)
  if (v == null || v instanceof Number || v instanceof Boolean || v instanceof String) return v
  if (v instanceof Map) return v.collectEntries { k, x -> [(k.toString()): spPlain(x)] }
  if (v instanceof Collection || v.getClass().isArray()) return v.collect { spPlain(it) }
  return v.toString()
}

spJson = { v ->  // tiny JSON encoder (groovy-json is not on the bridge classpath)
  if (v == null) return 'null'
  if (v instanceof Boolean) return v.toString()
  if (v instanceof Number) { double d = v as double; return (Double.isNaN(d) || Double.isInfinite(d)) ? 'null' : v.toString() }
  if (v instanceof Map) return '{' + v.collect { k, x -> spJson(k.toString()) + ':' + spJson(x) }.join(',') + '}'
  if (v instanceof Collection) return '[' + v.collect { spJson(it) }.join(',') + ']'
  def s = v.toString(); def b = new StringBuilder('"')
  for (char ch : s.toCharArray()) {
    if (ch == '"' as char || ch == '\\' as char) b.append('\\').append(ch)
    else if (ch < (' ' as char)) b.append(String.format('\\u%04x', (int) ch))
    else b.append(ch)
  }
  return b.append('"').toString()
}

spLog = { String event, Map data = [:] ->
  if (spState.runId == null) { spState.runId = spStamp() + '-adhoc' }
  def line = spJson(spPlain([t: System.currentTimeMillis(), run: spState.runId, event: event] + data))
  def dir = new File('qa-runs'); dir.mkdirs()
  new File(dir, spState.runId + '.jsonl') << (line + '\n')
  return data
}

spExpect = { String name, cond, Map data = [:] ->
  boolean ok
  def err = null
  try { ok = (cond instanceof Closure) ? (cond() as boolean) : (cond as boolean) } catch (Throwable e) { ok = false; err = e.toString().take(200) }
  def step = [name: name, ok: ok, data: spPlain(err ? data + [error: err] : data)]
  spState.steps << step
  spLog('expect', step)
  return step
}

spStep = { String name, Closure body ->  // run a step; exceptions become a failed step instead of aborting the scenario
  try { def d = body(); return spExpect(name, d instanceof Map ? (d.ok != false) : true, d instanceof Map ? d : [value: d]) }
  catch (Throwable e) { return spExpect(name, false, [error: e.toString().take(300)]) }
}

spReport = { ->
  def r = [ok: !spState.steps.isEmpty() && spState.steps.every { it.ok }, runId: spState.runId,
           ms: System.currentTimeMillis() - spState.t0, setup: spState.setup, steps: spState.steps]
  spLog('report', [ok: r.ok, n: r.steps.size()])
  return spPlain(r)
}

// ---------- reading state ----------
spT = { String name -> java.type(name) }
// Bridge values are wrappers (GroovyJavaObject). Code that runs OUTSIDE bridge dispatch (a Function called back by
// Minecraft) gets raw objects and must be given raw arguments and return raw results: unwrap with spRaw.
spRaw = { o -> (o != null && o.respondsTo('getTarget')) ? o.getTarget() : o }
spScreen = { -> def s = mc.gui.screen(); s == null ? null : java.typeName(s).tokenize('.').last() }  // call inside sync{} or alone

spWorldId = { ->  // folder name of the open singleplayer world, or null
  def srv = mc.getSingleplayerServer()
  if (srv == null) return null
  try { return srv.storageSource.getLevelId() } catch (Throwable e) { return srv.getWorldData().getLevelName() }
}

spInfo = { ->
  def r = sync {
    def p = mc.player
    [screen: spScreen(), inWorld: (mc.level != null && p != null), world: spWorldId(),
     pos: p == null ? null : [x: p.getX(), y: p.getY(), z: p.getZ()],
     yaw: p?.getYRot(), pitch: p?.getXRot(), gamemode: mc.gameMode?.getPlayerMode()?.toString(),
     health: p?.getHealth(), focused: mc.isWindowActive(), grabbed: mc.mouseHandler.isMouseGrabbed(),
     paused: mc.isPaused(), pauseOnLostFocus: mc.options.pauseOnLostFocus,
     gameTime: mc.level?.getGameTime(), clock: mc.level?.getOverworldClockTime()]  // 26.2: no getDayTime(); overworld clock ticks
  }
  spLog('info', r)
  return r
}

// ---------- waiting ----------
spWaitUntil = { Closure cond, long timeoutMs = 5000, long pollMs = 100 ->
  long t0 = System.currentTimeMillis()
  while (true) {
    def v = null
    try { v = sync { mc.getFramerateLimitTracker().onInputReceived(); cond() } } catch (Throwable e) { v = null }
    if (v) { def r = [ok: true, ms: System.currentTimeMillis() - t0]; spLog('waitUntil', r); return r }
    if (System.currentTimeMillis() - t0 > timeoutMs) { def r = [ok: false, ms: System.currentTimeMillis() - t0, why: 'timeout']; spLog('waitUntil', r); return r }
    Thread.sleep(pollMs)
  }
}

// ---------- screens / menus ----------
// Frame pacing: every sync{} hop waits for the next frame. With vsync ON and the window unfocused/occluded the
// compositor delivers ~1 fps (measured: 1000 ms per hop); the AFK limiter (options.inactivityFpsLimit=afk) also
// throttles after 60 s without input. spFast() turns vsync off IN MEMORY (remembering the old value) and resets the
// AFK timer: measured 33 ms per hop at framerateLimit 30. spRestoreDisplay() puts vsync back (and saves options.txt).
// CAUTION: while vsync is off the game may persist enableVsync:false to options.txt (observed): always restore at the end.
spFast = { ->
  def r = sync {
    if (spState.prevVsync == null) spState.prevVsync = mc.options.enableVsync().get()
    if (mc.options.enableVsync().get()) mc.options.enableVsync().set(false)
    mc.getFramerateLimitTracker().onInputReceived()
    [vsync: mc.options.enableVsync().get(), prevVsync: spState.prevVsync]
  }
  return r
}
spRestoreDisplay = { ->
  // the game itself may write options.txt while vsync is off (observed), so restore AND save explicitly
  def r = sync { if (spState.prevVsync != null) { mc.options.enableVsync().set(spState.prevVsync); mc.options.save() }; [vsync: mc.options.enableVsync().get()] }
  spState.prevVsync = null
  spLog('restoreDisplay', r); return r
}

// Snippet A of the plan: remove the cause (pauseOnLostFocus + unfocused window), then onClose() the open screen.
spEnsureInGame = { long timeoutMs = 3000 ->
  long t0 = System.currentTimeMillis()
  def closed = []
  spFast()
  while (System.currentTimeMillis() - t0 < timeoutMs) {
    def s = sync {
      mc.options.pauseOnLostFocus = false
      def sc = mc.gui.screen()
      if (sc != null && mc.level != null) { closed << java.typeName(sc).tokenize('.').last(); sc.onClose() }
      spScreen()
    }
    if (s == null) {
      Thread.sleep(800)  // past the 500 ms re-pause window of Minecraft#pauseIfInactive
      if (sync { spScreen() } == null) { def r = [ok: true, closed: closed, ms: System.currentTimeMillis() - t0]; spLog('ensureInGame', r); return r }
    } else Thread.sleep(100)
  }
  def r = [ok: false, closed: closed, screen: sync { spScreen() }, why: 'screen still open']
  spLog('ensureInGame', r); return r
}

// ---------- world lifecycle ----------
spWorlds = { ->
  def base = sync { mc.getLevelSource().getBaseDir().toString() }
  def names = (new File(base).listFiles() ?: []).findAll { it.isDirectory() && new File(it, 'level.dat').exists() }*.name.sort()
  def r = [ok: true, saves: base, worlds: names]
  spLog('worlds', r); return r
}

spCloseWorld = { long timeoutMs = 30000 ->
  // Same path as PauseScreen "Save and Quit to Title": Minecraft#disconnectFromWorld(ClientLevel.DEFAULT_QUIT_MESSAGE)
  def was = sync { spWorldId() }
  if (sync { mc.level == null }) { def r = [ok: true, already: true, screen: sync { spScreen() }]; spLog('closeWorld', r); return r }
  sync { mc.disconnectFromWorld(spT('net.minecraft.client.multiplayer.ClientLevel').DEFAULT_QUIT_MESSAGE) }
  def w = spWaitUntil({ mc.level == null && mc.getSingleplayerServer() == null && spScreen() == 'TitleScreen' }, timeoutMs, 200)
  def r = [ok: w.ok, world: was, ms: w.ms, screen: sync { spScreen() }]
  spLog('closeWorld', r); return r
}

spWaitInWorld = { long timeoutMs = 60000 ->
  Thread.sleep(500)
  long t0 = System.currentTimeMillis()
  // fail fast: back on the title/disconnected screen with no server = the load was aborted
  def w = spWaitUntil({ (System.currentTimeMillis() - t0 > 1500 && mc.getSingleplayerServer() == null && mc.level == null &&
                         spScreen() in ['TitleScreen', 'DisconnectedScreen', 'SelectWorldScreen', 'BackupConfirmScreen', 'ConfirmScreen']) || mc.level != null && mc.player != null && mc.gameMode != null &&
                        !(spScreen() in ['LevelLoadingScreen', 'GenericMessageScreen', 'ProgressScreen', 'ReceivingLevelScreen']) }, timeoutMs, 250)
  if (w.ok && sync { mc.level == null }) return [ok: false, ms: w.ms, why: 'load aborted', screen: sync { spScreen() }]
  if (w.ok) w = spWaitUntil({ mc.player != null && mc.gameMode != null && !(spScreen() in ['LevelLoadingScreen', 'GenericMessageScreen', 'ProgressScreen', 'ReceivingLevelScreen']) }, timeoutMs, 250)
  return w
}

spOpenWorld = { String name, long timeoutMs = 60000 ->
  if (sync { spWorldId() } == name) { def r = [ok: true, already: true, world: name]; spLog('openWorld', r); return r }
  if (!(name in spWorlds().worlds)) { def r = [ok: false, why: "no save named ${name}".toString()]; spLog('openWorld', r); return r }
  if (sync { mc.level != null }) { def c = spCloseWorld(); if (!c.ok) return c }
  long t0 = System.currentTimeMillis()
  sync { mc.createWorldOpenFlows().openWorld(name, { -> } as Runnable) }
  def w = spWaitInWorld(timeoutMs)
  if (!w.ok && sync { spScreen() } == 'BackupConfirmScreen') {  // experimental/customized world: never auto-confirm; cancel
    sync { mc.gui.screen().onCancel.run(); if (mc.level == null) mc.gui.setScreen(spT('net.minecraft.client.gui.screens.TitleScreen')()) }
    def r = [ok: false, world: name, why: 'BackupConfirmScreen (experimental or customized world): cancelled; open it by hand']
    spLog('openWorld', r); return r
  }
  def g = spEnsureInGame()
  def r = [ok: w.ok && sync { spWorldId() } == name, world: sync { spWorldId() }, ms: System.currentTimeMillis() - t0, inGame: g.ok]
  spLog('openWorld', r); return r
}

// Dedicated disposable test world: vanilla "Superflat" preset (WorldPresets.FLAT, Lifecycle.stable), no structures,
// (NOT createTestWorldDimensions/FLAT_ALL_DIMENSIONS: not stable, so every reopen shows BackupConfirmScreen)
// no bonus chest, cheats on. Route: WorldOpenFlows#createFreshLevel (same call as SelectWorldScreen's DEBUG button).
spCreateTestWorld = { String name = 'sp-test-flat', Map o = [:] ->
  if (name in spWorlds().worlds) { def r = [ok: true, exists: true, world: name]; spLog('createTestWorld', r); return r }
  if (sync { mc.level != null }) { def c = spCloseWorld(); if (!c.ok) return c }
  // a previous aborted create leaves <saves>/<name>/ with only session.lock + empty datapacks/: remove only that shape
  def dir = new File(spWorlds().saves, name)
  if (dir.exists()) {
    def kids = (dir.listFiles() ?: []) as List
    boolean stub = kids.every { it.name == 'session.lock' || (it.name == 'datapacks' && !(it.listFiles() ?: [])) }
    if (!stub) { def r = [ok: false, why: "save dir ${name} exists without level.dat and is not an empty stub: inspect by hand".toString()]; spLog('createTestWorld', r); return r }
    kids.each { it.isDirectory() ? it.deleteDir() : it.delete() }; dir.delete()
  }
  def gt = (o.gamemode ?: 'creative').toUpperCase()
  def diff = (o.difficulty ?: 'normal').toUpperCase()
  long seed = (o.seed ?: 'smartpets'.hashCode()) as long
  long t0 = System.currentTimeMillis()
  sync {
    def LS = spT('net.minecraft.world.level.LevelSettings')
    def DS = spT('net.minecraft.world.level.LevelSettings$DifficultySettings')
    def settings = LS(name, spT('net.minecraft.world.level.GameType').valueOf(gt),
                      DS(spT('net.minecraft.world.Difficulty').valueOf(diff), false, false), true,
                      spT('net.minecraft.world.level.WorldDataConfiguration').DEFAULT)
    def opts = spT('net.minecraft.world.level.levelgen.WorldOptions')(seed, false, false)
    def WP = spT('net.minecraft.world.level.levelgen.presets.WorldPresets')
    def wpKey = spRaw(spT('net.minecraft.core.registries.Registries').WORLD_PRESET); def flatKey = spRaw(WP.FLAT)
    // the Function must return the RAW object: bridge results are wrapped (ClassCastException GroovyJavaObject otherwise)
    def dims = { reg -> spRaw(reg.lookupOrThrow(wpKey).getOrThrow(flatKey).value().createWorldDimensions()) } as java.util.function.Function
    mc.createWorldOpenFlows().createFreshLevel(name, settings, opts, dims, spT('net.minecraft.client.gui.screens.TitleScreen')())
  }
  def w = spWaitInWorld(90000)
  def g = spEnsureInGame()
  def r = [ok: w.ok && sync { spWorldId() } == name, world: sync { spWorldId() }, ms: System.currentTimeMillis() - t0, inGame: g.ok,
           gamemode: gt, difficulty: diff]
  spLog('createTestWorld', r); return r
}

spEnsureInWorld = { String name = 'sp-test-flat', Map o = [:] ->
  if (sync { spWorldId() } == name) { def g = spEnsureInGame(); def r = [ok: g.ok, world: name, already: true]; spLog('ensureInWorld', r); return r }
  return (name in spWorlds().worlds) ? spOpenWorld(name) : spCreateTestWorld(name, o)
}

// ---------- commands (setup) ----------
spCommand = { String cmd, String kind = 'SETUP', long settleMs = 250 ->
  def c = cmd.startsWith('/') ? cmd.substring(1) : cmd
  sync { mc.player.connection.sendCommand(c) }  // ClientPacketListener#sendCommand, no leading slash
  spState.setup << c
  spLog('command', [kind: kind, cmd: c])
  if (settleMs > 0) Thread.sleep(settleMs)  // the integrated server runs the command on its own thread
  return [ok: true, cmd: c, kind: kind]
}

spTime = { v -> spCommand("time set ${v}") }                       // 'day'|'night'|'noon'|'midnight'|ticks
spWeather = { String w = 'clear' -> spCommand("weather ${w}") }    // clear|rain|thunder
spDifficulty = { String d -> spCommand("difficulty ${d}") }        // peaceful|easy|normal|hard
spGamerule = { String n, v -> spCommand("gamerule ${n} ${v}") }    // 26.2 snake_case ids: advance_time, spawn_mobs, mob_griefing...
spGive = { String item, int count = 1 -> spCommand("give @s ${item} ${count}") }
spClearInventory = { -> spCommand('clear @s') }
spTeleportSetup = { x, y, z -> spCommand("tp @s ${x} ${y} ${z}", 'SETUP_TELEPORT') }  // SETUP ONLY, never in a gameplay check
spSetBlock = { int x, int y, int z, String block -> spCommand("setblock ${x} ${y} ${z} ${block}") }
spFill = { int x1, int y1, int z1, int x2, int y2, int z2, String block, String mode = '' -> spCommand("fill ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} ${block} ${mode}".trim()) }

spGamemode = { String m ->
  spCommand("gamemode ${m}", 'SETUP', 0)
  def w = spWaitUntil({ mc.gameMode?.getPlayerMode()?.toString() == m.toUpperCase() }, 3000, 100)
  def r = [ok: w.ok, gamemode: sync { mc.gameMode?.getPlayerMode()?.toString() }]
  spLog('gamemode', r); return r
}

spBlockPos = { -> sync { def p = mc.player; [x: Math.floor(p.getX()) as int, y: Math.floor(p.getY()) as int, z: Math.floor(p.getZ()) as int] } }

// Clean flat arena centred on the player: floor of `material` at feet-1, air above (h blocks), optional glass ring.
spArena = { int size = 8, String material = 'minecraft:smooth_stone', Map o = [:] ->
  def c = spBlockPos(); int h = (o.height ?: 5) as int; int r = size
  spFill(c.x - r, c.y - 1, c.z - r, c.x + r, c.y - 1, c.z + r, material)
  spFill(c.x - r, c.y, c.z - r, c.x + r, c.y + h, c.z + r, 'minecraft:air')
  if (o.walls != false) {
    spFill(c.x - r - 1, c.y, c.z - r - 1, c.x + r + 1, c.y + 1, c.z + r + 1, 'minecraft:glass', 'hollow')
    spFill(c.x - r, c.y, c.z - r, c.x + r, c.y + 1, c.z + r, 'minecraft:air')  // re-hollow the inside (hollow also fills top/bottom)
    spFill(c.x - r - 1, c.y - 1, c.z - r - 1, c.x + r + 1, c.y - 1, c.z + r + 1, material, 'keep')
  }
  spState.arena = [x1: c.x - r, y1: c.y - 1, z1: c.z - r, x2: c.x + r, y2: c.y + h, z2: c.z + r, center: c]
  def res = [ok: true, arena: spState.arena]
  spLog('arena', res); return res
}

spClearArena = { ->  // remove every non-player entity (mobs, then their drops/xp) inside the last arena
  def a = spState.arena
  if (a == null) return [ok: false, why: 'no arena']
  def box = "x=${a.x1},y=${a.y1},z=${a.z1},dx=${a.x2 - a.x1},dy=${a.y2 - a.y1 + 2},dz=${a.z2 - a.z1}"
  spCommand("kill @e[type=!minecraft:player,${box}]", 'SETUP', 1200)  // death animation is 20 ticks; drops/xp appear meanwhile
  spCommand("kill @e[type=minecraft:item,${box}]", 'SETUP', 0)
  spCommand("kill @e[type=minecraft:experience_orb,${box}]", 'SETUP', 0)
  def w = spWaitUntil({ spNearbyRaw(a.x2 - a.x1).findAll { it.type != 'minecraft:player' && it.alive }.isEmpty() }, 3000, 100)
  def res = [ok: w.ok, arena: a]; spLog('clearArena', res); return res
}

// ---------- plain-text vanilla command scenarios (*.cmds) ----------
// One vanilla command per line (leading '/' optional), run AS THE PLAYER (so ~ ~ ~ and @s are the player).
// '#' starts a comment. Directives: '# wait N ticks' (or '# wait N ms'); header '# needs: test-world' / 'in-world'.
// Every command is logged as SETUP. Returns [ok, commands, needs].
spCmdsHeader = { String path ->
  def needs = []
  new File(path).readLines('UTF-8').each { l -> def m = (l =~ /^#\s*needs:\s*(.*)$/); if (m) needs.addAll(m[0][1].split(',')*.trim().findAll { it }) }
  return needs
}

spRunCmds = { String path, Map o = [:] ->
  def needs = spCmdsHeader(path)
  if ('test-world' in needs) { def e = spEnsureInWorld(o.world ?: 'sp-test-flat'); if (!e.ok) return e + [why: 'needs test-world'] }
  else if (sync { mc.player == null }) return [ok: false, why: 'not in a world']
  else spEnsureInGame()
  int n = 0
  new File(path).readLines('UTF-8').eachWithIndex { raw, i ->
    def l = raw.trim()
    if (!l) return
    def w = (l =~ /^#\s*wait\s+(\d+)\s*(ticks?|ms)\s*$/)
    if (w) { long v = w[0][1] as long; Thread.sleep(w[0][2].startsWith('tick') ? v * 50 : v); return }
    if (l.startsWith('#')) return
    spCommand(l, 'SETUP', (o.delayMs ?: 100) as long); n++
  }
  def r = [ok: true, file: new File(path).name, commands: n, needs: needs]
  spLog('runCmds', r); return r
}

// ---------- entities ----------
spTypeId = { e -> spT('net.minecraft.world.entity.EntityType').getKey(e.getType()).toString() }

spNearbyRaw = { double radius -> // call inside or outside sync; reads the CLIENT level
  sync {
    def p = mc.player
    java.list(mc.level.entitiesForRendering()).findAll { it.distanceTo(p) <= radius }.collect { e ->
      def m = [uuid: e.getUUID().toString(), type: spTypeId(e), x: e.getX(), y: e.getY(), z: e.getZ(),
               dist: e.distanceTo(p), alive: e.isAlive()]
      try { m.health = e.getHealth() } catch (Throwable ignored) {}
      try { m.tame = e.isTame(); def o = e.getOwnerReference(); m.owner = o == null ? null : o.getUUID().toString()
            m.ownedByMe = (m.owner == p.getUUID().toString()) } catch (Throwable ignored) {}
      m
    }
  }
}

spNearby = { double radius = 16, String type = null ->
  def list = spNearbyRaw(radius)
  if (type) list = list.findAll { it.type == (type.contains(':') ? type : 'minecraft:' + type) }
  list = list.findAll { it.alive }  // killed mobs stay client-side ~20 ticks (death animation) with alive=false
  def r = [ok: true, n: list.size(), entities: list]
  spLog('nearby', [radius: radius, type: type, n: list.size(), entities: list]); return r
}

spUuidInts = { String u -> // UUID -> NBT int array [I;a,b,c,d]
  def id = UUID.fromString(u); long m = id.getMostSignificantBits(), l = id.getLeastSignificantBits()
  "[I;${(int) (m >> 32)},${(int) m},${(int) (l >> 32)},${(int) l}]".toString()
}

// Summon relative to the player's block position. Returns the uuid of the NEW client-side entity of that type.
spSummon = { String id, int dx = 2, int dz = 0, String nbt = null, Map o = [:] ->
  def type = id.contains(':') ? id : 'minecraft:' + id
  def c = spBlockPos(); int y = (o.dy ?: 0) + c.y
  def before = spNearbyRaw(64).findAll { it.type == type }*.uuid as Set
  spCommand("summon ${type} ${c.x + dx + 0.5} ${y} ${c.z + dz + 0.5}${nbt ? ' ' + nbt : ''}", 'SETUP', 0)
  def found = null
  long t0 = System.currentTimeMillis()
  while (System.currentTimeMillis() - t0 < (o.timeoutMs ?: 3000)) {
    def now = spNearbyRaw(64).findAll { it.type == type && !(it.uuid in before) }
    if (now) { found = now[0]; break }
    Thread.sleep(100)
  }
  def r = [ok: found != null, type: type, uuid: found?.uuid, entity: found]
  spLog('summon', r); return r
}

spSummonPet = { String kind = 'wolf', int dx = 2, int dz = 0 ->  // vanilla stand-in for the future Smart Pets dog/cat
  def me = sync { mc.player.getUUID().toString() }
  return spSummon(kind, dx, dz, "{Owner:${spUuidInts(me)},PersistenceRequired:1b}")
}

spSummonMonster = { String kind = 'zombie', int dx = 4, int dz = 0, Map o = [:] ->
  def nbt = '{PersistenceRequired:1b' + (o.noAI ? ',NoAI:1b' : '')
  if (kind.endsWith('creeper')) nbt += ',ExplosionRadius:0b,Fuse:32767s'  // never explodes in practice; radius 0 if it does
  return spSummon(kind, dx, dz, nbt + '}')
}

spKillEntities = { String typeOrSelector ->
  def sel = typeOrSelector.startsWith('@') ? typeOrSelector :
            (typeOrSelector ==~ /[0-9a-f-]{36}/ ? typeOrSelector :
             "@e[type=${typeOrSelector.contains(':') ? typeOrSelector : 'minecraft:' + typeOrSelector},distance=..64]")
  spCommand("kill ${sel}")
  return [ok: true, selector: sel]
}

// ---------- player actions ----------
spKeys = [forward: 'keyUp', back: 'keyDown', left: 'keyLeft', right: 'keyRight', jump: 'keyJump', sneak: 'keyShift', sprint: 'keySprint']

spHold = { String key, long ms ->
  def k = spKeys[key] ?: key
  def p0 = sync { [mc.player.getX(), mc.player.getZ()] }
  try { sync { mc.options."$k".setDown(true) }; Thread.sleep(ms) } finally { sync { mc.options."$k".setDown(false) } }
  def p1 = sync { [mc.player.getX(), mc.player.getZ()] }
  def r = [ok: true, key: k, ms: ms, moved: Math.hypot(p1[0] - p0[0], p1[1] - p0[1])]
  spLog('hold', r); return r
}

spWalk = { String dir = 'forward', double blocks = 3, long timeoutMs = 5000 ->
  def k = spKeys[dir]
  if (!k) return [ok: false, why: "unknown dir ${dir}".toString()]
  def g = spEnsureInGame(); if (!g.ok) return g
  def p0 = sync { [mc.player.getX(), mc.player.getZ()] }
  long t0 = System.currentTimeMillis(); double d = 0
  try {
    sync { mc.options."$k".setDown(true) }
    while (System.currentTimeMillis() - t0 < timeoutMs) {
      Thread.sleep(50)
      def p = sync { [mc.player.getX(), mc.player.getZ()] }
      d = Math.hypot(p[0] - p0[0], p[1] - p0[1])
      if (d >= blocks) break
    }
  } finally { sync { mc.options."$k".setDown(false) } }
  def r = [ok: d >= blocks, dir: dir, moved: d, ms: System.currentTimeMillis() - t0, released: !sync { mc.options."$k".isDown() }]
  spLog('walk', r); return r
}

spLook = { float yaw, float pitch ->
  sync { def p = mc.player; p.setYRot(yaw); p.setXRot(pitch); p.yRotO = yaw; p.xRotO = pitch; p.setYHeadRot(yaw) }
  def r = sync { [ok: true, yaw: mc.player.getYRot(), pitch: mc.player.getXRot()] }
  spLog('look', r); return r
}

spLookAt = { double x, double y, double z ->
  def e = sync { def v = mc.player.getEyePosition(); [v.x, v.y, v.z] }
  double dx = x - e[0], dy = y - e[1], dz = z - e[2]
  float yaw = (float) Math.toDegrees(Math.atan2(-dx, dz))
  float pitch = (float) Math.toDegrees(-Math.atan2(dy, Math.hypot(dx, dz)))
  return spLook(yaw, pitch)
}

spBlockId = { int x, int y, int z -> sync {
  def st = mc.level.getBlockState(spT('net.minecraft.core.BlockPos')(x, y, z))
  spT('net.minecraft.core.registries.BuiltInRegistries').BLOCK.getKey(st.getBlock()).toString() } }

spBreak = { int x, int y, int z, String face = 'UP', long timeoutMs = 5000 ->
  def g = spEnsureInGame(); if (!g.ok) return g
  def before = spBlockId(x, y, z)
  spLookAt(x + 0.5, y + 0.5, z + 0.5)
  long t0 = System.currentTimeMillis()
  sync { mc.gameMode.startDestroyBlock(spT('net.minecraft.core.BlockPos')(x, y, z), spT('net.minecraft.core.Direction').valueOf(face)) }
  int ticks = 0
  while (System.currentTimeMillis() - t0 < timeoutMs) {
    if (spBlockId(x, y, z) == 'minecraft:air') break
    sync {  // one continueDestroyBlock per client tick, like Minecraft#continueAttack
      def pos = spT('net.minecraft.core.BlockPos')(x, y, z)
      mc.gameMode.continueDestroyBlock(pos, spT('net.minecraft.core.Direction').valueOf(face))
      mc.player.swing(spT('net.minecraft.world.InteractionHand').MAIN_HAND)
    }
    ticks++; Thread.sleep(50)
  }
  sync { mc.gameMode.stopDestroyBlock() }
  def after = spBlockId(x, y, z)
  def r = [ok: after == 'minecraft:air', before: before, after: after, ms: System.currentTimeMillis() - t0, ticks: ticks]
  spLog('break', r); return r
}

// Place the held block at (x,y,z) by "right-clicking" the top face of the block below it.
spPlace = { int x, int y, int z ->
  def g = spEnsureInGame(); if (!g.ok) return g
  spLookAt(x + 0.5, y - 0.5, z + 0.5)
  def res = sync {
    def BP = spT('net.minecraft.core.BlockPos'); def below = BP(x, y - 1, z)
    def hit = spT('net.minecraft.world.phys.BlockHitResult')(spT('net.minecraft.world.phys.Vec3')(x + 0.5, y, z + 0.5),
              spT('net.minecraft.core.Direction').UP, below, false)
    mc.gameMode.useItemOn(mc.player, spT('net.minecraft.world.InteractionHand').MAIN_HAND, hit).toString()
  }
  Thread.sleep(150)
  def after = spBlockId(x, y, z)
  def r = [ok: after != 'minecraft:air', result: res, block: after]
  spLog('place', r); return r
}

// Raw container click: MultiPlayerGameMode#handleContainerInput(containerId, slot, button, ContainerInput, player).
spClick = { int containerId, int slot, int button = 0, String input = 'PICKUP' ->
  sync { mc.gameMode.handleContainerInput(containerId, slot, button, spT('net.minecraft.world.inventory.ContainerInput').valueOf(input), mc.player) }
  def r = [ok: true, containerId: containerId, slot: slot, button: button, input: input]
  spLog('click', r); return r
}

spInvCount = { String item -> sync {
  def inv = mc.player.getInventory(); int n = 0
  for (int i = 0; i < inv.getContainerSize(); i++) { def s = inv.getItem(i)
    if (!s.isEmpty() && spT('net.minecraft.core.registries.BuiltInRegistries').ITEM.getKey(s.getItem()).toString() == item) n += s.getCount() }
  n } }

// Best effort 2x2 craft in the player inventory menu (containerId 0, result slot 0, grid slots 1..4).
// srcSlot = menu slot holding the ingredient (36..44 hotbar, 9..35 main); grid = which grid slots get ONE item each.
spCraft2x2 = { int srcSlot, List grid, String resultItem ->
  int before = spInvCount(resultItem)
  spClick(0, srcSlot, 0, 'PICKUP')                 // pick up the ingredient stack
  grid.each { spClick(0, it as int, 1, 'PICKUP') }  // right click: drop one per grid slot
  spClick(0, srcSlot, 0, 'PICKUP')                 // put the rest back
  Thread.sleep(150)
  spClick(0, 0, 0, 'QUICK_MOVE')                   // shift-click the result
  Thread.sleep(250)
  int after = spInvCount(resultItem)
  def r = [ok: after > before, item: resultItem, before: before, after: after]
  spLog('craft2x2', r); return r
}

return [ok: true, lib: 'sp-lib', version: spLibVersion]
