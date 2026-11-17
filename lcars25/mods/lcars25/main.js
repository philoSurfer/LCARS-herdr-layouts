// LCARS 25: a lighter, cooler LCARS frame, after the 25th-century displays. One mod draws every part; the layout says
// which with props().part: "top" (the corner, the thin arm and the title), "side" (spaces and crew on a segmented
// spine), "tabs", "pane" (each pane's header strip) and "bottom" (the lower corner and the status line). As a popup
// it is "machines". The title area carries this computer's CPU and memory as two small gauges.
// Right-clicks open Herdr's own menu mod, so rename, close, split and worktrees work as in its other layouts.
import { View, div, svg, PathBuilder, Background } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, agents, machines, panes, run, props, setAgentOrder, window as appWindow, openOverlay, closeOverlay, exec,
  shared, setShared, playSound, checking } from "herdr";

const P = {
  bg: "#05070c", black: "#000000", steel: "#6f86c4", ice: "#c7d3ea", slate: "#9fb2dc", deep: "#1c2540", line: "#2a3556",
  crimson: "#e0503c", amber: "#f2a23a", mute: "#7a86a8", ink: "#d6e0f5", dim: "#8c9ac0",
};
// the frame on red alert: the steel and ice turn red. Status colours stay as they are.
const RED = { ...P, steel: "#e0503c", ice: "#ffb3a6", slate: "#ff8877", deep: "#3a1512", line: "#5a211b", mute: "#b3594d",
  crimson: "#ffb3a6" };
// the frame on yellow alert: an agent finished and has not been looked at. The steel and ice turn amber.
const YELLOW = { ...P, steel: "#d9a441", ice: "#ffe2a8", slate: "#f2c56b", deep: "#2e2410", line: "#4a3a18", mute: "#a8905a",
  dim: "#c9b488", ink: "#ffe9c2" };
const STATUS = { working: "#8fc1ff", blocked: "#ff5a47", done: "#f2b24a", idle: "#7f8fd0" };
const WORD = { working: "WORKING", blocked: "NEEDS YOU", done: "DONE", idle: "STANDING BY" };
const SHORT = { working: "WRK", blocked: "HAIL", done: "DONE", idle: "STBY" };
const SPINE = 52; // the left spine's width: the corners and every row's cap
const ARM = 10; // the thickness of the top arm
const GAP = 3; // background between blocks

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
const frame = () => (alert() ? RED : yellow() ? YELLOW : P);
const chase = (el, on, i) => (on ? el.loop("opacity", { from: 0.35, to: 1, period: 700 + i * 170 }) : el);

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
// from nothing to its place, the i-th a little after the one before: fixed blocks grow from the left, the rest fade in.
const grow = (el, on, w, i) => el.w(on ? w : 0).overflow_hidden().transition("width", { duration: 520, delay: i * 70, easing: "ease-out" });
const fade = (el, on, i) => el.opacity(on ? 1 : 0).transition("opacity", { duration: 480, delay: 200 + i * 70 });

// Materialise: for GLOW ms after an agent stops working, gold columns flicker over its crew row and its cap is gold.
const GLOW = 2400;
const GOLD = "#f2b24a";
const shimmer = (key) => h_flex().absolute().top(0).left(0).size_full().gap(5)
  .children(Array.from({ length: 20 }, (_, i) => div().id(`glow-${key}-${i}`).flex_1().h_full().bg(GOLD)
    .loop("opacity", { from: 0, to: 0.75, period: 260 + ((i * 97) % 420) })));

// Hail: for HAIL ms after an agent starts needing you, two pale rings swell from the middle of its cap and fade as they
// grow, each at its own pace. A ring is a round outline whose size, place and opacity swing together.
const HAIL = 8000;
const ring = (key, n, period) => {
  const swing = (from, to) => ({ from, to, period, easing: "ease-out" });
  return div().id(`hail-${key}-${n}`).absolute().rounded_full().border(2).border_color("#ffe3dd") // pale, to show on the red cap
    .loop("width", swing(6, 60)).loop("height", swing(6, 60))
    .loop("left", swing(SPINE / 2 - 3, SPINE / 2 - 30)).loop("top", swing(13, -14)).loop("opacity", swing(1, 0));
};

// a section's heading: a numbered cap on the spine, then a dark strip with the name
function heading(id, f, n, name, on = true, i = 0) {
  const cap = grow(div().id(`${id}-cap`).h_full().flex_none().bg(f.slate).flex().items_center().justify_end().pr(6)
    .text_color(P.black).text_size(11).font_weight(700).child(two(n)), on, SPINE, i);
  const strip = fade(h_flex().id(`${id}-strip`).flex_1().h_full().bg(f.deep).items_center().px(8).text_color(f.ink).text_size(11)
    .font_weight(700).child(up(name)), on, i);
  return h_flex().id(id).w_full().h(16).flex_none().gap(GAP).child(cap.rounded_l(8)).child(strip);
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
    const row = (m, i) => {
      const ready = m.layout === "ready";
      return h_flex().id(`new-space-${m.name ?? "local"}`).w_full().h(30).flex_none().gap(GAP)
        .when(ready, (el) => el.cursor_pointer().hover((st) => st.opacity(0.8))
          .on_click(() => { close(); run("space.new", m.name ? { machine: m.name } : {}); }))
        .child(div().w(SPINE).h_full().flex_none().bg(ready ? P.slate : P.line).rounded_l(15).flex().items_center().justify_end().pr(6)
          .text_color(P.black).text_size(12).font_weight(700).child(two(i + 1)))
        .child(h_flex().flex_1().h_full().bg(P.deep).items_center().px(8).text_color(ready ? P.ink : P.mute).text_size(13)
          .font_weight(700).child(up(`${m.name ?? "this computer"}${ready ? "" : " · " + m.layout}`)));
    };
    return v_flex().size_full().bg(P.bg).rounded(12).p(6).gap(GAP)
      .child(heading("new-space-title", P, all.length, "new space on"))
      .children(all.map(row));
  }

  top() {
    const f = frame(), red = alert(), on = this.on;
    const space = spaces().find((s) => s.active);
    const crew = agents();
    const need = crew.filter((a) => a.status === "blocked").length;
    const working = crew.filter((a) => a.status === "working").length;
    const done = crew.filter((a) => a.status === "done").length;
    // a soft light that runs along the arm while any agent works, faster with more of them
    const scan = h_flex().id("scan").absolute().top(0).h_full().w(160)
      .child(div().relative().flex_1().h_full().child(gradient("#ffffff00", "#ffffffb0")))
      .child(div().relative().flex_1().h_full().child(gradient("#ffffffb0", "#ffffff00")))
      .loop("left", { from: -160, to: 1800, period: Math.max(4000, 11000 - working * 1500), easing: "linear" });
    // this computer's load, kept quiet: a dim label, the figure, and a 2px line that eases to each new reading
    const sys = this.sys;
    const meter = (id, label, share, color) => v_flex().flex_none().w(64).gap(2)
      .child(h_flex().w_full().justify_between().text_size(10).text_color(f.dim)
        .child(label).child(div().text_color(f.ink).child(sys ? `${Math.round(share * 100)}%` : "--")))
      .child(div().w_full().h(2).bg(f.line)
        .child(div().id(id).h_full().w(Math.round(64 * (sys ? share : 0))).bg(share > 0.85 ? STATUS.blocked : color)
          .transition("width", { duration: 900, easing: "ease-out" })));
    const arm = h_flex().w_full().h(ARM).flex_none().gap(GAP)
      .child(chase(grow(div().id("top-arm-0").h_full().bg(f.steel), on, 140, 0), red, 0))
      .child(chase(grow(div().id("top-arm-1").h_full().bg(f.ice), on, 36, 2), red, 1))
      .child(chase(div().id("top-arm-2").relative().flex_1().h_full().overflow_hidden()
        .child(fade(div().id("top-arm-2-fill").relative().size_full().child(gradient(f.steel, f.slate)), on, 3))
        .when(working > 0 && !red && on, (el) => el.child(scan)), red, 2))
      .child(chase(grow(div().id("top-arm-3").h_full().bg(f.crimson), on, 64, 6), red, 3))
      .child(chase(grow(div().id("top-arm-4").h_full().bg(f.steel).rounded_tr(5).rounded_br(5), on, 28, 8), red, 4));
    const hairline = fade(h_flex().id("top-hairline").w_full().h(2).flex_none().gap(GAP).mt(2)
      .child(div().w(140).h_full().bg(f.steel)).child(div().flex_1().h_full().bg(f.line)).child(div().w(95).h_full().bg(f.crimson)), on, 6);
    // the concave inner corner: the background with a rounded top-left corner, over the corner's colour
    const title = div().w_full().flex_1().min_h(0).bg(f.steel).child(
      h_flex().size_full().bg(P.bg).rounded_tl(16).items_center().gap(12).pr(8)
        .pl(appWindow()?.platform === "macos" ? 78 : 18) // clear of the window buttons, which sit in this corner on macOS
        .child(div().text_color(f.ice).text_size(22).font_weight(700).child(up(space?.name ?? "HERDR")))
        .child(div().text_color(f.dim).text_size(10).child(space
          ? `${two(space.index)} · ${up(space.machine ?? "this computer")} · ${two((space.tabs ?? []).filter((t) => !t.settled).length)} TABS` : ""))
        .child(div().flex_1())
        .when(red, (el) => el.child(div().id("red-alert").flex_none().h(20).px(12).rounded(10).bg(STATUS.blocked).flex().items_center()
          .text_color(P.black).text_size(12).font_weight(700).loop("opacity", { from: 0.45, to: 1, period: 900 })
          .child(`RED ALERT · ${two(need)} ${need === 1 ? "AGENT NEEDS" : "AGENTS NEED"} YOU`)))
        .when(yellow(), (el) => el.child(div().id("yellow-alert").flex_none().h(20).px(12).rounded(10).bg(STATUS.done).flex().items_center()
          .text_color(P.black).text_size(12).font_weight(700).child(`YELLOW ALERT · ${two(done)} FINISHED, NOT SEEN`)))
        .child(meter("sys-cpu", "CPU", sys?.cpu ?? 0, STATUS.working))
        .child(meter("sys-mem", "MEM", sys?.mem ?? 0, f.slate))
        .child(div().text_color(P.amber).text_size(11).child(`STARDATE ${stardate(this.now)}`))
        .child(div().text_color(f.ink).text_size(13).font_weight(700).child(new Date(this.now).toTimeString().slice(0, 5))));
    return h_flex().id("top").size_full().bg(P.bg).on_mouse_down("right", onRight(globalMenu))
      .child(div().id("top-corner").w(SPINE).h_full().flex_none().bg(f.steel).rounded_tl(30))
      .child(v_flex().flex_1().h_full().min_w(0).child(arm).child(hairline).child(title));
  }

  side() {
    const f = frame(), on = this.on;
    const list = spaces();
    const crew = agents();
    waiting(); // notes when each blocked agent started waiting, for the red alert
    setAgentOrder(crew.map((a) => a.address));
    const caps = [f.slate, f.steel, f.ice, f.mute];
    const space = (s, i) => {
      const hail = s.status === "blocked";
      return h_flex().id(`space-${s.id}`).w_full().h(30).flex_none().gap(GAP).cursor_pointer()
        .hover((st) => st.opacity(0.8))
        .on_click(() => run("space.select", { id: s.id }))
        .on_mouse_down("right", onRight(() => menu("space", { id: s.id })))
        .child(grow(div().id(`space-cap-${s.id}`).h_full().flex_none().bg(hail ? STATUS.blocked : s.active ? f.ice : caps[i % caps.length])
          .rounded_l(15).flex().items_center().justify_end().pr(6).text_color(P.black).text_size(12).font_weight(700), on, SPINE, 1 + i)
          .when(hail && !s.active, (el) => el.loop("opacity", { from: 0.5, to: 1, period: 900 }))
          .child(`${two(s.index)}${s.machine ? "·" + up(s.machine).slice(0, 3) : ""}`))
        .child(fade(h_flex().id(`space-strip-${s.id}`).relative().flex_1().min_w(0).h_full().bg(s.active ? f.ice : f.deep)
          .items_center().justify_between().px(8).gap(6), on, 1 + i)
          .when(s.active, (el) => el.child(gradient(f.slate, f.ice)))
          .child(div().relative().text_color(s.active ? P.black : f.ink).text_size(13).font_weight(700).truncate().child(up(s.name)))
          .when(!!STATUS[s.status] && s.status !== "idle" && !s.active, (el) => el
            .child(div().w(6).h(6).flex_none().rounded(3).bg(STATUS[s.status]))));
    };
    const member = (a, i) => {
      const lit = this.glow.has(a.address); // it just stopped working
      const c = lit ? GOLD : STATUS[a.status] ?? f.mute;
      const at = list.length + 3 + i;
      return h_flex().id(`agent-${a.address}`).relative().w_full().h(32).flex_none().gap(GAP).cursor_pointer()
        .hover((st) => st.opacity(0.8))
        .on_click(() => run("agent.focus", { terminal: a.address }))
        .on_mouse_down("right", onRight(() => menu("pane", { pane: a.pane, terminal: a.address })))
        .child(grow(div().id(`agent-cap-${a.address}`).h_full().flex_none().bg(c).rounded_l(16).flex().items_center().justify_end().pr(6)
          .text_color(P.black).text_size(10).font_weight(700), on, SPINE, at)
          .when(a.status === "blocked", (el) => el.loop("opacity", { from: 0.4, to: 1, period: 700 }))
          .child(lit ? "DONE" : SHORT[a.status] ?? ""))
        .child(fade(v_flex().id(`agent-text-${a.address}`).flex_1().min_w(0).h_full().justify_center().pl(8).pr(6), on, at)
          .child(div().text_size(12).font_weight(700).text_color(a.focused ? f.ice : f.ink).truncate()
            .child(up(`${a.program?.name ?? a.app ?? "agent"} · ${a.tab_name}`)))
          .child(div().text_size(10).text_color(a.status === "blocked" ? c : f.dim).truncate()
            .child(`${WORD[a.status] ?? up(a.status)} · ${up(a.space_name)}`)))
        .when(lit, (el) => el.child(shimmer(a.address)))
        .when(this.hail.has(a.address), (el) => el.child(ring(a.address, 0, 1500)).child(ring(a.address, 1, 2300)));
    };
    return v_flex().id("side").size_full().bg(P.bg).gap(GAP).on_mouse_down("right", onRight(globalMenu))
      .child(div().id("side-carry").w(SPINE).h(8).flex_none().bg(f.steel)) // carries the top corner down
      .child(heading("spaces-label", f, list.length, "spaces", on, 0))
      .children(list.map(space))
      .child(h_flex().id("space-new").w_full().h(22).flex_none().gap(GAP).cursor_pointer().hover((st) => st.opacity(0.7))
        .on_click(() => newSpace()).on_mouse_down("right", onRight(newSpace))
        .child(grow(div().id("space-new-cap").h_full().flex_none().bg(f.line).rounded_l(11).flex().items_center().justify_end().pr(6)
          .text_color(f.ink).text_size(14).font_weight(700).child("+"), on, SPINE, list.length + 1))
        .child(fade(div().id("space-new-text").flex_1().h_full().flex().items_center().px(8).text_color(f.dim).text_size(11).font_weight(700)
          .child("NEW SPACE"), on, list.length + 1)))
      .child(heading("crew-label", f, crew.length, "crew", on, list.length + 2))
      .children(crew.map(member))
      .child(fade(div().id("spine").w(SPINE).flex_1().min_h(8).bg(f.steel), on, list.length + crew.length + 3)); // the spine, down to the bottom corner
  }

  tabs() {
    const f = frame();
    const space = spaces().find((s) => s.active);
    const pill = (t) => h_flex().id(`tab-${t.id}`).h_full().flex_none().px(12).gap(6).rounded(13).bg(t.active ? f.ice : f.deep).items_center()
      .text_color(t.active ? P.black : f.ink).text_size(12).font_weight(700).cursor_pointer()
      .hover((st) => st.opacity(0.8))
      .on_click(() => run("tab.select", { id: t.id }))
      .on_mouse_down("right", onRight(() => menu("tab", { id: t.id, space: space.id })))
      .when(!!STATUS[t.status], (el) => el.child(div().w(7).h(7).flex_none().rounded(4).bg(t.active && t.status !== "blocked" ? P.black : STATUS[t.status])
        .when(t.status === "blocked", (el) => el.loop("opacity", { from: 0.3, to: 1, period: 800 }))))
      .child(`${two(t.index)} ${up(t.name)}`);
    return h_flex().id("tab-bar").size_full().gap(GAP + 1).items_center().overflow_x_scrollbar()
      .on_mouse_down("right", onRight(globalMenu))
      .children((space?.tabs ?? []).filter((t) => !t.settled).map(pill))
      .child(h_flex().id("tab-new").h_full().flex_none().px(11).rounded(13).bg(f.line).items_center()
        .text_color(f.ink).text_size(16).font_weight(700).cursor_pointer().hover((st) => st.bg(f.steel))
        .on_click(() => newMenu()).on_mouse_down("right", onRight(newMenu)).child("+"));
  }

  // each pane's header: the program on a small cap (lit when the pane has the keyboard), its title, and the git branch
  pane() {
    const f = frame();
    const p = panes().find((x) => x.pane === props()?.pane);
    if (!p) return div();
    const c = STATUS[p.status];
    return h_flex().id(`pane-${p.pane}`).size_full().bg(P.bg).items_center().gap(6).px(6)
      .child(div().flex_none().h(13).px(8).rounded(7).bg(p.focused ? f.ice : f.line).flex().items_center()
        .text_color(p.focused ? P.black : f.dim).text_size(10).font_weight(700).child(up(p.program?.name ?? p.app ?? p.mod ?? "shell")))
      .when(!!c, (el) => el.child(div().flex_none().text_color(c).text_size(10).font_weight(700).child(WORD[p.status])))
      .child(div().flex_1().min_w(0).text_color(f.dim).text_size(10).truncate().child(up(p.title)))
      .when(!!p.branch, (el) => el.child(div().flex_none().text_color(P.amber).text_size(10).child(up(p.branch))));
  }

  bottom() {
    const f = frame(), red = alert(), on = this.on;
    const crew = agents();
    const count = (s) => crew.filter((a) => a.status === s).length;
    const away = machines().filter((m) => m.name).length;
    // the gear opens Herdr's settings
    const corner = div().id("settings").w(SPINE).h_full().flex_none().bg(f.mute).rounded_bl(26).flex().items_center().justify_center()
      .cursor_pointer().hover((st) => st.bg(f.slate)).on_click(() => run("app.settings"))
      .child(svg("mods/lcars25/gear.svg").size(14).text_color(P.black));
    const item = (color, text) => div().flex_none().text_color(color).child(text);
    const status = div().w_full().flex_1().min_h(0).bg(f.mute).child(
      h_flex().size_full().bg(P.bg).rounded_bl(14).items_center().gap(16).pl(16).pr(8).text_size(11).font_weight(700)
        .child(div().id("menu").flex_none().text_color(f.ink).cursor_pointer().hover((st) => st.opacity(0.7))
          .on_click(() => menu("global", {})).child("MENU"))
        .child(item(STATUS.working, `${two(count("working"))} WORKING`))
        .child(item(count("blocked") ? STATUS.blocked : f.mute, `${two(count("blocked"))} NEED YOU`))
        .child(item(STATUS.done, `${two(count("done"))} DONE`))
        .child(item(f.dim, `${two(away + 1)} MACHINES`))
        .child(div().flex_1())
        .child(div().id("palette").flex_none().text_color(f.dim).cursor_pointer().hover((st) => st.opacity(0.7))
          .on_click(() => run("app.palette")).child(`${appWindow()?.platform === "macos" ? "⌘" : "CTRL"} SHIFT P`)));
    const arm = h_flex().w_full().h(8).flex_none().gap(GAP)
      .child(chase(grow(div().id("bottom-arm-0").h_full().bg(f.mute), on, 120, 0), red, 4))
      .child(chase(div().id("bottom-arm-1").relative().flex_1().h_full().overflow_hidden()
        .child(fade(div().id("bottom-arm-1-fill").relative().size_full().child(gradient(f.slate, f.steel)), on, 3)), red, 3))
      .child(chase(grow(div().id("bottom-arm-2").h_full().bg(f.ice), on, 80, 6), red, 2))
      .child(chase(grow(div().id("bottom-arm-3").h_full().bg(f.crimson).rounded_tr(4).rounded_br(4), on, 30, 8), red, 1));
    return h_flex().id("bottom").size_full().bg(P.bg).on_mouse_down("right", onRight(globalMenu))
      .child(corner)
      .child(v_flex().flex_1().h_full().min_w(0).child(status).child(arm));
  }
}
