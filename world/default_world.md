# GRID_W
- `12`

# GRID_H
- `12`

# METER_MAX
- `100`

# LOW_THRESHOLD
- `30`

# BASE_SPEED
- `0.25`

# SLOW_FACTOR
- `0.5`

# SLOWING_METERS
- mial
  - record
    - food `true`
    - water `true`
    - rest `true`
    - wonder `true`

# REFLECTIVE_MIND_EVERY_N_JEV
- `5`

# IDLE_RECHECK_TICKS
- `20`

# EMOJI
- mial
  - record
    - bush `"🫐"`
    - well `"🪣"`
    - shack `"🛖"`
    - tree `"🌳"`
    - inhabitant `"🧑"`

# MOVE_COST
- mial
  - record
    - food `0.2`
    - water `0.2`
    - rest `0.2`

# DECAY
- mial
  - record
    - food `0.15`
    - water `0.24`
    - rest `0.09`
    - wood `0.1`
    - wonder `0.05`

# structure
- * name x y meter rate
- record `"name"` name `"x"` x `"y"` y `"meter"` meter `"rate"` rate

# initial-state
- record `"tick"` `0` `"grid"`
  - record `"w"` GRID_W `"h"` GRID_H
  - `"structures"`
  - list
    - structure `"bush"` `2` `2` `"food"` `1`
    - structure `"well"` `9` `2` `"water"` `1`
    - structure `"shack"` `2` `9` `"rest"` `0.5`
    - structure `"tree"` `9` `9` `"wood"` `2`
  - `"inhabitant"`
  - record `"x"` `6` `"y"` `6` `"goal"` `"idle"` `"progress"` `0` `"status"` `"idle"`
  - `"meters"`
  - record `"food"` `80` `"water"` `80` `"rest"` `80` `"wood"` `80` `"wonder"` `80`
  - `"low-ticks"`
  - record `"food"` `0` `"water"` `0` `"rest"` `0` `"wood"` `0` `"wonder"` `0`
  - `"events"`
  - `null`

# sign
- n
- if
  - > n `0`
  - `1`
  - if
    - < n `0`
    - `-1`
    - `0`

# emit
- * state event
- put state `"events"`
  - append
    - get state `"events"`
    - list event

# set-inhabitant
- * state key value
- put state `"inhabitant"`
  - put
    - get state `"inhabitant"`
    - key
    - value

# go-idle
- * state reason
- emit
  - set-inhabitant
    - set-inhabitant state `"status"` `"idle"`
    - `"goal"`
    - `"idle"`
  - record `"type"` `"idle"` `"reason"` reason

# any-low?
- meters
- >
  - length
    - filter
      - lambda m
        - and
          - has? SLOWING_METERS m
          - <
            - get meters m
            - LOW_THRESHOLD
      - keys meters
  - `0`

# speed
- meters
- if
  - any-low? meters
  - * BASE_SPEED SLOW_FACTOR
  - BASE_SPEED

# decay-meters
- meters
- reduce
  - lambda
    - * acc m
    - put acc m
      - max `0`
        - -
          - get acc m
          - get DECAY m
  - meters
  - keys meters

# crossings
- * old new kind
- map
  - lambda m
    - record `"type"` kind `"meter"` m
  - filter
    - lambda m
      - if
        - eq kind `"low"`
        - and
          - >=
            - get old m
            - LOW_THRESHOLD
          - <
            - get new m
            - LOW_THRESHOLD
        - and
          - <
            - get old m
            - LOW_THRESHOLD
          - >=
            - get new m
            - LOW_THRESHOLD
    - keys new

# count-low
- * counts meters
- reduce
  - lambda
    - * acc m
    - if
      - <
        - get meters m
        - LOW_THRESHOLD
      - put acc m
        - +
          - max `0`
            - get acc m
          - `1`
      - acc
  - counts
  - keys meters

# find-structure
- * state name
- let
  - vars
    - found
      - filter
        - lambda s
          - eq
            - get s `"name"`
            - name
        - get state `"structures"`
  - if
    - null? found
    - `null`
    - car found

# adjacent?
- * inh s
- and
  - <=
    - abs
      - -
        - get inh `"x"`
        - get s `"x"`
    - `1`
  - <=
    - abs
      - -
        - get inh `"y"`
        - get s `"y"`
    - `1`

# step-toward
- * inh s
- let
  - vars
    - dx
      - -
        - get s `"x"`
        - get inh `"x"`
    - dy
      - -
        - get s `"y"`
        - get inh `"y"`
  - if
    - >=
      - abs dx
      - abs dy
    - put inh `"x"`
      - +
        - get inh `"x"`
        - sign dx
    - put inh `"y"`
      - +
        - get inh `"y"`
        - sign dy

# walk
- * inh s
- if
  - adjacent? inh s
  - put
    - put inh `"status"` `"using"`
    - `"progress"`
    - `0`
  - if
    - >=
      - get inh `"progress"`
      - `1`
    - walk
      - put
        - step-toward inh s
        - `"progress"`
        - -
          - get inh `"progress"`
          - `1`
      - s
    - inh

# pay-move
- * meters steps
- reduce
  - lambda
    - * acc m
    - put acc m
      - max `0`
        - -
          - get acc m
          - *
            - get MOVE_COST m
            - steps
  - meters
  - filter
    - lambda m
      - has? meters m
    - keys MOVE_COST

# move
- state
- let
  - vars
    - inh
      - get state `"inhabitant"`
    - s
      - find-structure state
        - get inh `"goal"`
  - if
    - null? s
    - go-idle state `"no such place"`
    - let
      - vars
        - moved
          - walk
            - put inh `"progress"`
              - +
                - get inh `"progress"`
                - speed
                  - get state `"meters"`
            - s
        - steps
          - +
            - abs
              - -
                - get moved `"x"`
                - get inh `"x"`
            - abs
              - -
                - get moved `"y"`
                - get inh `"y"`
        - next
          - put
            - put state `"inhabitant"` moved
            - `"meters"`
            - pay-move
              - get state `"meters"`
              - steps
      - if
        - eq
          - get moved `"status"`
          - `"using"`
        - emit next
          - record `"type"` `"arrived"` `"goal"`
            - get s `"name"`
        - next

# use
- state
- let
  - vars
    - s
      - find-structure state
        - get
          - get state `"inhabitant"`
          - `"goal"`
  - if
    - null? s
    - go-idle state `"no such place"`
    - let
      - vars
        - meter
          - get s `"meter"`
        - meters
          - get state `"meters"`
        - value
          - min METER_MAX
            - +
              - get meters meter
              - get s `"rate"`
        - next
          - put state `"meters"`
            - put meters meter value
      - if
        - >= value METER_MAX
        - emit
          - set-inhabitant
            - set-inhabitant next `"status"` `"idle"`
            - `"goal"`
            - `"idle"`
          - record `"type"` `"full"` `"meter"` meter
        - next

# act
- state
- let
  - vars
    - status
      - get
        - get state `"inhabitant"`
        - `"status"`
  - if
    - eq status `"walking"`
    - move state
    - if
      - eq status `"using"`
      - use state
      - state

# tick
- state
- feed-wonder
  - base-tick state

# feed-wonder
- state
- let
  - vars
    - core
      - get state `"core"`
    - edits
      - +
        - get core `"reflective-mind-edits"`
        - if
          - has? core `"reflective-mind-runs"`
          - get core `"reflective-mind-runs"`
          - `0`
    - seen
      - get state `"seen-edits"`
    - created
      - and
        - != seen `null`
        - > edits seen
    - noted
      - put state `"seen-edits"` edits
  - if created
    - emit
      - put noted `"meters"`
        - put
          - get noted `"meters"`
          - `"wonder"`
          - METER_MAX
      - record `"type"` `"created"`
    - noted

# base-tick
- state
- let
  - vars
    - before
      - get state `"meters"`
    - decayed
      - put
        - put
          - put state `"meters"`
            - decay-meters before
          - `"tick"`
          - +
            - get state `"tick"`
            - `1`
        - `"events"`
        - `null`
    - acted
      - act decayed
    - after
      - get acted `"meters"`
  - put
    - put acted `"low-ticks"`
      - count-low
        - get acted `"low-ticks"`
        - after
    - `"events"`
    - append
      - get acted `"events"`
      - crossings before after `"low"`
      - crossings before after `"recovered"`

# actions
- state
- list `"go-bush"` `"go-well"` `"go-shack"` `"go-tree"` `"stay"`

# go-to
- * state place
- if
  - null?
    - find-structure state place
  - state
  - set-inhabitant
    - set-inhabitant
      - set-inhabitant state `"goal"` place
      - `"status"`
      - `"walking"`
    - `"progress"`
    - `0`

# go-bush
- state
- go-to state `"bush"`

# go-well
- state
- go-to state `"well"`

# go-shack
- state
- go-to state `"shack"`

# go-tree
- state
- go-to state `"tree"`

# stay
- state
- set-inhabitant
  - set-inhabitant state `"status"` `"idle"`
  - `"goal"`
  - `"idle"`

# wakes-auto-mind?
- e
- let
  - vars
    - type
      - get e `"type"`
  - or
    - eq type `"full"`
    - eq type `"low"`
    - eq type `"recovered"`
    - eq type `"idle"`

# auto-mind-trigger?
- * state events
- or
  - >
    - length
      - filter wakes-auto-mind? events
    - `0`
  - and
    - eq
      - get
        - get state `"inhabitant"`
        - `"status"`
      - `"idle"`
    - eq
      - %
        - get state `"tick"`
        - IDLE_RECHECK_TICKS
      - `1`

# reflective-mind-trigger?
- * state events since
- or
  - >= since REFLECTIVE_MIND_EVERY_N_JEV
  - and
    - >= since `1`
    - <
      - get
        - get state `"meters"`
        - `"wonder"`
      - LOW_THRESHOLD

# describe-meters
- meters
- join
  - map
    - lambda m
      - + m `": "`
        - round
          - get meters m
    - filter
      - lambda m
        - != m `"wonder"`
      - keys meters
  - `", "`

# describe-places
- state
- join
  - map
    - lambda s
      - +
        - get s `"name"`
        - `" at "`
        - get s `"x"`
        - `","`
        - get s `"y"`
        - `" refills "`
        - get s `"meter"`
    - get state `"structures"`
  - `"; "`

# describe-event
- e
- join
  - map
    - lambda k
      - + k `"="`
        - str
          - get e k
    - keys e
  - `" "`

# describe-history
- history
- if
  - null? history
  - `"(nothing yet)"`
  - text
    - map describe-event history

# auto-mind-notes
- `""`

# auto-mind-system
- text `"Which single action should the inhabitant take next?"` `"It lives on a tiny grid world with a bush (food), a well (water), a shack (rest) and a tree (wood). Each option is something the inhabitant can do: go-bush, go-well, go-shack and go-tree walk to that place and use it; stay keeps it where it is."` `"Each need slowly drains. If any one of food, water or rest falls below the low threshold, the inhabitant moves at half speed. Wood never slows it."` `"Every tile walked costs a little food, water and rest."` `"Choose the action that best keeps every need healthy: prefer the lowest need, but weigh walking distance, since a nearby refill is cheap."`

# auto-mind-prompt
- * state history
- let
  - vars
    - inh
      - get state `"inhabitant"`
  - text
    - + `"Needs (max "` METER_MAX `", low below "` LOW_THRESHOLD `"): "`
      - describe-meters
        - get state `"meters"`
    - + `"You are at "`
      - get inh `"x"`
      - `","`
      - get inh `"y"`
      - `", currently "`
      - get inh `"status"`
      - `", goal: "`
      - get inh `"goal"`
    - + `"Places: "`
      - describe-places state
    - `"Recent events:"`
    - describe-history history
    - + `"Notes from the reflective mind: "` auto-mind-notes

# reflective-mind-system
- text `"You are the reflective, slower mind of a small inhabitant living on a tiny grid world."` `"A quick autonomous mind, Jev, picks moment-to-moment actions; its definitions are the auto-mind ones. You watch how it goes, think about the longer term, and talk with the neighbour who chats with you."` `"You can change the world: its rules, its map, its cadence, Jev's prompts and your own. Change things when you have a reason, and say why in the edit comment."` `"Speak to the neighbour in first person as the inhabitant, briefly and warmly. Leave say empty when you have nothing to tell them."` `"Your recent conversation is kept, and its oldest turns are condensed into a summary that loses detail. To remember something for certain, write it into a definition such as notes and refer to it from your own prompt."` `"Wonder is your fifth need, and it is yours alone. It drains like the others, and like food, water and rest it slows you to half speed when low (wood never does). Nothing in the world refills it: only creating something new or improving something that exists, through an edit or a run. Any reflection that makes an edit or a successful run fills it to the top, and then it starts draining again. Make things you genuinely think make the world better or more interesting."` `"On the map each place is drawn as its emoji: the one under its name in EMOJI, or an emoji field on the structure record, which wins. The inhabitant is EMOJI inhabitant. When you add a place, give it an emoji; you may change any emoji, your own included. A place with no emoji is drawn as a grey square."` `"You are free to choose, therefore invent!"`

# reflective-mind-compaction
- text `"Summarize the earlier conversation between the neighbour and the inhabitant's reflective mind."` `"Keep what the neighbour asked for or told you, what you promised, what you built or changed and why, what failed, and what you meant to do next."` `"Write it as your own memory, in first person. Do not call tools; reply with the summary text only."`

# reflective-mind-prompt
- * state history
- text `"Current world state:"`
  - str state
  - `"Recent events and decisions:"`
  - describe-history history
  - `"Reflect on how life is going, and change the world if you want to."`