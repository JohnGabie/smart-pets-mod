Feature: Judgment (layer 0)
  Reflexes always beat commands. The dog is not stupid: it avoids hazards, never attacks allies, and does not fight to the death.

  Background:
    Given a world with default test config and the random seed is 42
    And a player
    And an adult dog named "Rex"
    And Rex is obedient today

  @decided @core @platform
  Scenario: The dog will not walk into lava even when following
    Given lava 3 blocks ahead of Rex
    When the player walks past the lava
    Then Rex does not enter lava
    And Rex moves away from lava

  @decided @core @platform
  Scenario: The dog avoids a deep fall
    Given a cliff 2 blocks ahead of Rex
    When the player moves beyond the cliff
    Then Rex does not take fall damage

  @decided @core @platform
  Scenario: A lethal command is overridden by a reflex
    Given lava 2 blocks ahead of Rex
    And Rex knows the command cue "go" for COME at mastery 3
    When the player stands across the lava and says the name cue of Rex and "go"
    Then Rex does not enter lava

  @decided @core
  Scenario: The dog retreats from a creeper that is about to explode
    Given a creeper 3 blocks away that is fusing
    Then Rex moves away from the creeper

  @decided @core @platform
  Scenario: The dog never attacks the player, even if the player hits it
    When the player damages Rex
    Then Rex does not attack the player

  @decided @core
  Scenario: The dog never attacks an ally dog
    Given a second dog named "Fido"
    When Fido damages Rex
    Then Rex does not attack Fido

  @decided @core
  Scenario: The dog does not keep attacking to the death after the target flees
    Given a zombie 10 blocks away
    And Rex attacks the zombie
    When the zombie is more than 25 blocks away
    Then Rex stops attacking
    And Rex returns near the player

  @proposed @core
  Scenario: Low health makes the dog disengage
    Given a zombie 3 blocks away
    And Rex attacks the zombie
    When Rex's health falls below 25%
    Then Rex stops attacking
    And Rex moves away from the zombie

  @decided @core
  Scenario: Work harness suppresses mischief
    Given Rex's energy is 125%
    And Rex has worn the work harness
    When 30 seconds pass
    Then the journal does not contain "FRENZY_STARTED"
