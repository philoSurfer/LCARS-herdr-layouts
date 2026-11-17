// LCARS 25: an LCARS frame after the 25th-century displays (black, grey-blues, one red-orange). Its geometry is theirs:
// thick bands that loop around black panels with a large outer curve and a smaller inner one, change colour along
// their length, and carry small right-aligned labels. One mod draws every piece; the layout says which with
// props().part. Around the sidebar, a dark loop: "sidetop", "side", "sidebot". Around the terminals, an open loop:
// "tabs" (the strip of tab segments along the top), "title" (hairlines, alerts, load, clock, the space's name), "cap"
// (the red top-right corner), "band" (the right edge), "bottom" (the status line and lower band) and "corner". "pane"
// is each pane's header strip, and as a popup the mod is "machines".
import { View, div, svg, PathBuilder, Background } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, agents, machines, panes, run, props, setAgentOrder, window as appWindow, openOverlay, closeOverlay, exec,
  shared, setShared, playSound, checking } from "herdr";

// The palette of the 25th-century displays: black, three grey-blues and one red-orange. Amber is ours, for "done".
const P = {
  bg: "#000000", black: "#000000", panel: "#111419", dark: "#2f3749", mid: "#6d748c", light: "#9ea5ba", red: "#e7442a",
  white: "#e6e9f2", amber: "#f2b24a", accent: "#e7442a", // accent: the stretch of the loop that is red
  glint: "#b9bfd0", // a shade lighter than light: where a lit slab's gradient ends
  mid2: "#5f667d", // a shade darker than mid: every other segment of a band, so neighbours differ a little
  ghost: "#171b26", // barely above black: the watermark
};
// the frame on red alert: the light grey turns red, as on the ALERT CONDITION: RED displays. Status colours stay.
const RED = { ...P, light: "#e7442a", mid: "#b8321c", dark: "#7d2012", accent: "#ffb8a8", glint: "#ff6a4d", mid2: "#a32c18",
  ghost: "#2a0b06" };
const STATUS = { working: "#9ea5ba", blocked: "#e7442a", done: "#f2b24a", idle: "#6d748c" };
const WORD = { working: "WORKING", blocked: "NEEDS YOU", done: "DONE", idle: "STANDING BY" };
const T = 12; // a band's thickness
const R = 24; // a loop's outer corner
const r = 12; // and its inner one
const SIDE = 232; // the sidebar's width (the layout's too)
const INNER = SIDE - 2 * T - 6; // the width of a row inside the sidebar's loop
const ROW = 24; // a space's row
const FIRST = 4; // the room above the first row
const STRIP = 22; // the tab strip's height, which the red cap continues
const GAP = 2; // background between the segments of a band
const NEW = 20; // the "+ NEW SPACE" row under the spaces
const HEAD = 18; // the crew's heading, and the red block on the band it branches from
const HEAD_TOP = 6; // the room above that heading

const up = (s) => String(s ?? "").toUpperCase();
const two = (n) => String(n).padStart(2, "0");

// not drawn at the moment: the stardate is out of the title bar for now
function stardate(now) {
  // a made-up but steady stardate: year, then the day's fraction of the year
  const d = new Date(now);
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return `${d.getUTCFullYear() - 1920}${(((now - start) / 864e5) * 2.7397).toFixed(1).padStart(6, "0")}`;
}

// Red alert: an agent has waited on the human for alert_after seconds (the sidebar's prop, 120 by default). The sidebar
// notes when each agent started needing you (see track), checks every WATCH ms and shares the answer under ALERT, which
// redraws every part. The frame is red only while that says so and an agent is still blocked, so answering clears it at
// once.
const ALERT = "lcars25.alert";
const WATCH = 5000;
const alert = () => shared(ALERT) === "red" && agents().some((a) => a.status === "blocked");
// yellow alert needs no clock: it is on while any agent is done and unseen, and red alert outranks it
const yellow = () => !alert() && agents().some((a) => a.status === "done");
const frame = () => (alert() ? RED : P);

// This computer's load, for the title area, never while `herdr-app check` runs. What cannot change (the cores, the
// memory fitted, the page size) is read once by SYS_ONCE. SYS_SCRIPT then runs every SYS ms and reads only what moves;
// its first argument is the page size, which only macOS gives.
const SYS = 5000;
const SYS_ONCE = String.raw`
case "$(uname)" in
Darwin) echo "ncpu $(sysctl -n hw.ncpu)"; echo "memtotal $(sysctl -n hw.memsize)"; echo "pagesize $(sysctl -n hw.pagesize)" ;;
*) echo "ncpu $(nproc)" ;;
esac
`;
const SYS_SCRIPT = String.raw`
if [ -n "$1" ]; then
  vm_stat | awk -v ps="$1" '/Pages active|Pages wired down|occupied by compressor/ {gsub(/\./,"",$NF); s+=$NF} END {printf "memused %.0f\n", s*ps}'
else
  awk '/MemTotal/ {t=$2} /MemAvailable/ {a=$2} END {printf "memtotal %.0f\nmemused %.0f\n", t*1024, (t-a)*1024}' /proc/meminfo
fi
ps -A -o %cpu= | awk '{s+=$1} END {print "cpusum " s+0}'
`;
// runs a script and gives its "name number ..." lines as { name: [numbers] }
async function read(script, ...args) {
  const r = await exec("sh", ["-c", script, "sh", ...args], { timeout: 4000 });
  const v = {};
  for (const line of r.stdout.split("\n")) { const [k, ...rest] = line.trim().split(/\s+/); if (k) v[k] = rest.map(Number); }
  return v;
}
// one reading, as shares between 0 and 1; `once` is what SYS_ONCE gave. Throws when the script's answer is not numbers.
async function systems(once) {
  const v = { ...once, ...(await read(SYS_SCRIPT, String(once.pagesize?.[0] ?? ""))) };
  const cpusum = v.cpusum?.[0], used = v.memused?.[0], total = v.memtotal?.[0], ncpu = v.ncpu?.[0] || 1;
  if (![cpusum, used, total].every(Number.isFinite) || !(total > 0)) throw new Error("no figures in the script's answer");
  const frac = (x) => Math.max(0, Math.min(1, x));
  return { cpu: frac(cpusum / (ncpu * 100)), mem: frac(used / total) };
}
// what the meters print for a reading: a new reading that prints the same is not worth a redraw
const figures = (sys) => (sys ? `${Math.round(sys.cpu * 100)} ${Math.round(sys.mem * 100)}` : "--");
// a layer that fills its (relative) parent with a left-to-right gradient
const RECT = () => PathBuilder.fill().move_to("0%", "0%").line_to("100%", "0%").line_to("100%", "100%").line_to("0%", "100%").close().build();
const gradient = (from, to) => window.paint_path(RECT(), Background.linear_gradient(90, from, to)).absolute().top(0).left(0).size_full();

// Breath: a gradient layer over a (relative) row whose opacity swings slowly between nothing and `to`. Only opacity
// moves, so the app's zoom cannot put it out of place.
const breath = (id, from, to_, to, period) => div().id(id).absolute().top(0).left(0).size_full()
  .loop("opacity", { from: 0, to, period, easing: "ease-in-out" }).child(gradient(from, to_));

// Power-up: a part is drawn once with `on` false, then again 80ms later with it true, and these two carry every block
// from nothing to its place, the i-th a little after the one before: bars grow from the left, the rest fades in.
const grow = (el, on, w, i) => el.w(on ? w : 0).overflow_hidden().transition("width", { duration: 520, delay: i * 70, easing: "ease-out" });
const fade = (el, on, i) => el.opacity(on ? 1 : 0).transition("opacity", { duration: 480, delay: 200 + i * 70 });

// Materialise: for GLOW ms after an agent finishes, its crew row's lettering turns amber and pulses slowly. The pulse
// then stops and the lettering stays amber for as long as the agent is "done", which is until you look at it.
const GLOW = 3200;

// Hail: for HAIL ms after an agent starts needing you, two rings swell from its status light and fade as they grow,
// each at its own pace. A ring is a round outline whose size, place and opacity swing together. It is placed from a
// holder of no width just left of the tick, so its small offsets keep it centred whatever the zoom.
const HAIL = 8000;
const ring = (key, n, period) => {
  const swing = (from, to) => ({ from, to, period, easing: "ease-out" });
  return div().id(`hail-${key}-${n}`).absolute().rounded_full().border(2).border_color(P.red)
    .loop("width", swing(6, 50)).loop("height", swing(6, 50))
    .loop("left", swing(5, -17)).loop("top", swing(9, -13)).loop("opacity", swing(1, 0));
};

// Embedding: the shown space is part of the frame, not a highlight inside it. Where its row meets a vertical band the
// band is light, not dark, so the row runs on through the sidebar's loop and into the terminals' loop as one bridge.
// `plug` draws such a band: `color` all the way down, but light for the height of the row numbered `at`.
function plug(id, f, at, color) {
  const band = v_flex().id(id).w(T).h_full().flex_none().gap(GAP);
  if (at < 0) return band.child(div().w_full().flex_1().bg(color));
  const y = FIRST + at * (ROW + GAP);
  return band
    .child(div().w_full().h(y - GAP).flex_none().bg(color))
    .child(div().id(`${id}-bridge`).w_full().h(ROW).flex_none().bg(f.light))
    .child(div().w_full().flex_1().bg(color));
}

// Herdr's menu mod at the pointer: tab is "space", "tab", "pane" or "global"
const menu = (tab, target) => openOverlay({ mod: "menu", kind: "popup", width: 200, height: 260, props: { tab, target } });
// Herdr's new menu: a terminal, each installed agent, a new space, worktrees
const newMenu = () => openOverlay({ mod: "new-menu", kind: "popup", width: 250, height: 512 });
// a right-click handler that opens one menu; stopping the press keeps the bar behind from opening its own
const onRight = (open) => (_e, cx) => { cx.stop_propagation(); open(); };
const globalMenu = () => menu("global", {});
// where a new space goes, when there is more than this computer
function newSpace() {
  const away = machines().filter((m) => m.name);
  if (!away.length) return run("space.new", {});
  openOverlay({ mod: "lcars25", kind: "popup", width: 230, height: 46 + 33 * (away.length + 1),
    frame: "none", props: { part: "machines" } });
}

export default class Lcars25 extends View {
  init(_props, cx) {
    this.now = Date.now();
    const part = _props?.part ?? props()?.part;
    if (part === "title") {
      this.tick(cx);
      if (!checking()) { this.measure(cx); cx.timer.every(SYS, (cx) => this.measure(cx)); }
    }
    if (part === "side") {
      this.was = new Map(); // agent address -> its status at the last look
      this.since = new Map(); // agent address -> when it started needing you, for as long as it does
      this.glow = new Map(); // agent address -> when it stopped working
      this.hail = new Map(); // agent address -> when it started needing you, for HAIL ms
      // a red alert kept from the last run says nothing now: nobody's wait has been timed yet
      if (!checking() && shared(ALERT) === "red") setShared(ALERT, "green");
      cx.timer.every(WATCH, (cx) => this.watch(cx));
    }
    // the power-up: every part of the frame starts dark. A pane's header and the popup have nothing to bring in.
    this.on = part === "pane" || part === "machines";
    if (!this.on) cx.timer.after(80, (cx) => { this.on = true; cx.notify(); });
  }

  // the clock shows minutes, so it is redrawn on the minute and not in between
  tick(cx) {
    cx.timer.after(60000 - (Date.now() % 60000) + 20, (cx) => { this.now = Date.now(); cx.notify(); this.tick(cx); });
  }

  // Looks at every agent's status against the last look, and notes what follows from a change: when it started needing
  // you (for the red alert and the hail) and when it finished (for the glow). Herdr redraws the sidebar whenever an
  // agent changes, so side() calls this as it draws and nothing has to poll; a timer started here ends each glow and
  // hail. Returns true when a glow or a hail started or ended, which is when a caller that is not drawing must redraw.
  track(cx) {
    const now = Date.now();
    const live = new Set();
    let changed = false;
    const end = (ms) => cx.timer.after(ms + 30, (cx) => { if (this.track(cx)) cx.notify(); });
    for (const a of agents()) {
      live.add(a.address);
      const before = this.was.get(a.address);
      if (before === a.status) continue;
      this.was.set(a.address, a.status);
      if (a.status === "blocked") {
        this.since.set(a.address, now);
        if (before) { this.hail.set(a.address, now); end(HAIL); changed = true; } // not one that was waiting when we started
      } else {
        this.since.delete(a.address);
        if (this.hail.delete(a.address)) changed = true;
      }
      // from working, or from needing you: an agent that was answered and finished between two looks never shows as working
      if ((before === "working" || before === "blocked") && (a.status === "done" || a.status === "idle")) {
        this.glow.set(a.address, now); end(GLOW); changed = true;
      }
    }
    for (const [k, at] of [...this.glow]) if (now - at >= GLOW) { this.glow.delete(k); changed = true; }
    for (const [k, at] of [...this.hail]) if (now - at >= HAIL) { this.hail.delete(k); changed = true; }
    // an agent that has gone leaves nothing behind
    for (const m of [this.was, this.since, this.glow, this.hail]) for (const k of [...m.keys()]) if (!live.has(k)) m.delete(k);
    return changed;
  }

  // sets the shared alert when it changes; the alert sound plays once, as the frame turns red. It looks at the agents
  // itself first, in case the sidebar was hidden and not drawn when one changed.
  watch(cx) {
    if (this.track(cx)) cx.notify();
    const now = Date.now();
    const longest = Math.max(0, ...[...this.since.values()].map((at) => now - at));
    const after = (Number(props()?.alert_after) || 120) * 1000;
    const next = this.since.size && longest >= after ? "red" : "green";
    if (next === (shared(ALERT) ?? "green")) return;
    setShared(ALERT, next);
    if (next === "red" && !checking()) playSound("blocked");
  }

  // takes a reading and redraws only if the meters would print something else. A reading that fails empties the
  // meters, so an old figure never stands as the current one, and is logged once until readings work again.
  measure(cx) {
    if (this.measuring && Date.now() - this.measuring < 20000) return; // an earlier reading is still out
    this.measuring = Date.now();
    cx.spawn(async (cx) => {
      let sys = null;
      try {
        this.once ??= await read(SYS_ONCE);
        sys = await systems(this.once);
        this.failed = false;
      } catch (e) {
        if (!this.failed) console.log(`lcars25: no load reading: ${e?.message ?? e}`);
        this.failed = true;
      }
      this.measuring = 0;
      const redraw = figures(sys) !== figures(this.sys);
      this.sys = sys;
      if (redraw) cx.notify();
    });
  }

  render(cx) {
    const part = props()?.part;
    const draw = { sidetop: "sideTop", side: "side", sidebot: "sideBottom", tabs: "tabs", title: "title", cap: "cap", band: "band",
      bottom: "bottom", corner: "corner", port: "port", pane: "pane", machines: "machines" }[part];
    return draw ? this[draw](cx) : div().child(`lcars25: unknown part ${part}`);
  }

  machines() {
    const close = () => closeOverlay(props()?.overlay);
    const all = [{ name: null, layout: "ready" }, ...machines().filter((m) => m.name)];
    const row = (m) => {
      const ready = m.layout === "ready";
      return h_flex().id(`new-space-${m.name ?? "local"}`).w_full().h(24).flex_none().items_center().justify_end().px(8)
        .text_color(ready ? P.light : P.mid).text_size(14).font_weight(700)
        .when(ready, (el) => el.cursor_pointer().hover((st) => st.bg(P.light).text_color(P.black))
          .on_click(() => { close(); run("space.new", m.name ? { machine: m.name } : {}); }))
        .child(up(`${m.name ?? "this computer"}${ready ? "" : " · " + m.layout}`));
    };
    return div().size_full().bg(P.dark).rounded(R).p(T).child(
      v_flex().size_full().bg(P.black).rounded(r).p(6).gap(GAP)
        .child(h_flex().w_full().justify_end().px(8).text_color(P.red).text_size(13).font_weight(700).child("NEW SPACE ON"))
        .children(all.map(row)));
  }

  // The top of the sidebar's loop: a grey tab with this machine's name, then the dark band curving down both sides
  // around the heading.
  sideTop() {
    const f = frame(), on = this.on;
    const space = spaces().find((s) => s.active);
    return v_flex().id("sidetop").size_full().bg(P.bg).gap(4).on_mouse_down("right", onRight(globalMenu))
      .child(fade(div().id("machine").w_full().h(STRIP).flex_none().bg(f.mid).rounded_tl(R).rounded_tr(4).flex().items_end().justify_end()
        .px(10).pb(2).text_color(P.black).text_size(13).font_weight(700).child(up(space?.machine ?? "this computer")), on, 0))
      .child(fade(div().id("loop-top").w_full().flex_1().min_h(0).bg(f.dark).rounded_tl(R).rounded_tr(R).pt(T).px(T), on, 1)
        .child(h_flex().size_full().bg(P.black).rounded_tl(r).rounded_tr(r).items_end().justify_end().gap(8).px(10)
          .child(div().text_color(f.light).text_size(13).font_weight(700).child("SPACES"))
          .child(div().text_color(P.red).text_size(17).font_weight(700).child(two(spaces().length)))));
  }

  // The sidebar: the loop's two sides, with spaces then crew between them, every label set to the right.
  side(cx) {
    const f = frame(), on = this.on;
    const list = spaces();
    const crew = agents();
    this.track(cx); // notes who just started needing you and who just finished, for the alert, the hail and the glow
    const atWork = crew.some((a) => a.status === "working");
    // at work or waiting first, then the ones standing by; the keyboard order follows what is drawn
    const rank = { blocked: 0, working: 1, done: 2 };
    const sorted = [...crew].sort((a, b) => (rank[a.status] ?? 3) - (rank[b.status] ?? 3));
    const live = (a) => a.status in rank;
    setAgentOrder(sorted.map((a) => a.address));
    const space = (s, i) => {
      const hail = s.status === "blocked" && !s.active;
      const lit = s.active || hail;
      const busy = s.status === "working";
      return fade(h_flex().id(`space-${s.id}`).relative().w_full().h(ROW).flex_none().items_center().gap(6).pl(6).cursor_pointer()
        .bg(s.active ? f.light : hail ? P.red : P.black), on, 2 + i)
        .when(s.active, (el) => el.child(gradient(f.glint, f.light))) // lighter at the left, settling into the bridge's colour
        // alive, quietly, while any agent works: the shown space's light drifts along its row, and a space at work
        // elsewhere glows towards the bridge. With the whole crew at rest nothing moves, so the window can rest too.
        .when(s.active && atWork, (el) => el.child(breath(`space-drift-${s.id}`, P.white, f.light, 0.45, 4200)))
        .when(busy && !lit, (el) => el.child(breath(`space-work-${s.id}`, P.black, f.dark, 0.7, 2600 + (i % 4) * 400)))
        .hover((st) => st.opacity(0.8))
        .when(hail, (el) => el.loop("opacity", { from: 0.5, to: 1, period: 900 }))
        .on_click(() => run("space.select", { id: s.id }))
        .on_mouse_down("right", onRight(() => menu("space", { id: s.id })))
        .child(div().relative().flex_none().text_color(lit ? P.black : f.light).text_size(12).font_weight(700)
          .child(`${two(s.index)}${s.machine ? " · " + up(s.machine).slice(0, 4) : ""}`))
        .child(div().relative().flex_1().min_w(0).flex().justify_end().text_color(lit ? P.black : f.light).text_size(14).font_weight(700)
          .child(div().truncate().child(up(s.name))))
        // the tick at the right edge: lit when something in the space is working or done
        .child(div().id(`space-tick-${s.id}`).relative().w(4).h_full().flex_none().bg(s.status === "done" ? P.amber : busy ? (s.active ? P.black : f.light) : lit ? P.black : f.dark)
          .when(busy, (el) => el.loop("opacity", { from: 0.3, to: 1, period: 2600 + (i % 4) * 400 })));
    };
    const member = (a) => {
      const glow = this.glow.has(a.address); // it just stopped working
      const fin = glow || a.status === "done"; // finished: pulsing just now, or waiting to be seen
      const c = fin ? P.amber : STATUS[a.status] ?? f.mid;
      // the tab's own name leads; a bare number or no name keeps the program in front of it
      const name = a.tab_name && !/^\d+$/.test(a.tab_name) ? up(a.tab_name) : up(`${a.program?.name ?? a.app ?? "agent"} · ${a.tab_name ?? ""}`).replace(/ · $/, "");
      const strong = a.status !== "idle" || a.focused || fin;
      const tone = a.status === "blocked" || fin ? c : f.light;
      const word = fin ? "DONE" : WORD[a.status] ?? up(a.status);
      return h_flex().id(`agent-${a.address}`).relative().w_full().h(34).flex_none().gap(8).items_center().pl(4).cursor_pointer()
        .hover((st) => st.opacity(0.8))
        .on_click(() => run("agent.focus", { terminal: a.address }))
        .on_mouse_down("right", onRight(() => menu("pane", { pane: a.pane, terminal: a.address })))
        .child(v_flex().id(`agent-words-${a.address}-${glow ? "pulse" : "still"}`).relative().flex_1().min_w(0).items_end()
          .when(glow, (el) => el.loop("opacity", { from: 0.4, to: 1, period: 800, easing: "ease-in-out" }))
          .child(div().max_w_full().text_size(13).when(strong, (el) => el.font_weight(700)).text_color(fin ? P.amber : a.focused ? P.white : f.light).truncate()
            .child(name))
          .child(h_flex().max_w_full().gap(4).text_size(11).text_color(tone)
            .child(div().flex_none().when(strong, (el) => el.font_weight(700)).child(word))
            .child(div().min_w(0).truncate().child(`· ${up(a.space_name)}`))))
        .child(div().relative().w(0).h(24).flex_none()
          .when(this.hail.has(a.address), (el) => el.child(ring(a.address, 0, 1500)).child(ring(a.address, 1, 2300))))
        .child(div().id(`agent-light-${a.address}`).relative().w(4).h(30).flex_none().bg(c)
          .when(a.status === "blocked", (el) => el.loop("opacity", { from: 0.35, to: 1, period: 700 })));
    };
    const rows = [];
    sorted.forEach((a, i) => {
      if (i > 0 && !live(a) && live(sorted[i - 1])) rows.push(h_flex().id("crew-rule").w_full().h(7).flex_none().items_center().pl(6).pr(10).child(div().flex_1().h(1).bg(f.dark)));
      rows.push(member(a));
    });
    // where the crew's heading starts, measured as the rows above it are laid out
    const crewAt = FIRST + list.length * (ROW + GAP) + NEW + GAP + HEAD_TOP;
    return h_flex().id("side").size_full().bg(P.bg).on_mouse_down("right", onRight(globalMenu))
      // the loop's left side changes along its length: dark beside the spaces, a red block where the crew's heading
      // branches off it, then a narrower grey band with a thin line beside it
      .child(v_flex().w(T).h_full().flex_none().gap(GAP)
        .child(div().w_full().h(crewAt - GAP).flex_none().bg(f.dark))
        .child(div().w_full().h(HEAD).flex_none().bg(f.accent))
        .child(h_flex().w_full().flex_1().gap(GAP).child(div().w(8).h_full().bg(f.mid)).child(div().w(2).h_full().bg(f.dark))))
      .child(v_flex().relative().flex_1().min_w(0).h_full().bg(P.black).pl(GAP).pt(FIRST).gap(GAP).overflow_hidden()
        // an homage, kept very quiet: a delta in the lower left, barely above black
        .child(svg("mods/lcars25/delta.svg").absolute().left(14).bottom(10).w(84).h(100).text_color(f.ghost))
        .children(list.map(space))
        .child(h_flex().id("space-new").w_full().h(NEW).flex_none().items_center().justify_end().pr(10)
          .text_color(f.light).text_size(12).font_weight(700).cursor_pointer().hover((st) => st.text_color(P.white))
          .on_click(() => newSpace()).on_mouse_down("right", onRight(newSpace)).child("+ NEW SPACE"))
        // the crew's heading: a bar of the band's colour across the panel, the label and the count at its right
        .child(fade(h_flex().id("crew-heading").w_full().h(HEAD).flex_none().mt(HEAD_TOP).mb(2).items_center().gap(8), on, 3 + list.length)
          .child(div().flex_1().h(T).bg(f.dark)) // it meets the red block on the band: a branch
          .child(div().flex_none().text_color(f.light).text_size(13).font_weight(700).child("CREW"))
          .child(div().flex_none().pr(10).text_color(P.red).text_size(17).font_weight(700).child(two(crew.length))))
        .children(rows))
      .child(plug("side-edge", f, list.findIndex((s) => s.active), f.dark));
  }

  // The left edge of the terminals' loop: dark, and light where the shown space's row arrives from the sidebar.
  port() {
    const f = frame();
    return plug("port", f, spaces().findIndex((s) => s.active), f.dark).bg(P.bg);
  }

  // The bottom of the sidebar's loop, with MENU and the gear (Herdr's settings) inside its curve.
  sideBottom() {
    const f = frame(), on = this.on;
    return fade(div().id("loop-bottom").size_full().bg(f.dark).rounded_bl(R).rounded_br(R).pb(T).px(T), on, 4)
      .on_mouse_down("right", onRight(globalMenu))
      .child(h_flex().size_full().bg(P.black).rounded_bl(r).rounded_br(r).items_start().justify_between().px(10).pt(4)
        .text_size(13).font_weight(700)
        .child(h_flex().id("menu").gap(8).items_center().text_color(f.light).cursor_pointer().hover((st) => st.opacity(0.7))
          .on_click(() => menu("global", {}))
          .child(div().id("settings").cursor_pointer().hover((st) => st.opacity(0.6))
            .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
            .on_mouse_down("right", (_e, cx) => cx.stop_propagation())
            .on_click(() => run("app.settings"))
            .child(svg("mods/lcars25/gear.svg").size(13).text_color(f.light)))
          .child("MENU"))
        .child(div().id("palette").text_color(f.light).text_size(12).cursor_pointer().hover((st) => st.opacity(0.7))
          .on_click(() => run("app.palette")).child(`${appWindow()?.platform === "macos" ? "⌘" : "CTRL"} SHIFT P`)));
  }

  // The top band of the terminals' loop is the tab strip: one bar cut into segments by thin gaps, each tab's name set
  // at its lower right. The shown tab is light, the others mid grey, one that needs you red; a dark run fills the rest.
  tabs() {
    const f = frame(), on = this.on;
    const space = spaces().find((s) => s.active);
    const shown = (space?.tabs ?? []).filter((t) => !t.settled);
    const seg = (t, i) => {
      const hail = t.status === "blocked" && !t.active;
      return grow(h_flex().id(`tab-${t.id}`).relative().h_full().flex_none().bg(t.active ? f.light : hail ? P.red : i % 2 ? f.mid2 : f.mid).items_end().justify_end()
        .gap(6).px(10).pb(2).text_color(P.black).text_size(13).font_weight(700).cursor_pointer(), on, Math.max(120, 60 + up(t.name).length * 7), i)
        .when(i === 0, (el) => el.rounded_tl(STRIP - 2))
        .hover((st) => st.opacity(0.8))
        .when(hail, (el) => el.loop("opacity", { from: 0.5, to: 1, period: 800 }))
        .on_click(() => run("tab.select", { id: t.id }))
        .on_mouse_down("right", onRight(() => menu("tab", { id: t.id, space: space.id })))
        .when(t.active, (el) => el.child(gradient(f.light, f.glint)))
        // a black chip set into the segment's lower left, with the tab's number in red
        .child(div().relative().flex_none().h(14).px(5).mb(1).bg(P.black).flex().items_center().text_color(P.red).text_size(12).child(two(t.index)))
        .child(div().flex_1())
        .when(t.status === "working" || t.status === "done", (el) => el
          .child(div().relative().w(8).h(8).mb(3).flex_none().bg(t.status === "done" ? P.amber : P.black)))
        .child(div().relative().flex_none().child(up(t.name)));
    };
    return h_flex().id("tab-bar").size_full().bg(P.bg).gap(GAP).on_mouse_down("right", onRight(globalMenu))
      .children(shown.map(seg))
      .child(h_flex().id("tab-new").h_full().w(40).flex_none().bg(f.mid).items_end().justify_end().px(10).pb(1)
        .text_color(P.black).text_size(17).font_weight(700).cursor_pointer().hover((st) => st.bg(f.light))
        .when(!shown.length, (el) => el.rounded_tl(STRIP - 2))
        .on_click(() => newMenu()).on_mouse_down("right", onRight(newMenu)).child("+"))
      // the dark run, with a black card set into it: the shown space's number, machine and tab count in red
      .child(fade(h_flex().id("tab-run").flex_1().min_w(0).h_full().bg(f.dark).items_center().justify_end().pr(10), on, shown.length + 1)
        .child(div().flex_none().h(16).px(8).bg(P.black).flex().items_center().text_color(P.red).text_size(12).font_weight(700)
          .child(space ? `${two(space.index)} · ${up(space.machine ?? "this computer")} · ${two(shown.length)} TABS` : "")));
  }

  // Under the strip: two hairlines, then a line with the alerts at the left and, set to the right, the load, the
  // clock and the shown space's name in red, between hairlines.
  title() {
    const f = frame(), red = alert(), on = this.on;
    const space = spaces().find((s) => s.active);
    const crew = agents();
    const need = crew.filter((a) => a.status === "blocked").length;
    const done = crew.filter((a) => a.status === "done").length;
    const sys = this.sys;
    const rule = () => div().flex_none().w(1).h(16).bg(f.dark); // a hairline between the load, the clock and the name
    // this computer's load, kept quiet: a dim label, the figure, and a 2px line that eases to each new reading
    const meter = (id, label, share) => v_flex().flex_none().w(68).gap(2)
      .child(h_flex().w_full().justify_between().text_size(12).text_color(f.mid)
        .child(label).child(div().text_color(f.light).child(sys ? `${Math.round(share * 100)}%` : "--")))
      .child(div().w_full().h(2).bg(f.dark)
        .child(div().id(id).h_full().w(Math.round(68 * (sys ? share : 0))).bg(share > 0.85 ? P.red : f.light)
          .transition("width", { duration: 900, easing: "ease-out" })));
    // on red alert a row of bars beside the words, each pulsing at its own pace, as on the alert displays
    // otherwise one row of them sits dark and still
    const busy = spaces().find((sp) => sp.active)?.tabs.find((t) => t.active)?.status === "working";
    const bars = (side) => h_flex().flex_none().gap(5).children(Array.from({ length: 9 }, (_, i) =>
      div().id(`alert-bar-${side}-${red ? "red" : busy ? "busy" : "still"}-${i}`).w(5).h(13).bg(red ? P.red : busy ? f.mid : i % 3 === 2 ? f.mid2 : f.dark)
        .when(red, (el) => el.loop("opacity", { from: 0.2, to: 1, period: 600 + i * 110 }))
        // while an agent in the shown tab is working the bars come up to grey and breathe, each at its own slow pace
        .when(busy && !red, (el) => el.loop("opacity", { from: 0.3, to: 1, period: 1500 + ((i * 5) % 9) * 190, easing: "ease-in-out" }))));
    // the loop's left edge starts here, under the strip's corner: the band's colour with the panel's curve cut into it
    return div().id("title").size_full().bg(f.dark).pl(T).on_mouse_down("right", onRight(globalMenu)).child(v_flex().size_full().bg(P.bg).rounded_tl(r)
      .child(fade(v_flex().id("hairlines").w_full().flex_none().pt(3).pl(r).gap(3), on, 2)
        .child(h_flex().w_full().h(2).gap(GAP).child(div().flex_1().h_full().bg(f.light)).child(div().w(280).h_full().bg(f.accent)))
        .child(div().w_full().h(1).bg(f.mid)))
      .child(h_flex().w_full().flex_1().min_h(0).items_center().gap(14).pl(r).pr(10)
        .child(bars("l"))
        .when(red, (el) => el
          .child(div().flex_none().text_color(P.red).text_size(17).font_weight(700)
            .child(`ALERT CONDITION: RED · ${two(need)} ${need === 1 ? "AGENT NEEDS" : "AGENTS NEED"} YOU`))
          .child(bars("r")))
        .when(!red && done > 0, (el) => el.child(div().id("yellow-alert").flex_none().text_color(P.amber).text_size(14).font_weight(700)
          .child(`ALERT CONDITION: YELLOW · ${two(done)} FINISHED, NOT SEEN`)))
        .child(div().flex_1())
        .child(meter("sys-cpu", "CPU", sys?.cpu ?? 0))
        .child(meter("sys-mem", "MEM", sys?.mem ?? 0))
        .child(rule())
        .child(div().flex_none().text_color(f.light).text_size(15).font_weight(700).child(new Date(this.now).toTimeString().slice(0, 5)))
        .child(rule())
        .child(fade(div().id("space-name").flex_none().text_color(P.red).text_size(20).font_weight(700).child(up(space?.name ?? "HERDR")), on, 3))));
  }

  // The loop's top-right corner, in the accent: as tall as the strip across the top, a band's width down the side.
  cap() {
    const f = frame(), on = this.on;
    return fade(div().id("cap").relative().size_full().bg(f.accent).rounded_tr(R), on, 4)
      .child(div().absolute().left(0).top(STRIP).w(40 - T).h(200).bg(P.bg).rounded_tr(r));
  }

  // The loop's right edge: the accent carries on down from the cap, then the band is mid grey to the corner.
  band() {
    const f = frame(), on = this.on;
    // between the accent and the grey, a ladder of ticks: one per agent, in its status colour
    const tick = (a) => div().id(`tick-${a.address}`).w_full().h(8).flex_none().bg(STATUS[a.status] ?? f.dark)
      .when(a.status === "blocked", (el) => el.loop("opacity", { from: 0.3, to: 1, period: 700 }));
    return v_flex().id("band").size_full().bg(P.bg).gap(GAP)
      .child(fade(div().id("band-accent").w_full().h(150).flex_none().bg(f.accent), on, 5))
      .children(agents().map(tick))
      .child(fade(h_flex().id("band-rest").w_full().flex_1().gap(GAP), on, 7)
        .child(div().w(2).h_full().bg(f.dark)).child(div().flex_1().h_full().bg(f.mid)));
  }

  corner() {
    const f = frame(), on = this.on;
    return fade(div().id("corner").relative().size_full().bg(f.mid).rounded_br(R), on, 8)
      .child(div().absolute().left(0).top(0).w(40 - T).h(44 - T).bg(P.bg).rounded_br(r));
  }

  // The loop's lower edge: a status line, then the band, light at its left end and mid grey on to the corner. A soft
  // light runs along it while any agent works, faster with more of them.
  bottom() {
    const f = frame(), on = this.on;
    const crew = agents();
    const count = (s) => crew.filter((a) => a.status === s).length;
    const working = count("working");
    const here = spaces().find((sp) => sp.active)?.tabs.find((t) => t.active)?.status === "working";
    const away = machines().filter((m) => m.name).length;
    const item = (color, text, lit) => h_flex().flex_none().gap(6).items_center().text_color(color)
      .child(lit ? div().w(6).h(6).flex_none().bg(color) : div().w(6).h(6).flex_none().border(1).border_color(color))
      .child(text);
    const scan = h_flex().id("scan").absolute().top(0).h_full().w(200)
      .child(div().relative().flex_1().h_full().child(gradient("#ffffff00", "#ffffffe0")))
      .child(div().relative().flex_1().h_full().child(gradient("#ffffffe0", "#ffffff00")))
      .loop("left", { from: -200, to: 1800, period: Math.max(4000, 11000 - working * 1500), easing: "linear" });
    return v_flex().id("bottom").size_full().bg(P.bg).on_mouse_down("right", onRight(globalMenu))
      .child(div().w_full().flex_1().min_h(0).bg(f.dark).pl(T).child(h_flex().size_full().bg(P.bg).rounded_bl(r).items_center().justify_end()
        .gap(16).pl(8).pr(10).text_size(13).font_weight(700)
        .child(item(working ? f.light : f.mid, `${two(working)} WORKING`, working > 0))
        .child(item(count("blocked") ? P.red : f.mid, `${two(count("blocked"))} NEED YOU`, count("blocked") > 0))
        .child(item(count("done") ? P.amber : f.mid, `${two(count("done"))} DONE`, count("done") > 0))
        .child(div().flex_none().w(1).h(14).bg(f.dark))
        .child(div().flex_none().text_color(f.light).child(`${two(away + 1)} MACHINES`))))
      .child(h_flex().w_full().h(T).flex_none().gap(GAP)
        .child(grow(div().id("lower-0").h_full().flex_none().bg(f.dark).rounded_bl(T), on, 180, 6))
        .child(fade(div().id("lower-1").relative().flex_1().h_full().bg(f.mid).overflow_hidden(), on, 7)
          .when(here && on, (el) => el.child(scan)))); // only while the shown tab itself is at work
  }

  // each pane's header: the program on a small cap (lit when the pane has the keyboard), its title, and the git branch
  pane() {
    const f = frame();
    const p = panes().find((x) => x.pane === props()?.pane);
    if (!p) return div();
    const c = STATUS[p.status];
    return h_flex().id(`pane-${p.pane}`).size_full().bg(P.bg).items_center().gap(6).px(6)
      .child(div().flex_none().h(14).px(8).bg(p.focused ? f.light : f.dark).flex().items_center()
        .text_color(p.focused ? P.black : f.mid).text_size(12).font_weight(700).child(up(p.program?.name ?? p.app ?? p.mod ?? "shell")))
      .when(!!c, (el) => el.child(div().flex_none().text_color(c).text_size(12).font_weight(700).child(WORD[p.status])))
      .child(div().flex_1().min_w(0).text_color(f.light).text_size(12).truncate().child(up(p.title)))
      .when(!!p.branch, (el) => el.child(div().flex_none().text_color(P.red).text_size(12).child(up(p.branch))));
  }
}
