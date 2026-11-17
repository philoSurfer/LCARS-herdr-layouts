# LCARS 25

An LCARS frame after the 25th-century displays of *Star Trek: Picard* (designed by Andrew Jarvis, [ion studio](https://ion.studio/25th-century-lcars)): black, three grey-blues and one red-orange. The frame sits on the right and along the bottom. Titles are dark pill bars, and the right column is a light grey frame holding dark cards. It does what [LCARS](../lcars/RECIPE.md) 1.0 does (spaces, crew, tab pills, red alert) and adds CPU and memory in the title bar, a header on every pane, and motion: a power-up, a light that runs while agents work, rings when one hails you, a shimmer when one finishes.

## Palette

| Name | Colour | Used for |
| --- | --- | --- |
| black | `#000000` | the window and the terminals |
| panel | `#111419` | cards inside the frame |
| dark | `#2f3749` | title bars, pills, pane borders |
| mid | `#6d748c` | small labels, idle |
| light | `#9ea5ba` | the frame, the active pill, working |
| red | `#e7442a` | figures, the git branch, anything that needs you |
| amber | `#f2b24a` | done (not in the reference palette; added so done can be told from working) |

All labels are capitals in Antonio, which the mod brings with it.

## What you see

1. **Top bar, 44px.** A window drag area. On macOS the first 66px are left for the window buttons.
   - A dark pill bar, 28px tall with 14px ends, filling the width: the shown space's name in 18px light, then `nn · MACHINE · nn TABS` in 10px mid.
   - A 6px dark link, 48px long.
   - A second dark pill bar, as wide as its content: two meters, `CPU` and `MEM` (60px each: a 10px label, the percentage, and a 2px line that eases to each reading over 900ms and turns red above 85%), the stardate in red, and the clock in 14px light.
2. **Work area**, padding 4px/10px.
   - Tabs, 26px: dark pills with light text. The active one is light with black text. One that needs you is red and pulses. A working or finished tab has a small knob after its name. `+` is an outlined pill.
   - Panes: 1px dark border, light when focused, 10px radius, 6px gap. Each has a 20px header: the program on a small cap (light when the pane has the keyboard), the status word, the title, and the git branch in red.
3. **Right column, 220px.** The frame: light grey with 18px rounded top corners, padded 14px on the left and 8px on the right, running down into the bottom corner. Inside it, two cards (panel colour, 10px radius, 8px padding):
   - `SPACES`: a 10px mid label and the count as a 20px red figure, then one 24px pill per space (index in 10px, name in 12px, and a 10px round knob at the right, lit when the space has work or a finished agent). The shown space's pill is light with black text; one that needs you is red and pulses. Then an outlined `+ NEW SPACE` pill.
   - `CREW`: the label and count, then one 30px row per agent: an 8px by 18px status light, `PROGRAM · TAB` in 11px and `STATUS · SPACE` in 9px.
4. **Bottom bar, 34px.**
   - Left: a status line (`nn WORKING`, `nn NEED YOU`, `nn DONE`, `nn MACHINES`, and `⌘ SHIFT P` at the right) over an 8px light band. The status line's bottom-right corner is rounded 16px, cut into the frame's colour.
   - Right, 220px: the frame's corner, light grey with a 22px rounded bottom-right, with `MENU` and the gear (Herdr's settings) in black.

Status colours: working light, blocked red, done amber, idle mid.

## How it behaves

- **Power-up:** when the layout loads, every part is drawn once dark, then again 80ms later, and native transitions bring it in over about a second and a half: the space pills and the title link grow from the left (`transition("width")`, 520ms), the bars, cards and band fade in (`transition("opacity")`, 480ms), each 70ms after the one before.
- **Scanner:** while any agent works, a soft white light runs back and forth along the bottom band, faster with more agents working (`loop("left")` on a 200px gradient pair; the period is 11s less 1.5s per working agent, at least 4s).
- **Hail:** for 8s after an agent starts needing you, two red rings swell from its status light, from 6px to 50px, fading as they grow, one every 1.5s and one every 2.3s. Each ring is a round `div` whose width, height, left, top and opacity loop together.
- **Materialise:** when an agent stops working (`working` to `done` or `idle`), amber columns flicker over its crew row for 2.4s and its light is amber. The column looks for this, and for hails, every 400ms and redraws only when one starts or ends.
- **Red alert:** when an agent has needed you for `alert_after` seconds (a prop of the sidebar block, 120 by default), the frame's light grey turns red, as do the cards' and bars' greys, and the left title bar turns red and reads `ALERT CONDITION: RED · nn AGENTS NEED YOU` in black between two rows of nine small bars that pulse each at its own pace. Herdr's `blocked` sound plays once. It clears the moment no agent is blocked. The shared key is `lcars25.alert`.
- **Yellow alert:** while any agent is `done` and unseen, and there is no red alert, the left title bar shows an amber pill, `ALERT CONDITION: YELLOW · nn FINISHED, NOT SEEN`. The frame keeps its colour.
- **CPU and memory:** every 5s the top bar runs one shell script (`sh -c`) from `cx.spawn`, never while `herdr-app check` loads the mod. On macOS it reads `sysctl`, `vm_stat` and `ps`; elsewhere `nproc`, `/proc/meminfo` and `ps`. CPU is every process's share added up and divided over the cores.
- **Clicks and right-clicks:** as in LCARS 1.0. `MENU` in the corner opens the global menu; the gear opens the settings.
- **Clock and stardate** update every 15s.

## Built from

- **`layouts/lcars25.json`:** a root `column`, `"titlebar": "none"`, `"traffic_lights": [18, 22]`, the palette in `colors`, `"ui_font": "Antonio"`. Children: `top` (44px, `window_drag`), `body` (a row of `work`, then `sidebar` at 220px), `bottom` (34px). `work` holds `tabs` (26px) and `main`, whose pane has a `header` (`{ "content": { "mod": "lcars25", "props": { "part": "pane" } }, "height": 20 }`).
- **One mod, `mods/lcars25`**, with parts `top`, `side`, `tabs`, `pane`, `bottom` and the `machines` popup. It runs one program, the load script above, and makes no network or file reads.

## Done when

1. `herdr-app check ~/.config/herdr-app/mods/lcars25` passes.
2. `layout.switch {name: "lcars25"}` draws the frame in, and `herdr-app status` lists no errors.
3. `CPU` and `MEM` show figures within 5 seconds.
4. With an agent working, the light runs along the bottom band.
5. An agent that starts needing you shows rings for 8 seconds; with `alert_after` at 5 the frame turns red within 10 seconds.
6. An agent that stops working shimmers amber for about two seconds; left `done`, it raises the yellow alert pill.
7. Each pane shows its header, and the focused pane's cap is light.
