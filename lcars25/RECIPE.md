# LCARS 25

An LCARS frame after the 25th-century displays of *Star Trek: Picard* (designed by Andrew Jarvis, [ion studio](https://ion.studio/25th-century-lcars)): black, three grey-blues and one red-orange. Its geometry follows their concept sheets: thick bands that loop around black panels with a large outer curve and a smaller inner one, change colour along their length, and carry small labels set to the right. A dark loop holds the sidebar. An open loop holds the terminals: its top band is the tab strip, its top-right corner and upper right edge are red. It does what [LCARS](../lcars/RECIPE.md) 1.0 does and adds CPU and memory, a header on every pane, and motion.

The earlier build of this layout (a grey column of cards on the right) is the tag `lcars25-1.0`.

## Palette

| Name | Colour | Used for |
| --- | --- | --- |
| black | `#000000` | the window and the terminals |
| panel | `#111419` | cards inside the frame |
| dark | `#2f3749` | title bars, pills, pane borders |
| mid | `#6d748c` | small labels, standing by (idle) |
| light | `#9ea5ba` | the frame, the active pill |
| red | `#e7442a` | figures, the git branch, anything that needs you |
| blue | `#66b8e0` | working (not in the reference palette; added so working can be told from the grey frame and from standing by) |
| amber | `#f2b24a` | done (not in the reference palette; added so done can be told from working) |
| violet | `#a48fe0` | an LFSI milestone underway (not in the reference palette); on the purple flare the frame uses `#a48fe0`, `#706198`, `#3b3351`, with `#d9ceff` for the accent and lettering |

All labels are capitals in Antonio, which the mod brings with it.

## What you see

Bands are 12px thick. A loop's outer corners are 24px, its inner ones 12px. Pieces are 4px apart; segments of one band 2px, everywhere. Labels sit 10px in from the right edge of whatever holds them. Type is one scale, Antonio throughout: 12px for codes, status lines and small print, 13px for names and labels, 14px for space names, 15px for the clock, 17px for counts and the red alert, 20px for the shown space's name; secondary lettering is the light grey, not the mid one.

1. **Top, 60px.** Three pieces in a row.
   - **Over the sidebar, 232px:** a 22px mid-grey tab with a 24px top-left corner and the machine's name at its lower right (the window buttons sit on it on macOS), then the top of the sidebar's loop: dark, curving down both sides around `SPACES` and the count in red.
   - **Over the terminals:** the tab strip, 22px: one bar cut into segments, each at least 120px wide with `nn NAME` in 13px black at its lower right. The shown tab is light, the others mid grey, one that needs you red and pulsing; a working or finished tab has a small square before its name. The first segment has a 20px top-left corner, where the loop's left band comes down from it. Then a 40px `+` segment and a dark run filling the rest, with a black card set into its right end: the shown space's number, machine and tab count in 12px red. Under the strip, a 2px light hairline whose last 280px are red, and a 1px mid one, then a line with the alerts at the left and, set to the right, the `CPU` and `MEM` meters (68px wide), a hairline, the clock, a hairline and the shown space's name in 20px red. The stardate is out of the title bar for now (the `stardate()` function is kept in `main.js`).
   - **The cap, 40px:** red, with a 24px top-right corner. It is as tall as the strip across the top and 12px wide down the side, with a 12px inner curve.
2. **Middle.**
   - **Sidebar, 232px:** the loop's two dark sides. Between them, one 24px row per space (index at the left in light grey, name set to the right, a 4px tick at the right edge that lights when the space has work or a finished agent). The shown space's row is light with black text; one that needs you is red and pulses. Then `+ NEW SPACE`, a heading for the crew (a dark bar, `CREW` and the count in red), and one 34px row per agent: the tab's name (with the program in front only when the tab has no name or a bare number) and `STATUS · SPACE` under it, set to the right, and a 4px status tick. Agents at work, waiting or finished come first, in that order, with their lettering bold; a 1px dark rule separates them from the ones standing by, which are regular weight. The keyboard order follows what is drawn.
   - **Left edge of the terminals' loop, 12px:** dark.
   - **Terminals:** panes with a 1px dark border, light when focused, 8px radius, 6px gap, each with a 20px header (the program on a small cap, the status icon and word, the LFSI phase when the tab has one, the title, the git branch in red).
   - **Right edge, 12px:** red for the first 150px, continuing the cap, then mid grey.
3. **Bottom, 44px.**
   - Under the sidebar: the bottom of its loop, with the gear, `MENU` and `⌘ SHIFT P` inside the curve.
   - Under the terminals: a status line set to the right (`nn WORKING`, `nn NEED YOU`, `nn DONE`, a hairline, `nn MACHINES`), each count led by a 6px square in its status colour, filled when the count is above zero and an outline when it is zero, then the lower band: dark for 180px with a round bottom-left corner, then mid grey. The left band runs down beside the status line, with a 12px inner curve.
   - The corner, 40px: mid grey with a 24px bottom-right corner and a 12px inner curve.

Status colours: working blue, blocked red, done amber, idle mid.

## How it behaves

- **Embedding:** the shown space is part of the frame, not a highlight inside it. Its row is light and reaches the sidebar loop's right band, and for the height of that row the band is light too, as is the left band of the terminals' loop beside it. So the row runs through one loop and into the other as a single bridge, broken only by the gaps between pieces. Both bands find the row the same way: 4px above the first row, then 26px per row.
- **Colour along a band:** bands are not one colour end to end. The sidebar loop's left side is dark beside the spaces, has an 18px red block where the crew's heading starts (the heading's dark bar meets it, so it reads as a branch off the band), and below that narrows to 8px of mid grey with a 2px dark line beside it. The grey of the terminals' right edge has the same thin line on its inner side.
- **Small tones:** the shown space's row and the shown tab carry a faint gradient between light (`#9ea5ba`) and a shade lighter (`#b9bfd0`). Tabs that are not shown alternate mid (`#6d748c`) and a shade darker (`#5f667d`).
- **Chips and bars:** each tab segment has a black chip in its lower left with the tab's number in 12px red. At the left of the line under the strip sit nine small bars, dark and still (every third a shade lighter); on red alert they turn red and pulse.
- **The delta:** in the lower left of the sidebar, behind the crew list, a delta 84px by 100px in `#171b26`, barely above black (`mods/lcars25/delta.svg`, one filled path). An homage.
- **Agent ladder:** on the right edge, between the red and the grey, one 8px tick per agent in its status colour; one that needs you pulses.

- **Power-up:** when the layout loads, every part is drawn once dark, then again 80ms later, and native transitions bring it in over about a second and a half: the tab segments and the lower band's light end grow from the left (`transition("width")`, 520ms), the loops, hairlines, cap and bands fade in (`transition("opacity")`, 480ms), each 70ms after the one before.
- **Scanner:** while an agent in the shown tab works, a soft white light runs back and forth along the lower band, faster with more agents working (`loop("left")` on a 200px gradient pair; the period is 11s less 1.5s per working agent, at least 4s). On a tab where nothing is working it does not run.
- **Hail:** for 8s after an agent starts needing you, two red rings swell from its status tick, from 6px to 50px, fading as they grow, one every 1.5s and one every 2.3s. Each ring is a round `div` whose width, height, left, top and opacity loop together, placed from a holder of no width just left of the tick so it stays centred at any zoom (the loops' values are not scaled by the app's zoom).
- **Breath:** spaces are quietly alive while any agent is working. On the shown space's row a paler gradient layer then fades in and out over about 4s, so its light seems to drift along the row; with the whole crew at rest the row is still, and so is the window (no animation runs when nothing is happening). A space that is not shown but has an agent working gets a faint dark-blue glow towards its right edge, and its tick fades between dim and lit, each space at a slightly different pace (2.6s to 3.8s) so they never pulse together. Only opacity moves, so zoom cannot misplace it.
- **Working bars:** while an agent in the shown tab is working, the nine bars under the tab strip come up to mid grey and each fades between 0.3 and 1 at its own slow pace (1.5s to 3s), so the row ripples without a pattern. Otherwise they sit dark and still; red alert outranks this.
- **Materialise:** when an agent finishes (`working` or `blocked` to `done` or `idle`; `blocked` counts because an agent that is answered and finishes between two looks never shows as working), its crew row's lettering and light turn amber, the second line reads DONE, and for 3.2s the lettering pulses slowly (opacity 0.4 to 1, 800ms each way). The pulse then stops and the row stays amber for as long as the agent is `done`, which is until you look at it; an agent you were already looking at goes back to grey when the pulse ends. Needing you is the red, faster-blinking light, so the two cannot be mistaken. Nothing polls for this or for hails: Herdr redraws the sidebar whenever an agent changes, and as it draws the sidebar compares each agent's status with the last one it saw. A one-shot timer (`cx.timer.after`) ends each pulse and each hail.
- **Red alert:** when an agent has needed you for `alert_after` seconds (a prop of the sidebar block, 120 by default), every band turns a red (`#e7442a`, `#b8321c`, `#7d2012`; the cap and upper right edge go pale, `#ffb8a8`), and the line under the strip reads `ALERT CONDITION: RED · nn AGENTS NEED YOU` in red between two rows of nine small bars that pulse each at its own pace. Herdr's `blocked` sound plays once. It clears the moment no agent is blocked. The shared key is `lcars25.alert`; shared values outlive the app, so a `"red"` found at start is set back to `"green"`.
- **Yellow alert:** while any agent is `done` and unseen, and there is no red alert or purple flare, the line under the strip reads `ALERT CONDITION: YELLOW · nn FINISHED, NOT SEEN` in amber. The frame keeps its colour.
- **Status icons:** each agent's status has an icon, `mods/lcars25/status-<status>.svg`, drawn like the gear (24 grid, 2px round strokes, text colour): working a pulse line, blocked (NEEDS YOU) the same signal arcs as LFSI's waiting on you, done a check in a circle, idle (STANDING BY) two upright bars. Each status has its own colour, used for its icon, its word, the crew row's light and the band tick: working blue, needs you red, done amber, standing by mid grey (the layout's `working` colour is the same blue). The icon sits before the status word, 12px in the pane header and 10px in the crew rows; a crew row in a milestone underway shows the phase's icon instead. They move a little, opacity only, eased: working 0.35 to 1 over 1.8s, needing you 0.4 to 1 over 0.9s, done 0.6 to 1 over 2.6s; standing by is still.
- **LFSI phase:** LFSI names a tab `<project> <milestone> · <state>`. The state is read from the tab name; recognised words are `open`, `building k/n`, `review k/n`, `verify k/n`, `integrating`, `waiting on you`, `shipped`, `stopped` and `ready`, and any other ending is no phase. Each has a 12px icon, `mods/lcars25/phase-<name>.svg` (24 grid, 2px round strokes, drawn in the text colour like the gear: open a flag, building three stacked blocks, review viewfinder corners with a scan line, verify a shield with a check, integrating merging branches, waiting on you signal arcs, shipped a double chevron up, stopped a square, ready a ring). The pane header shows the icon and the state in 12px bold after the status word, in violet for `open`, `building`, `review`, `verify` and `integrating` (the milestone is underway), red for `waiting on you`, amber for `shipped`, mid grey for `stopped` and light grey for `ready`.
- **Condition purple:** while any tab's milestone is underway, that tab's segment (when not shown and not needing you) is violet and breathes between 0.55 and 1 over 4.2s; its space's tick is violet; its agents' crew rows have violet lettering with the phase (`BUILDING 2/5`) for their status word, a slow dark-violet glow behind them, and a violet light and band tick, unless the agent needs you or has just finished. The status line gains `nn UNDERWAY` with a lit violet square, and when nothing outranks it the line under the strip reads `CONDITION PURPLE · nn MILESTONES UNDERWAY` in 14px violet. With no milestone underway none of this is drawn.
- **Purple flare:** when a tab's phase changes into `building`, `review` or `verify` from any other phase (a run starts or resumes), or into `shipped`, the whole frame turns violet for 10s, as red alert turns it red, and the line under the strip reads `ALERT CONDITION: PURPLE · <PROJECT MILESTONE> · RUN STARTED` (or `SHIPPED`) in 17px `#d9ceff` between two rows of nine violet bars breathing slowly (3s to 5s). A tab's first phase seen after start sets a baseline and raises nothing. The sidebar notices the change and shares `{ text, until }` under `lcars25.purple`, cleared when the time is up and at start. Red alert outranks the flare; the flare outranks yellow alert.
- **CPU and memory:** the title piece runs shell scripts (`sh -c`) from `cx.spawn`, never while `herdr-app check` loads the mod. One runs once, for what cannot change: the cores, the memory fitted and the page size (`sysctl` on macOS, `nproc` elsewhere). The other runs every 5s: `vm_stat` and `ps` on macOS, `/proc/meminfo` and `ps` elsewhere. CPU is every process's share added up and divided over the cores. The piece is redrawn only when a meter's whole-number percentage changes. A reading that fails empties the meters back to `--` and is logged once.
- **Clicks and right-clicks:** as in LCARS 1.0. `MENU` under the sidebar opens the global menu; the gear opens the settings.
- **The clock** is redrawn on the minute.

## Built from

- **`layouts/lcars25.json`:** a root `column`, `"titlebar": "none"`, `"traffic_lights": [12, 4]`, the palette in `colors`, `"ui_font": "Antonio"`. Its children are three rows, each with `"gap": 4`:
  - `top` (`{ "px": 60 }`): `sidetop` (232px, `window_drag`), a column `head` of `tabs` (22px) and `title` (`window_drag`), and `cap` (40px, `window_drag`).
  - `body`: `sidebar` (232px, with the `alert_after` prop), `port` (12px), `work` (a column with padding 4 with padding 4 by 2 holding `main`, whose pane has a `header`, `{ "content": { "mod": "lcars25", "props": { "part": "pane" } }, "height": 20 }`), and `band` (12px).
  - `foot` (`{ "px": 44 }`): `sidebot` (232px), `bottom`, and `corner` (40px).
- **One mod, `mods/lcars25`**, with parts `sidetop`, `side`, `sidebot`, `tabs`, `title`, `cap`, `band`, `bottom`, `corner`, `port`, `pane` and the `machines` popup. A band's inner curve is a background-coloured child with one rounded corner, set over the band's colour. It runs one program, `sh`, for the load scripts above, and makes no network or file reads.

## Done when

1. `herdr-app check ~/.config/herdr-app/mods/lcars25` passes.
2. `layout.switch {name: "lcars25"}` draws the frame in, and `herdr-app status` lists no errors.
3. `CPU` and `MEM` show figures within 5 seconds.
4. With an agent working, the light runs along the lower band.
5. An agent that starts needing you shows rings for 8 seconds; with `alert_after` at 5 the frame turns red within 10 seconds.
6. An agent that stops working shimmers amber for about two seconds; left `done`, it raises the yellow alert pill.
7. Each pane shows its header, and the focused pane's cap is light.
8. A tab renamed `TEST v1 · open` shows the open icon in its panes' headers and raises `CONDITION PURPLE`; renamed `TEST v1 · building 1/3` the frame turns violet for 10 seconds with `RUN STARTED`; renamed `TEST v1 · shipped`, again with `SHIPPED`, and the tab leaves the condition.
