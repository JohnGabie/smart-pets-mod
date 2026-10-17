Feature: Name cue and attention
  The dog's learned name cue gets its attention. It never triggers a command by itself.

  Background:
    Given a world with default test config and the random seed is 42
    And a player
    And an adult dog named "Rex"
    And Rex knows the name cue "felicia"
    And Rex's bond with the player is 50%

  @decided @core @platform
  Scenario: Calling the name with no command
    Given Rex is calm
    And Rex is 6 blocks from the player
    When the player says the name cue of Rex
    Then Rex shows look_at_player
    And Rex does not perform any command
    And the journal contains "ATTENTION_GAINED"

  @decided @core
  Scenario: Attention expires if no command follows
    Given Rex is calm
    When the player says the name cue of Rex
    And 4 seconds pass
    Then the journal contains "ATTENTION_EXPIRED"
    And Rex does not perform any command

  @proposed @core
  Scenario: Looking at the dog and calling the name makes a bonded dog approach
    Given Rex is calm
    And Rex is 8 blocks from the player
    And Rex's bond with the player is 70%
    When the player looks at Rex
    And the player says the name cue of Rex
    Then Rex shows approach

  @proposed @core
  Scenario: A low-bond dog acknowledges but does not approach
    Given Rex is 8 blocks from the player
    And Rex's bond with the player is 10%
    When the player says the name cue of Rex
    Then Rex shows look_at_player
    And Rex does not show approach

  @decided @core
  Scenario: Another dog's name does not get Rex's attention
    Given a second dog named "Fido"
    And Fido knows the name cue "biscuit"
    When the player says the name cue of Fido
    Then Fido shows look_at_player
    And Rex does not show look_at_player

  @decided @core
  Scenario: A dog that never learned its name only reacts to unknown sound
    Given Rex does not know any name cue
    When the player says "felicia"
    Then Rex shows head_tilt
    And the journal does not contain "ATTENTION_GAINED"

  @decided @core
  Scenario: Name beyond hearing range is ignored
    Given Rex is outside hearing range
    When the player says the name cue of Rex
    Then the journal does not contain "ATTENTION_GAINED"

  @decided @core
  Scenario Outline: Waking a sleeping dog by name
    Given Rex is <state>
    When the player says the name cue of Rex <times> times
    Then the journal contains "<event>"

    Examples:
      | state  | times | event          |
      | dozing | 1     | WOKE_UP        |
      | asleep | 1     | WAKE_STEP_1    |
      | asleep | 3     | WOKE_UP        |

  @decided @core
  Scenario: Waking abruptly lowers mood
    Given Rex is asleep
    When the player damages Rex
    Then the journal contains "MOOD_DROPPED"

  @open @core
  Scenario: Repeating the name rapidly gives no extra effect
    When the player says the name cue of Rex 5 times within 2 seconds
    Then the journal contains "ATTENTION_GAINED" exactly 1 time
