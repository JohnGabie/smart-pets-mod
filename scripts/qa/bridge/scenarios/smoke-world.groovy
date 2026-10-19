// scenario: smoke-world (assertions; setup is smoke-world.cmds)
// timeoutMs: 300000  (default mode at ~1 fps needs ~2 min; SP_FAST=1 needs ~10 s)
// Runs after the .cmds setup in the same bridge call. SP_SEED and SP_RUN are set by the runner.
def n = spNearby(16)
def wolf = n.entities.find { it.type == 'minecraft:wolf' }
def zombie = n.entities.find { it.type == 'minecraft:zombie' }
spExpect('wolf present, tame, owned by player', wolf != null && wolf.tame && wolf.ownedByMe, [wolf: wolf])
spExpect('zombie present', zombie != null, [zombie: zombie])
// kill BEFORE survival: in slow (1 fps) mode the zombie otherwise has time to kill the player
if (wolf) spKillEntities(wolf.uuid)
if (zombie) spKillEntities(zombie.uuid)
def gone = spWaitUntil({ spNearbyRaw(16).findAll { it.alive && it.type in ['minecraft:wolf', 'minecraft:zombie'] }.isEmpty() }, 5000, 100)
spExpect('wolf and zombie killed', gone.ok, gone)
spExpect('switch to survival', spGamemode('survival').ok, [:])
def c = spCloseWorld()
spExpect('world closed to title screen', c.ok && c.screen == 'TitleScreen', c)
def o = spOpenWorld('sp-test-flat')
spExpect('test world reopened', o.ok, o)
def i = spInfo()
spExpect('in game after reopen, survival, no screen', i.inWorld && i.screen == null && i.gamemode == 'SURVIVAL', i)
return spReport()
