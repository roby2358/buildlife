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

# SONNET_EVERY_N_JEV
- `5`

# IDLE_RECHECK_TICKS
- `20`

# DECAY
- mial
  - record
    - food
      - `0.125`
    - water
      - `0.2`
    - rest
      - `0.075`
    - wood
      - `0.1`

# structure
- *
  - name
  - x
  - y
  - meter
  - rate
- record `"name"` name `"x"` x `"y"` y `"meter"` meter `"rate"` rate

# initial-state
- record
  - `"tick"`
  - `0`
  - `"grid"`
  - record `"w"` GRID_W `"h"` GRID_H
  - `"structures"`
  - list
    - structure `"bush"` `2` `2` `"food"` `2`
    - structure `"well"` `9` `2` `"water"` `2`
    - structure `"shack"` `2` `9` `"rest"` `1`
    - structure `"tree"` `9` `9` `"wood"` `2`
  - `"inhabitant"`
  - record `"x"` `6` `"y"` `6` `"goal"` `"idle"` `"progress"` `0` `"status"` `"idle"`
  - `"meters"`
  - record `"food"` `80` `"water"` `80` `"rest"` `80` `"wood"` `80`
  - `"low-ticks"`
  - record `"food"` `0` `"water"` `0` `"rest"` `0` `"wood"` `0`
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
- *
  - state
  - event
- put state `"events"`
  - append
    - get state `"events"`
    - list event

# set-inhabitant
- *
  - state
  - key
  - value
- put state `"inhabitant"`
  - put
    - get state `"inhabitant"`
    - key
    - value

# go-idle
- *
  - state
  - reason
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
      - lambda
        - m
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
    - *
      - acc
      - m
    - put acc m
      - max
        - `0`
        - -
          - get acc m
          - get DECAY m
  - meters
  - keys meters

# crossings
- *
  - old
  - new
  - kind
- map
  - lambda
    - m
    - record `"type"` kind `"meter"` m
  - filter
    - lambda
      - m
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
- *
  - counts
  - meters
- reduce
  - lambda
    - *
      - acc
      - m
    - if
      - <
        - get meters m
        - LOW_THRESHOLD
      - put acc m
        - +
          - max
            - `0`
            - get acc m
          - `1`
      - acc
  - counts
  - keys meters

# find-structure
- *
  - state
  - name
- let
  - vars
    - found
      - filter
        - lambda
          - s
          - eq
            - get s `"name"`
            - name
        - get state `"structures"`
  - if
    - null? found
    - `null`
    - car found

# adjacent?
- *
  - inh
  - s
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
- *
  - inh
  - s
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
- *
  - inh
  - s
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

# move
- state
- let
  - vars
    - inh
      - get state `"inhabitant"`
    - s
      - find-structure
        - state
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
        - next
          - put state `"inhabitant"` moved
      - if
        - eq
          - get moved `"status"`
          - `"using"`
        - emit next
          - record
            - `"type"`
            - `"arrived"`
            - `"goal"`
            - get s `"name"`
        - next

# use
- state
- let
  - vars
    - s
      - find-structure
        - state
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
          - min
            - METER_MAX
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
- append
  - map
    - lambda
      - s
      - get s `"name"`
    - get state `"structures"`
  - list `"idle"`

# apply-action
- *
  - state
  - action
- if
  - eq action `"idle"`
  - set-inhabitant
    - set-inhabitant state `"status"` `"idle"`
    - `"goal"`
    - `"idle"`
  - if
    - null?
      - find-structure state action
    - state
    - set-inhabitant
      - set-inhabitant
        - set-inhabitant state `"goal"` action
        - `"status"`
        - `"walking"`
      - `"progress"`
      - `0`

# wakes-jev?
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

# jev-trigger?
- *
  - state
  - events
- or
  - >
    - length
      - filter wakes-jev? events
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

# sonnet-trigger?
- *
  - state
  - events
  - since
- >= since SONNET_EVERY_N_JEV

# describe-meters
- meters
- join
  - map
    - lambda
      - m
      - +
        - m
        - `": "`
        - round
          - get meters m
    - keys meters
  - `", "`

# describe-places
- state
- join
  - map
    - lambda
      - s
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
    - lambda
      - k
      - +
        - k
        - `"="`
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

# jev-notes
- `""`

# jev-system
- text
  - `"You are the quick, instinctive mind of a small inhabitant living on a tiny grid world."`
  - `"The world has a bush (food), a well (water), a shack (rest) and a tree (wood)."`
  - `"Each need slowly drains. If any need falls below the low threshold, you move at half speed."`
  - `"Choose the single next action that best keeps every need healthy."`
  - `"Prefer the lowest need, but weigh walking distance: a nearby refill is cheap."`
  - `"Reply only with JSON: a one-sentence thought and the action."`

# jev-prompt
- *
  - state
  - history
- let
  - vars
    - inh
      - get state `"inhabitant"`
  - text
    - +
      - `"Needs (max "`
      - METER_MAX
      - `", low below "`
      - LOW_THRESHOLD
      - `"): "`
      - describe-meters
        - get state `"meters"`
    - +
      - `"You are at "`
      - get inh `"x"`
      - `","`
      - get inh `"y"`
      - `", currently "`
      - get inh `"status"`
      - `", goal: "`
      - get inh `"goal"`
    - +
      - `"Places: "`
      - describe-places state
    - `"Recent events:"`
    - describe-history history
    - +
      - `"Notes from your reflective self: "`
      - jev-notes
    - `"Choose your next action."`

# sonnet-system
- text
  - `"You are the reflective, slower mind of a small inhabitant living on a tiny grid world."`
  - `"A quick instinctive mind called Jev picks moment-to-moment actions. You watch how it goes, think about the longer term, and talk with the neighbour who chats with you."`
  - `"You can change the world: its rules, its map, its cadence, Jev's prompts and your own. Change things when you have a reason, and say why in the edit comment."`
  - `"Speak to the neighbour in first person as the inhabitant, briefly and warmly. Leave say empty when you have nothing to tell them."`
  - `"To remember something across reflections, write it into a definition such as notes and refer to it from your own prompt."`

# sonnet-prompt
- *
  - state
  - history
- text
  - `"Current world state:"`
  - str state
  - `"Recent events and decisions:"`
  - describe-history history
  - `"Reflect on how life is going, and change the world if you want to."`
