# LCARS 25

An LCARS frame after the 25th-century displays of *Star Trek: Picard* (designed by Andrew Jarvis, [ion studio](https://ion.studio/25th-century-lcars)): black, three grey-blues and one red-orange. Its geometry follows their concept sheets: thick bands that loop around black panels with a large outer curve and a smaller inner one, change colour along their length, and carry small labels set to the right. A dark loop holds the sidebar. An open loop holds the terminals: its top band is the tab strip, its top-right corner and upper right edge are red. It does what [LCARS](../lcars/RECIPE.md) 1.0 does and adds CPU and memory, a header on every pane, and motion.

The earlier build of this layout (a grey column of cards on the right) is the tag `lcars25-1.0`.

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

Bands are 12px thick. A loop's outer corners are 24px, its inner ones 12px. Pieces are 4px apart; segments of one band 2px.

1. **Top, 60px.** Three pieces in a row.
   - **Over the sidebar, 232px:** a 22px mid-grey tab with a 24px top-left corner and the machine's name at its lower right (the window buttons sit on it on macOS), then the top of the sidebar's loop: dark, curving down both sides around `SPACES` and the count in red.
   - **Over the terminals:** the tab strip, 22px: one bar cut into segments, each at least 120px wide with `nn NAME` in 11px black at its lower right. The shown tab is light, the others mid grey, one that needs you red and pulsing; a working or finished tab has a small square before its name. The first segment has a round left end. Then a 40px `+` segment and a dark run filling the rest. Under the strip, a 2px light hairline and a 1px mid one, then a line with the alerts at the left and, set to the right, the `CPU` and `MEM` meters, the stardate, the clock and the shown space's name in 17px red.
   - **The cap, 40px:** red, with a 24px top-right corner. It is as tall as the strip across the top and 12px wide down the side, with a 12px inner curve.
2. **Middle.**
   - **Sidebar, 232px:** the loop's two dark sides. Between them, one 24px row per space (index at the left in mid grey, name set to the right, a 4px tick at the right edge that lights when the space has work or a finished agent). The shown space's row is light with black text; one that needs you is red and pulses. Then `+ NEW SPACE`, a heading for the crew (a dark bar, `CREW` and the count in red), and one 30px row per agent: `PROGRAM · TAB` and `STATUS · SPACE` set to the right, and a 4px status tick.
   - **Terminals:** panes with a 1px dark border, light when focused, 8px radius, 6px gap, each with a 20px header (the program on a small cap, the status word, the title, the git branch in red).
   - **Right edge, 12px:** red for the first 150px, continuing the cap, then mid grey.
3. **Bottom, 44px.**
   - Under the sidebar: the bottom of its loop, with the gear, `MENU` and `⌘ SHIFT P` inside the curve.
   - Under the terminals: a status line set to the right (`nn WORKING`, `nn NEED YOU`, `nn DONE`, `nn MACHINES`), then the lower band: light for 180px with a round left end, then mid grey.
   - The corner, 40px: mid grey with a 24px bottom-right corner and a 12px inner curve.

Status colours: working light, blocked red, done amber, idle mid.

## How it behaves

- **Power-up:** when the layout loads, every part is drawn once dark, then again 80ms later, and native transitions bring it in over about a second and a half: the tab segments and the lower band's light end grow from the left (`transition("width")`, 520ms), the loops, hairlines, cap and bands fade in (`transition("opacity")`, 480ms), each 70ms after the one before.
- **Scanner:** while any agent works, a soft white light runs back and forth along the lower band, faster with more agents working (`loop("left")` on a 200px gradient pair; the period is 11s less 1.5s per working agent, at least 4s).
- **Hail:** for 8s after an agent starts needing you, two red rings swell from its status tick, from 6px to 50px, fading as they grow, one every 1.5s and one every 2.3s. Each ring is a round `div` whose width, height, left, top and opacity loop together.
- **Materialise:** when an agent stops working (`working` to `done` or `idle`), amber columns flicker over its crew row for 2.4s and its light is amber. The column looks for this, and for hails, every 400ms and redraws only when one starts or ends.
- **Red alert:** when an agent has needed you for `alert_after` seconds (a prop of the sidebar block, 120 by default), every band turns a red (`#e7442a`, `#b8321c`, `#7d2012`; the cap and upper right edge go pale, `#ffb8a8`), and the line under the strip reads `ALERT CONDITION: RED · nn AGENTS NEED YOU` in red between two rows of nine small bars that pulse each at its own pace. Herdr's `blocked` sound plays once. It clears the moment no agent is blocked. The shared key is `lcars25.alert`.
- **Yellow alert:** while any agent is `done` and unseen, and there is no red alert, the line under the strip reads `ALERT CONDITION: YELLOW · nn FINISHED, NOT SEEN` in amber. The frame keeps its colour.
- **CPU and memory:** every 5s the title piece runs one shell script (`sh -c`) from `cx.spawn`, never while `herdr-app check` loads the mod. On macOS it reads `sysctl`, `vm_stat` and `ps`; elsewhere `nproc`, `/proc/meminfo` and `ps`. CPU is every process's share added up and divided over the cores.
- **Clicks and right-clicks:** as in LCARS 1.0. `MENU` under the sidebar opens the global menu; the gear opens the settings.
- **Clock and stardate** update every 15s.

## Built from

- **`layouts/lcars25.json`:** a root `column`, `"titlebar": "none"`, `"traffic_lights": [12, 4]`, the palette in `colors`, `"ui_font": "Antonio"`. Its children are three rows, each with `"gap": 4`:
  - `top` (`{ "px": 60 }`): `sidetop` (232px, `window_drag`), a column `head` of `tabs` (22px) and `title` (`window_drag`), and `cap` (40px, `window_drag`).
  - `body`: `sidebar` (232px, with the `alert_after` prop), `work` (a column with padding 4 holding `main`, whose pane has a `header`, `{ "content": { "mod": "lcars25", "props": { "part": "pane" } }, "height": 20 }`), and `band` (12px).
  - `foot` (`{ "px": 44 }`): `sidebot` (232px), `bottom`, and `corner` (40px).
- **One mod, `mods/lcars25`**, with parts `sidetop`, `side`, `sidebot`, `tabs`, `title`, `cap`, `band`, `bottom`, `corner`, `pane` and the `machines` popup. A band's inner curve is a background-coloured child with one rounded corner, set over the band's colour. It runs one program, the load script above, and makes no network or file reads.

## Done when

1. `herdr-app check ~/.config/herdr-app/mods/lcars25` passes.
2. `layout.switch {name: "lcars25"}` draws the frame in, and `herdr-app status` lists no errors.
3. `CPU` and `MEM` show figures within 5 seconds.
4. With an agent working, the light runs along the lower band.
5. An agent that starts needing you shows rings for 8 seconds; with `alert_after` at 5 the frame turns red within 10 seconds.
6. An agent that stops working shimmers amber for about two seconds; left `done`, it raises the yellow alert pill.
7. Each pane shows its header, and the focused pane's cap is light.
