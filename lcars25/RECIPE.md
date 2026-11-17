# LCARS 25

A lighter, cooler LCARS frame, after the 25th-century displays: near-black navy, steel blue and ice, a crimson accent, thin arms and hairlines in place of heavy slabs. It keeps what [LCARS](../lcars/RECIPE.md) 1.0 does (spaces, crew, tab pills, red alert), shows this computer's CPU and memory quietly in the title area in place of 1.0's systems rail, and adds a header on every pane and a light that runs along the top arm while agents work.

## What you see

The window is `#05070c`. Labels are capitals in Antonio, which the mod brings with it. Blocks are separated by 3px.

1. **Top bar, 48px.** A window drag area.
   - A 52px steel (`#6f86c4`) corner with a 30px rounded top-left. This width is the spine: every row below has a cap this wide.
   - A 10px arm: steel 140px, ice (`#c7d3ea`) 36px, a steel-to-slate gradient filling the rest, crimson (`#e0503c`) 64px, steel 28px with rounded right ends. Under it a 2px hairline: steel 140px, `#2a3556` filling, crimson 95px.
   - The title area, with a 16px inner curve: the shown space's name in 22px ice, then `nn · MACHINE · nn TABS` in 10px, and at the right two small meters, `CPU` and `MEM`, then the stardate in amber (`#f2a23a`) and the clock. Each meter is 64px wide: a dim 10px label, the percentage, and a 2px line under them that eases to each new reading over 900ms and turns red above 85%. They read `--` before the first reading. On macOS the name starts 78px in, clear of the window buttons.
2. **Sidebar, 196px.** Every row is a 52px cap on the spine, then a strip.
   - Headings (`SPACES`, `CREW`), 16px: a slate (`#9fb2dc`) cap with the count, a dark (`#1c2540`) strip with the name.
   - Spaces, 30px: a cap with the index, rounded left, cycling slate, steel, ice, grey; a dark strip with the name. The shown space's strip is a slate-to-ice gradient with black text. A space that needs you has a red, pulsing cap; one with work or a finished agent has a small dot at the right.
   - `+ NEW SPACE`, 22px.
   - Crew, 32px: a cap in the status colour with `WRK`, `HAIL`, `DONE` or `STBY`, then `PROGRAM · TAB` and `STATUS · SPACE`.
   - The steel spine fills the rest, down to the bottom corner.
3. **Work area**, padding 6px/10px.
   - Tabs, 26px: dark pills with a status dot; the active one is ice with black text.
   - Panes: 1px `#2a3556` border, slate when focused, 6px radius and gap. Each has a 20px header: the program on a small cap (ice when the pane has the keyboard), the status word, the title, and the git branch in amber.
4. **Bottom bar, 34px.** A grey (`#7a86a8`) corner with the gear (Herdr's settings), a status line (`MENU`, the counts, `⌘ SHIFT P`), and an 8px arm.

Status colours: working `#8fc1ff`, blocked `#ff5a47`, done `#f2b24a`, idle `#7f8fd0`.

## How it behaves

- **Scanner:** while any agent works, a soft white light runs back and forth along the top arm, faster with more agents working (`loop("left")` on a 160px gradient pair; the period is 11s less 1.5s per working agent, at least 4s).
- **CPU and memory:** every 5s the top bar runs one shell script (`sh -c`) from `cx.spawn`, never while `herdr-app check` loads the mod. On macOS it reads `sysctl`, `vm_stat` and `ps`; elsewhere `nproc`, `/proc/meminfo` and `ps`. CPU is every process's share added up and divided over the cores.
- **Red alert, clicks and right-clicks:** as in LCARS 1.0. The alert's shared key is `lcars25.alert`. On red alert the steel and ice turn red.
- **Clock and stardate** update every 15s.

## Built from

- **`layouts/lcars25.json`:** as LCARS 1.0's, with this palette in `colors`, the block sizes above, and a pane `header` (`{ "content": { "mod": "lcars25", "props": { "part": "pane" } }, "height": 20 }`).
- **One mod, `mods/lcars25`**, with parts `top`, `side`, `tabs`, `pane`, `bottom` and the `machines` popup. It runs one program, the load script above, and makes no network or file reads.

## Done when

1. `herdr-app check ~/.config/herdr-app/mods/lcars25` passes.
2. `layout.switch {name: "lcars25"}` shows the frame, and `herdr-app status` lists no errors.
3. With an agent working, the light runs along the top arm.
4. Each pane shows its header, and the focused pane's cap is ice.
5. `CPU` and `MEM` show figures in the title area within 5 seconds.
6. Red alert behaves as in LCARS 1.0.
