Feature: Energy, frenzy, sleep
  Needs drive visible life. Energy can overflow into a frenzy; sleep follows a ladder; the player's sleep depends on nearby pets.

  Background:
    Given a world with default test config and the random seed is 42
    And a player
    And an adult dog named "Rex"

  @decided @core
  Scenario: Overflowing energy triggers a frenzy
    Given Rex's energy is 128%
    When 20 seconds pass
    Then the journal contains "FRENZY_STARTED"

  @decided @core
  Scenario: A frenzy lasts at least its minimum time
    Given Rex's energy is 128%
    When a frenzy starts and Rex's energy reaches the exit threshold early
    Then the journal does not contain "FRENZY_ENDED" before the minimum duration

  @decided @core
  Scenario: Frenzy can overspend energy and the dog collapses asleep without harm
    Given Rex's energy is 5%
    When a frenzy is forced for its minimum duration
    Then the journal contains "ENERGY_DEBT"
    And Rex falls asleep
    And Rex does not take damage

  @decided @core
  Scenario: A penned-in energetic dog makes mischief
    Given Rex is penned in with energy at 110%
    When 60 seconds pass
    Then the journal contains one of "DIG_HOLE", "HOWL", "CIRCLING"

  @decided @core
  Scenario: A satisfied, tired dog falls asleep near its bed at night
    Given it is night
    And Rex is full
    And Rex's energy is 15%
    And Rex is near its bed
    When 120 seconds pass
    Then Rex falls asleep

  @decided @core
  Scenario: The player cannot sleep while nearby pets are awake
    Given it is night
    And Rex is awake within 16 blocks of the player's bed
    When the player tries to sleep
    Then the journal contains "SLEEP_BLOCKED_BY_PETS"

  @decided @core
  Scenario: The player can sleep when nearby pets are asleep
    Given it is night
    And Rex is asleep within 16 blocks of the player's bed
    When the player tries to sleep
    Then the journal does not contain "SLEEP_BLOCKED_BY_PETS"

  @decided @core
  Scenario: A kennel outside the radius does not block sleep
    Given it is night
    And Rex is awake 60 blocks from the player's bed
    When the player tries to sleep
    Then the journal does not contain "SLEEP_BLOCKED_BY_PETS"

  @decided @core
  Scenario: The gating rule can be turned off
    Given the config option "sleepGating" is false
    And it is night
    And Rex is awake within 16 blocks of the player's bed
    When the player tries to sleep
    Then the journal does not contain "SLEEP_BLOCKED_BY_PETS"

  @decided @core
  Scenario: A clingy dog waits by the door and greets on return
    Given an adult dog named "Velcro" with traits clingy
    When the player leaves for 5 minutes and returns
    Then the journal contains "WAITED_AT_DOOR"
    And the journal contains "GREETED_OWNER"
