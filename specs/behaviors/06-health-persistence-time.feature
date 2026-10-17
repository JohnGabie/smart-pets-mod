Feature: Health, death by difficulty, persistence, time

  Background:
    Given a world with default test config and the random seed is 42
    And a player
    And an adult dog named "Rex"

  @decided @core
  Scenario Outline: Downed state and death depend on difficulty
    Given difficulty is <difficulty>
    When Rex is damaged to 0 HP
    Then the journal contains "<first>"
    And after the rescue window passes without help the journal contains "<final>"

    Examples:
      | difficulty | first       | final          |
      | peaceful   | DOWNED      | RESPAWN_AT_BED |
      | normal     | DOWNED      | PERMANENT_DEATH |
      | hard       | DOWNED      | PERMANENT_DEATH |
      | hardcore   | PERMANENT_DEATH | PERMANENT_DEATH |

  @decided @core
  Scenario: Treating a downed dog in time saves it
    Given difficulty is normal
    And Rex is downed
    When the player applies a bandage within the rescue window
    Then the journal contains "REVIVED"
    And the journal does not contain "PERMANENT_DEATH"

  @decided @core
  Scenario: Difficulty is read at the moment of the event
    Given difficulty is peaceful
    And difficulty is changed to hardcore
    When Rex is damaged to 0 HP
    Then the journal contains "PERMANENT_DEATH"

  @decided @core
  Scenario: Animal fights never kill
    Given a second dog named "Fido"
    When Fido and Rex fight until one is at 1 HP
    Then the journal does not contain "PERMANENT_DEATH"

  @decided @core
  Scenario: Age is the world day minus the birth day and never decreases
    Given Rex was born on day 10
    When the world day is 40
    Then Rex's age is 30 days
    When the world day is set back to 20
    Then Rex's age is still 30 days

  @decided @core
  Scenario: Long absences are capped, not punished like neglect
    Given Rex is clingy
    When 100 days pass while the player is away
    Then Rex is not in a "neglected" state
    And the journal contains "CATCHUP_CAPPED"

  @decided @core @platform
  Scenario: Pet data survives saving and reloading
    Given Rex knows the command cue "potato" for SIT at mastery 2
    When the world is saved and reloaded
    Then Rex still knows the command cue "potato" for SIT at mastery 2
    And Rex's age is unchanged

  @decided @core
  Scenario: Old save data is migrated, not discarded
    Given a saved pet record in schema version 1
    When the world loads with schema version 2
    Then the pet is present
    And unknown fields are preserved

  @decided @core
  Scenario: Same genes and seed always produce the same coat
    Given two dogs with identical genes and seed
    Then their coat images are identical
