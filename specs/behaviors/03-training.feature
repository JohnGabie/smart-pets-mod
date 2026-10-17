Feature: Training a cue by induction and reward
  The dog learns cue -> command associations by repetition. Any consistent sound or text works.

  Background:
    Given a world with default test config and the random seed is 42
    And a player
    And an adult dog named "Rex"
    And Rex knows the name cue "felicia"
    And Rex's bond with the player is 50%

  @decided @core
  Scenario: Teaching sit with a lure and reward
    Given Rex does not know the cue "potato"
    When the player says the name cue of Rex
    And the player says "potato"
    And the player performs the lure for SIT
    And the player gives a treat
    Then the journal contains "ASSOCIATION_STRENGTHENED"
    And Rex shows hearts

  @decided @core
  Scenario: After enough consistent repetitions the cue alone works
    Given Rex does not know the cue "potato"
    When the player repeats the SIT lesson with "potato" 6 times
    And the player says the name cue of Rex
    And the player says "potato"
    Then Rex performs SIT

  @decided @core
  Scenario: Different cues each time teach nothing
    Given Rex does not know the cue "potato"
    When the player teaches SIT once each with "potato", "banana", "hello", "zebra", "gate", "rock"
    Then the journal does not contain "COMMAND_LEARNED"

  @decided @core
  Scenario: A more intelligent dog learns in fewer repetitions
    Given an adult dog named "Sage" with traits intelligent
    And Sage does not know the cue "potato"
    When the player repeats the SIT lesson with "potato" 3 times
    Then Sage performs SIT on "potato"

  @decided @core
  Scenario: A full dog is not motivated by treats
    Given Rex is full
    When the player gives a treat
    Then the journal contains "REWARD_REJECTED_FULL"
    And the journal does not contain "ASSOCIATION_STRENGTHENED"

  @decided @core
  Scenario: Over-training shows warning signs before problems
    When the player repeats the SIT lesson with "potato" 25 times in a row
    Then the journal contains "FATIGUE_WARNING"
    And Rex shows yawn

  @decided @core
  Scenario: Continuing past the warning makes the dog lose interest
    When the player repeats the SIT lesson with "potato" 40 times in a row
    Then the journal contains "TRAINING_DISINTEREST"

  @decided @core
  Scenario: Correction is the "no" cue and withdrawing attention, never harm
    Given Rex is chewing a forbidden item
    When the player says the name cue of Rex
    And the player says "no"
    Then Rex does not take damage
    And the journal contains "BEHAVIOR_WEIGHT_DECREASED"

  @decided @core
  Scenario: Hard prerequisite - Release needs something to release
    When the player teaches RELEASE with "enough" when Rex knows neither FETCH nor ATTACK
    Then the journal contains "TRAINING_BLOCKED_PREREQUISITE"

  @decided @core
  Scenario: Soft prerequisite - Down without Sit is possible but slower
    When the player repeats the DOWN lesson with "flat" 8 times
    Then Rex does not perform DOWN on "flat"
    And the journal contains "ASSOCIATION_STRENGTHENED"

  @decided @core
  Scenario: Idle days reduce progress before they reduce level
    Given Rex knows the command cue "potato" for SIT at mastery 3
    When 40 days pass
    Then Rex has mastery 3 for SIT
    And the journal contains "MASTERY_XP_DECAYED"
