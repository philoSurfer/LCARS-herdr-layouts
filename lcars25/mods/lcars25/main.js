// LCARS 25: an LCARS frame after the 25th-century displays (black, grey-blues, one red-orange). One mod draws every part;
// the layout says which with props().part: "top" (two dark title bars), "side" (the right column: the light grey frame
// with dark cards of spaces and crew), "tabs", "pane" (each pane's header strip) and "bottom" (the status line, the
// thin band and the frame's corner). As a popup it is "machines". The right title bar carries this computer's CPU and
// memory as two small gauges.
// Right-clicks open Herdr's own menu mod, so rename, close, split and worktrees work as in its other layouts.
import { View, div, svg, PathBuilder, Background } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, agents, machines, panes, run, props, setAgentOrder, window as appWindow, openOverlay, closeOverlay, exec,
  shared, setShared, playSound, checking } from "herdr";

// The palette of the 25th-century displays: black, three grey-blues and one red-orange. Amber is ours, for "done".
const P = {
  bg: "#000000", black: "#000000", panel: "#111419", dark: "#2f3749", mid: "#6d748c", light: "#9ea5ba", red: "#e7442a",
  white: "#e6e9f2", amber: "#f2b24a",
};
// the frame on red alert: the light grey turns red, as on the ALERT CONDITION: RED displays. Status colours stay.
const RED = { ...P, light: "#e7442a", mid: "#b8321c", dark: "#4a130a", panel: "#1a0704" };
const STATUS = { working: "#9ea5ba", blocked: "#e7442a", done: "#f2b24a", idle: "#6d748c" };
const WORD = { working: "WORKING", blocked: "NEEDS YOU", done: "DONE", idle: "STANDING BY" };
const COL = 220; // the right column's width
const GAP = 4; // background between blocks

const up = (s) => String(s ?? "").toUpperCase();
const two = (n) => String(n).padStart(2, "0");

function stardate(now) {
  // a made-up but steady stardate: year, then the day's fraction of the year
  const d = new Date(now);
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return `${d.getUTCFullYear() - 1920}${(((now - start) / 864e5) * 2.7397).toFixed(1).padStart(6, "0")}`;
}

// Red alert: an agent has waited on the human for alert_after seconds (the sidebar's prop, 120 by default). The sidebar
// keeps when each agent was first seen blocked, checks every WATCH ms and shares the answer under ALERT, which redraws
// every part. The frame is red only while that says so and an agent is still blocked, so answering clears it at once.
const ALERT = "lcars25.alert";
const WATCH = 5000;
const since = new Map(); // agent address -> when it was first seen blocked
function waiting() {
  const now = Date.now();
  const blocked = agents().filter((a) => a.status === "blocked");
  const live = new Set(blocked.map((a) => a.address));
  for (const k of [...since.keys()]) if (!live.has(k)) since.delete(k);
  for (const a of blocked) if (!since.has(a.address)) since.set(a.address, now);
  return { count: blocked.length, longest: blocked.length ? now - Math.min(...blocked.map((a) => since.get(a.address))) : 0 };
}
const alert = () => shared(ALERT) === "red" && agents().some((a) => a.status === "blocked");
// yellow alert needs no clock: it is on while any agent is done and unseen, and red alert outranks it
const yellow = () => !alert() && agents().some((a) => a.status === "done");
const frame = () => (alert() ? RED : P);

// This computer's load, for the title area: one small shell script every SYS ms, never while `herdr-app check` runs.
const SYS = 5000;
const SYS_SCRIPT = String.raw`
case "$(uname)" in
Darwin)
  echo "ncpu $(sysctl -n hw.ncpu)"
  echo "memtotal $(sysctl -n hw.memsize)"
  vm_stat | awk -v ps="$(sysctl -n hw.pagesize)" '/Pages active|Pages wired down|occupied by compressor/ {gsub(/\./,"",$NF); s+=$NF} END {printf "memused %.0f\n", s*ps}' ;;
*)
  echo "ncpu $(nproc)"
  awk '/MemTotal/ {t=$2} /MemAvailable/ {a=$2} END {printf "memtotal %.0f\nmemused %.0f\n", t*1024, (t-a)*1024}' /proc/meminfo ;;
esac
echo "cpusum $(ps -A -o %cpu= | awk '{s+=$1} END {print s+0}')"
`;
async function systems() {
  const r = await exec("sh", ["-c", SYS_SCRIPT], { timeout: 4000 });
  const v = {};
  for (const line of r.stdout.split("\n")) { const [k, ...rest] = line.trim().split(/\s+/); if (k) v[k] = rest.map(Number); }
  const ncpu = v.ncpu?.[0] || 1;
  const frac = (a, b) => (b > 0 ? Math.max(0, Math.min(1, a / b)) : 0);
  return {
    cpu: frac(v.cpusum?.[0] ?? 0, ncpu * 100),
    mem: frac(v.memused?.[0], v.memtotal?.[0]), memGb: (v.memused?.[0] ?? 0) / 2 ** 30,
  };
}
// a layer that fills its (relative) parent with a left-to-right gradient
const RECT = () => PathBuilder.fill().move_to("0%", "0%").line_to("100%", "0%").line_to("100%", "100%").line_to("0%", "100%").close().build();
const gradient = (from, to) => window.paint_path(RECT(), Background.linear_gradient(90, from, to)).absolute().top(0).left(0).size_full();

// Power-up: a part is drawn once with `on` false, then again 80ms later with it true, and these two carry every block
// from nothing to its place, the i-th a little after the one before: bars grow from the left, the rest fades in.
const grow = (el, on, w, i) => el.w(on ? w : 0).overflow_hidden().transition("width", { duration: 520, delay: i * 70, easing: "ease-out" });
const fade = (el, on, i) => el.opacity(on ? 1 : 0).transition("opacity", { duration: 480, delay: 200 + i * 70 });

// Materialise: for GLOW ms after an agent stops working, amber columns flicker over its crew row.
const GLOW = 2400;
const shimmer = (key) => h_flex().absolute().top(0).left(0).size_full().gap(5)
  .children(Array.from({ length: 20 }, (_, i) => div().id(`glow-${key}-${i}`).flex_1().h_full().bg(P.amber)
    .loop("opacity", { from: 0, to: 0.75, period: 260 + ((i * 97) % 420) })));

// Hail: for HAIL ms after an agent starts needing you, two rings swell from its status light and fade as they grow,
// each at its own pace. A ring is a round outline whose size, place and opacity swing together.
const HAIL = 8000;
const ring = (key, n, period) => {
  const swing = (from, to) => ({ from, to, period, easing: "ease-out" });
  return div().id(`hail-${key}-${n}`).absolute().rounded_full().border(2).border_color(P.red)
    .loop("width", swing(6, 50)).loop("height", swing(6, 50))
    .loop("left", swing(10, -12)).loop("top", swing(12, -10)).loop("opacity", swing(1, 0));
};

// a card in the right column: a near-black rounded panel with a small grey label and a large red figure, as on the
// 25th-century side panels
const card = (id, f, label, figure, on, i) => fade(v_flex().id(id).w_full().flex_none().bg(f.panel).rounded(10).p(8).gap(GAP), on, i)
  .child(h_flex().w_full().items_end().justify_between().pb(2)
    .child(div().text_color(f.mid).text_size(10).font_weight(700).child(label))
    .child(div().text_color(P.red).text_size(20).font_weight(700).child(figure)));

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
    if (part === "top") {
      cx.timer.every(15000, (cx) => { this.now = Date.now(); cx.notify(); });
      if (!checking()) { this.measure(cx); cx.timer.every(SYS, (cx) => this.measure(cx)); }
    }
    if (part === "side") {
      cx.timer.every(WATCH, () => this.watch());
      this.was = new Map(); // agent address -> its status at the last look
      this.glow = new Map(); // agent address -> when it stopped working
      this.hail = new Map(); // agent address -> when it started needing you
      cx.timer.every(400, (cx) => this.sense(cx));
    }
    this.on = false; // the power-up: every part starts dark
    cx.timer.after(80, (cx) => { this.on = true; cx.notify(); });
  }

  // sets the shared alert when it changes; the alert sound plays once, as the frame turns red
  watch() {
    const w = waiting();
    const after = (Number(props()?.alert_after) || 120) * 1000;
    const next = w.count && w.longest >= after ? "red" : "green";
    if (next === (shared(ALERT) ?? "green")) return;
    setShared(ALERT, next);
    if (next === "red" && !checking()) playSound("blocked");
  }

  // notes each agent that just stopped working or just started needing you, and redraws only when a glow or a hail
  // starts or ends
  sense(cx) {
    const now = Date.now();
    let changed = false;
    for (const a of agents()) {
      if (this.was.get(a.address) === "working" && (a.status === "done" || a.status === "idle")) { this.glow.set(a.address, now); changed = true; }
      const before = this.was.get(a.address);
      if (before && before !== "blocked" && a.status === "blocked") { this.hail.set(a.address, now); changed = true; }
      if (a.status !== "blocked" && this.hail.delete(a.address)) changed = true;
      this.was.set(a.address, a.status);
    }
    for (const [k, at] of [...this.glow]) if (now - at > GLOW) { this.glow.delete(k); changed = true; }
    for (const [k, at] of [...this.hail]) if (now - at > HAIL) { this.hail.delete(k); changed = true; }
    if (changed) cx.notify();
  }

  measure(cx) {
    if (this.measuring && Date.now() - this.measuring < 20000) return; // an earlier reading is still out
    this.measuring = Date.now();
    cx.spawn(async (cx) => {
      try { this.sys = await systems(); } catch {}
      this.measuring = 0;
      cx.notify();
    });
  }

  render() {
    const part = props()?.part;
    if (part === "top") return this.top();
    if (part === "side") return this.side();
    if (part === "tabs") return this.tabs();
    if (part === "pane") return this.pane();
    if (part === "bottom") return this.bottom();
    if (part === "machines") return this.machines();
    return div().child(`lcars25: unknown part ${part}`);
  }

  machines() {
    const close = () => closeOverlay(props()?.overlay);
    const all = [{ name: null, layout: "ready" }, ...machines().filter((m) => m.name)];
    const row = (m) => {
      const ready = m.layout === "ready";
      return h_flex().id(`new-space-${m.name ?? "local"}`).w_full().h(26).flex_none().rounded(13).bg(P.dark).items_center().px(12)
        .text_color(ready ? P.light : P.mid).text_size(12).font_weight(700)
        .when(ready, (el) => el.cursor_pointer().hover((st) => st.bg(P.mid))
          .on_click(() => { close(); run("space.new", m.name ? { machine: m.name } : {}); }))
        .child(up(`${m.name ?? "this computer"}${ready ? "" : " · " + m.layout}`));
    };
    return div().size_full().bg(P.light).rounded(14).p(6).child(
      card("new-space-card", P, "NEW SPACE ON", two(all.length), true, 0).size_full().children(all.map(row)));
  }

  // The top bar: two dark pill bars joined by a thin connector, as the title bars of the 25th-century displays. The
  // left one names the shown space and carries the alert; the right one carries the load, the stardate and the clock.
  top() {
    const f = frame(), red = alert(), on = this.on;
    const space = spaces().find((s) => s.active);
    const crew = agents();
    const need = crew.filter((a) => a.status === "blocked").length;
    const done = crew.filter((a) => a.status === "done").length;
    const sys = this.sys;
    // this computer's load, kept quiet: a dim label, the figure, and a 2px line that eases to each new reading
    const meter = (id, label, share) => v_flex().flex_none().w(60).gap(2)
      .child(h_flex().w_full().justify_between().text_size(10).text_color(f.mid)
        .child(label).child(div().text_color(f.light).child(sys ? `${Math.round(share * 100)}%` : "--")))
      .child(div().w_full().h(2).bg(P.black)
        .child(div().id(id).h_full().w(Math.round(60 * (sys ? share : 0))).bg(share > 0.85 ? P.red : f.light)
          .transition("width", { duration: 900, easing: "ease-out" })));
    // on red alert a row of bars beside the words, each pulsing at its own pace, as on the alert displays
    const bars = (side) => h_flex().flex_none().gap(5).children(Array.from({ length: 9 }, (_, i) =>
      div().id(`alert-bar-${side}-${i}`).w(5).h(14).bg(P.black).loop("opacity", { from: 0.25, to: 1, period: 600 + i * 110 })));
    const left = fade(h_flex().id("title").flex_1().min_w(0).h(28).rounded(14).bg(red ? f.light : f.dark).items_center().gap(12).px(16), on, 0)
      .when(!red, (el) => el
        .child(div().flex_none().text_color(f.light).text_size(18).font_weight(700).child(up(space?.name ?? "HERDR")))
        .child(div().flex_none().text_color(f.mid).text_size(10).child(space
          ? `${two(space.index)} · ${up(space.machine ?? "this computer")} · ${two((space.tabs ?? []).filter((t) => !t.settled).length)} TABS` : ""))
        .child(div().flex_1())
        .when(done > 0, (el) => el.child(div().id("yellow-alert").flex_none().h(18).px(10).rounded(9).bg(P.amber).flex().items_center()
          .text_color(P.black).text_size(11).font_weight(700).child(`ALERT CONDITION: YELLOW · ${two(done)} FINISHED, NOT SEEN`))))
      .when(red, (el) => el.justify_center()
        .child(bars("l"))
        .child(div().flex_none().text_color(P.black).text_size(18).font_weight(700)
          .child(`ALERT CONDITION: RED · ${two(need)} ${need === 1 ? "AGENT NEEDS" : "AGENTS NEED"} YOU`))
        .child(bars("r")));
    const right = fade(h_flex().id("readouts").flex_none().h(28).rounded(14).bg(f.dark).items_center().gap(14).px(16), on, 3)
      .child(meter("sys-cpu", "CPU", sys?.cpu ?? 0))
      .child(meter("sys-mem", "MEM", sys?.mem ?? 0))
      .child(div().flex_none().text_color(P.red).text_size(11).child(stardate(this.now)))
      .child(div().flex_none().text_color(f.light).text_size(14).font_weight(700).child(new Date(this.now).toTimeString().slice(0, 5)));
    return h_flex().id("top").size_full().bg(P.bg).items_center().px(10).on_mouse_down("right", onRight(globalMenu))
      .child(div().flex_none().w(appWindow()?.platform === "macos" ? 66 : 0)) // the window buttons sit here on macOS
      .child(left)
      .child(grow(div().id("title-link").h(6).flex_none().bg(f.dark), on, 48, 2))
      .child(right);
  }

  // The right column: the light grey frame with dark cards inside it, spaces then crew, running down into the corner
  // of the bottom bar.
  side() {
    const f = frame(), on = this.on;
    const list = spaces();
    const crew = agents();
    waiting(); // notes when each blocked agent started waiting, for the red alert
    setAgentOrder(crew.map((a) => a.address));
    const space = (s, i) => {
      const hail = s.status === "blocked" && !s.active;
      const bg = s.active ? f.light : hail ? P.red : f.dark;
      const ink = s.active || hail ? P.black : f.light;
      return grow(h_flex().id(`space-${s.id}`).h(24).flex_none().rounded(12).bg(bg).items_center().gap(8).pl(10).pr(7).cursor_pointer(),
        on, COL - 38, 1 + i)
        .hover((st) => st.opacity(0.8))
        .when(hail, (el) => el.loop("opacity", { from: 0.5, to: 1, period: 900 }))
        .on_click(() => run("space.select", { id: s.id }))
        .on_mouse_down("right", onRight(() => menu("space", { id: s.id })))
        .child(div().flex_none().text_color(s.active || hail ? P.black : f.mid).text_size(10).font_weight(700)
          .child(`${two(s.index)}${s.machine ? " · " + up(s.machine).slice(0, 4) : ""}`))
        .child(div().flex_1().min_w(0).text_color(ink).text_size(12).font_weight(700).truncate().child(up(s.name)))
        // the knob at the right, as on the display's toggles: lit when something in the space is working or done
        .child(div().w(10).h(10).flex_none().rounded(5).bg(s.status === "done" ? P.amber : s.status === "working" && !s.active ? f.light : P.black));
    };
    const member = (a, i) => {
      const lit = this.glow.has(a.address); // it just stopped working
      const c = lit ? P.amber : STATUS[a.status] ?? f.mid;
      return h_flex().id(`agent-${a.address}`).relative().w_full().h(30).flex_none().gap(8).items_center().pl(4).cursor_pointer()
        .hover((st) => st.opacity(0.8))
        .on_click(() => run("agent.focus", { terminal: a.address }))
        .on_mouse_down("right", onRight(() => menu("pane", { pane: a.pane, terminal: a.address })))
        .child(div().id(`agent-light-${a.address}`).w(8).h(18).flex_none().rounded(4).bg(c)
          .when(a.status === "blocked", (el) => el.loop("opacity", { from: 0.35, to: 1, period: 700 })))
        .child(v_flex().flex_1().min_w(0)
          .child(div().text_size(11).font_weight(700).text_color(a.focused ? P.white : f.light).truncate()
            .child(up(`${a.program?.name ?? a.app ?? "agent"} · ${a.tab_name}`)))
          .child(div().text_size(9).text_color(a.status === "blocked" || lit ? c : f.mid).truncate()
            .child(`${lit ? "DONE" : WORD[a.status] ?? up(a.status)} · ${up(a.space_name)}`)))
        .when(lit, (el) => el.child(shimmer(a.address)))
        .when(this.hail.has(a.address), (el) => el.child(ring(a.address, 0, 1500)).child(ring(a.address, 1, 2300)));
    };
    return v_flex().id("side").size_full().bg(f.light).rounded_tl(18).rounded_tr(18).pl(14).pr(8).pt(10).gap(8)
      .on_mouse_down("right", onRight(globalMenu))
      .child(card("spaces-card", f, "SPACES", two(list.length), on, 0)
        .children(list.map(space))
        .child(h_flex().id("space-new").h(22).flex_none().rounded(11).border(1).border_color(f.dark).items_center().px(10)
          .text_color(f.mid).text_size(10).font_weight(700).cursor_pointer().hover((st) => st.bg(f.dark))
          .on_click(() => newSpace()).on_mouse_down("right", onRight(newSpace)).child("+ NEW SPACE")))
      .child(card("crew-card", f, "CREW", two(crew.length), on, 3).children(crew.map(member)));
  }

  tabs() {
    const f = frame();
    const space = spaces().find((s) => s.active);
    const pill = (t) => {
      const hail = t.status === "blocked" && !t.active;
      return h_flex().id(`tab-${t.id}`).h_full().flex_none().px(12).gap(6).rounded(13).bg(t.active ? f.light : hail ? P.red : f.dark).items_center()
        .text_color(t.active || hail ? P.black : f.light).text_size(12).font_weight(700).cursor_pointer()
        .hover((st) => st.opacity(0.8))
        .when(hail, (el) => el.loop("opacity", { from: 0.5, to: 1, period: 800 }))
        .on_click(() => run("tab.select", { id: t.id }))
        .on_mouse_down("right", onRight(() => menu("tab", { id: t.id, space: space.id })))
        .child(`${two(t.index)} ${up(t.name)}`)
        .when(t.status === "working" || t.status === "done", (el) => el
          .child(div().w(8).h(8).flex_none().rounded(4).bg(t.status === "done" ? P.amber : t.active ? P.black : f.light)));
    };
    return h_flex().id("tab-bar").size_full().gap(GAP).items_center().overflow_x_scrollbar()
      .on_mouse_down("right", onRight(globalMenu))
      .children((space?.tabs ?? []).filter((t) => !t.settled).map(pill))
      .child(h_flex().id("tab-new").h_full().flex_none().px(11).rounded(13).border(1).border_color(f.dark).items_center()
        .text_color(f.mid).text_size(16).font_weight(700).cursor_pointer().hover((st) => st.bg(f.dark))
        .on_click(() => newMenu()).on_mouse_down("right", onRight(newMenu)).child("+"));
  }

  // each pane's header: the program on a small cap (lit when the pane has the keyboard), its title, and the git branch
  pane() {
    const f = frame();
    const p = panes().find((x) => x.pane === props()?.pane);
    if (!p) return div();
    const c = STATUS[p.status];
    return h_flex().id(`pane-${p.pane}`).size_full().bg(P.bg).items_center().gap(6).px(6)
      .child(div().flex_none().h(13).px(8).rounded(7).bg(p.focused ? f.light : f.dark).flex().items_center()
        .text_color(p.focused ? P.black : f.mid).text_size(10).font_weight(700).child(up(p.program?.name ?? p.app ?? p.mod ?? "shell")))
      .when(!!c, (el) => el.child(div().flex_none().text_color(c).text_size(10).font_weight(700).child(WORD[p.status])))
      .child(div().flex_1().min_w(0).text_color(f.mid).text_size(10).truncate().child(up(p.title)))
      .when(!!p.branch, (el) => el.child(div().flex_none().text_color(P.red).text_size(10).child(up(p.branch))));
  }

  // The bottom bar: a status line over a thin band of the frame, which turns up into the right column at the corner.
  bottom() {
    const f = frame(), on = this.on;
    const crew = agents();
    const count = (s) => crew.filter((a) => a.status === s).length;
    const working = count("working");
    const away = machines().filter((m) => m.name).length;
    const item = (color, text) => div().flex_none().text_color(color).child(text);
    // the inner corner: the background with a rounded bottom-right corner, over the frame's colour
    const status = div().w_full().flex_1().min_h(0).bg(f.light).child(
      h_flex().size_full().bg(P.bg).rounded_br(16).items_center().gap(16).pl(14).pr(20).text_size(11).font_weight(700)
        .child(item(f.light, `${two(working)} WORKING`))
        .child(item(count("blocked") ? P.red : f.mid, `${two(count("blocked"))} NEED YOU`))
        .child(item(count("done") ? P.amber : f.mid, `${two(count("done"))} DONE`))
        .child(item(f.mid, `${two(away + 1)} MACHINES`))
        .child(div().flex_1())
        .child(div().id("palette").flex_none().text_color(f.mid).cursor_pointer().hover((st) => st.opacity(0.7))
          .on_click(() => run("app.palette")).child(`${appWindow()?.platform === "macos" ? "⌘" : "CTRL"} SHIFT P`)));
    // a soft light that runs along the band while any agent works, faster with more of them
    const scan = h_flex().id("scan").absolute().top(0).h_full().w(200)
      .child(div().relative().flex_1().h_full().child(gradient("#ffffff00", "#ffffffe0")))
      .child(div().relative().flex_1().h_full().child(gradient("#ffffffe0", "#ffffff00")))
      .loop("left", { from: -200, to: 1800, period: Math.max(4000, 11000 - working * 1500), easing: "linear" });
    const band = fade(div().id("band").relative().w_full().h(8).flex_none().bg(f.light).rounded_bl(4).overflow_hidden(), on, 2)
      .when(working > 0 && on, (el) => el.child(scan));
    // the corner of the frame: MENU and the gear (Herdr's settings) in black on the grey
    const corner = h_flex().id("menu").w(COL).h_full().flex_none().bg(f.light).rounded_br(22).items_center().justify_end().gap(10).pr(16)
      .text_color(P.black).text_size(12).font_weight(700).cursor_pointer().hover((st) => st.opacity(0.85))
      .on_click(() => menu("global", {}))
      .child("MENU")
      .child(div().id("settings").cursor_pointer().hover((st) => st.opacity(0.6))
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .on_mouse_down("right", (_e, cx) => cx.stop_propagation())
        .on_click(() => run("app.settings"))
        .child(svg("mods/lcars25/gear.svg").size(14).text_color(P.black)));
    return h_flex().id("bottom").size_full().bg(P.bg).on_mouse_down("right", onRight(globalMenu))
      .child(v_flex().flex_1().h_full().min_w(0).child(status).child(band))
      .child(corner);
  }
}
