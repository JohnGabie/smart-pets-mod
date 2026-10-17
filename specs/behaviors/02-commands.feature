Feature: Command cues
  A learned command cue after attention makes the dog evaluate and, if willing, obey. Refusals are visible. Safety rules always win.

  Background:
    Given a world with default test config and the random seed is 42
    And a player
    And an adult dog named "Rex"
    And Rex knows the name cue "felicia"
    And Rex knows the command cue "potato" for SIT at mastery 1
    And Rex knows the command cue "blitz" for ATTACK at mastery 1
    And Rex's bond with the player is 60%
    And Rex is obedient today

  @decided @core @platform
  Scenario: Name then command
    When the player says the name cue of Rex
    And the player says "potato"
    Then Rex performs SIT

  @proposed @core
  Scenario: Command without the name is ignored at low mastery
    When the player says "potato"
    Then Rex does not perform SIT
    And the journal contains "COMMAND_IGNORED_NO_ATTENTION"

  @proposed @core
  Scenario: A master-level dog obeys a command alone when it is the only dog in range
    Given Rex knows the command cue "potato" for SIT at mastery 4
    When the player says "potato"
    Then Rex performs SIT

  @proposed @core
  Scenario: Command alone is ignored if several dogs could answer
    Given Rex knows the command cue "potato" for SIT at mastery 4
    And a second dog named "Fido"
    And Fido knows the command cue "potato" for SIT at mastery 4
    When the player says "potato"
    Then Rex does not perform SIT
    And Fido does not perform SIT

  @decided @core
  Scenario: Unknown cue after the name gives a head tilt
    When the player says the name cue of Rex
    And the player says "zebra"
    Then Rex shows head_tilt
    And Rex does not perform any command

  @decided @core
  Scenario: Refusal is visible, not silent
    Given Rex is stubborn today
    When the player says the name cue of Rex
    And the player says "potato"
    Then Rex does not perform SIT
    And Rex shows ignore

  @decided @core
  Scenario: Attack on a hostile mob the player is looking at
    Given a zombie 8 blocks away
    When the player looks at a zombie
    And the player says the name cue of Rex
    And the player says "blitz"
    Then Rex attacks the zombie

  @decided @core @platform
  Scenario: Attack never targets the player
    When the player looks at the player
    And the player says the name cue of Rex
    And the player says "blitz"
    Then Rex does not attack the player
    And Rex shows head_tilt

  @decided @core
  Scenario: Attack never targets an ally dog
    Given a second dog named "Fido"
    When the player looks at Fido
    And the player says the name cue of Rex
    And the player says "blitz"
    Then Rex does not attack Fido

  @proposed @core
  Scenario: Attack with nothing targeted does nothing but looks around
    When the player looks at nothing
    And the player says the name cue of Rex
    And the player says "blitz"
    Then Rex does not perform ATTACK
    And the journal contains "COMMAND_NEEDS_TARGET"

  @proposed @core
  Scenario: Attack on a passive animal is refused
    Given a cow 6 blocks away
    When the player looks at a cow
    And the player says the name cue of Rex
    And the player says "blitz"
    Then Rex does not attack the cow

  @proposed @core
  Scenario: Attack on a villager is refused
    Given a villager 6 blocks away
    When the player looks at a villager
    And the player says the name cue of Rex
    And the player says "blitz"
    Then Rex does not attack the villager

  @decided @core
  Scenario: Attack is dropped on release
    Given a zombie 8 blocks away
    And Rex attacks the zombie
    When the player says the name cue of Rex
    And the player says "enough"
    Then Rex stops attacking

  @decided @core
  Scenario: A frightened dog refuses to attack a much stronger mob
    Given Rex is scared
    And an iron golem 6 blocks away
    When the player looks at an iron golem
    And the player says the name cue of Rex
    And the player says "blitz"
    Then Rex does not attack the iron golem
    And Rex shows whine

  @decided @core
  Scenario: Commands are ignored while downed
    Given Rex is downed
    When the player says the name cue of Rex
    And the player says "potato"
    Then Rex does not perform SIT

  @proposed @core
  Scenario: A tired dog refuses with a yawn
    Given Rex's energy is 3%
    When the player says the name cue of Rex
    And the player says "potato"
    Then Rex shows yawn

  @decided @core
  Scenario: Sitting when already sitting is a no-op
    Given Rex is sitting
    When the player says the name cue of Rex
    And the player says "potato"
    Then the journal contains "COMMAND_REDUNDANT"

  @open @core
  Scenario: Two cues spoken back to back
    When the player says the name cue of Rex
    And the player says "potato"
    And the player says "blitz"
    Then the journal contains "UNSPECIFIED_SITUATION"
    And Rex does not crash
