// LCARS: the frame of the lcars layout. One mod draws every part; the layout says which with props().part:
// "top" (the upper elbow, arm and title), "side" (spaces and crew as LCARS buttons), "tabs" (the tab pills),
// "systems" (the right rail: this computer's load, the agents by state, a number cascade) and "bottom" (the lower
// elbow and the status arm). As a popup it is "machines" (where a new space goes).
// Right-clicks open Herdr's own menu mod, so rename, close, split and worktrees work as in its other layouts.
import { View, div, svg, PathBuilder, Background } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, agents, machines, run, props, setAgentOrder, window as appWindow, openOverlay, closeOverlay, exec, shared, setShared,
  playSound, checking } from "herdr";

const C = {
  black: "#000000", orange: "#ff9900", peach: "#ff9966", gold: "#ffcc66", tan: "#ffcc99", lilac: "#cc99cc",
  violet: "#9999ff", blue: "#99ccff", sky: "#5599ff", red: "#ff5544", gray: "#666688",
};
// the frame's colours on red alert: every slab a red, so the whole window says it. Status colours stay as they are.
const RED = { ...C, orange: "#ff5544", peach: "#ff8877", tan: "#ffb3a6", lilac: "#ff8877", violet: "#ff9988",
  blue: "#ff6655", sky: "#ff6655", gray: "#b3594d", gold: "#ffb3a6" };
const STATUS = { working: C.blue, blocked: C.red, done: C.gold, idle: C.violet };
const WORD = { working: "WORKING", blocked: "NEEDS YOU", done: "DONE", idle: "STANDING BY" };
const SIDE = 210; // the sidebar's width, which the elbows match
const RAIL = 176; // the systems rail's width
const ARM = 20; // the thickness of the horizontal arms
const GAP = 4; // black between LCARS blocks
const TRACK = "#1b1b2a"; // the empty part of a gauge

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
const ALERT = "lcars.alert";
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
const frame = () => (alert() ? RED : C);
// on red alert the arms' slabs pulse, each at its own pace, so the light seems to run along them
const chase = (el, on, i) => (on ? el.loop("opacity", { from: 0.35, to: 1, period: 700 + i * 170 }) : el);

// This computer's load, for the systems rail: one small shell script every SYS ms, never while `herdr-app check` runs.
// CPU is every process's share added up over the cores; memory is what is in use (active, wired and compressed on
// macOS; total less available on Linux); disk is the data volume's.
const SYS = 5000;
const SYS_SCRIPT = String.raw`
case "$(uname)" in
Darwin)
  echo "ncpu $(sysctl -n hw.ncpu)"
  echo "load $(sysctl -n vm.loadavg | tr -d '{}')"
  echo "memtotal $(sysctl -n hw.memsize)"
  vm_stat | awk -v ps="$(sysctl -n hw.pagesize)" '/Pages active|Pages wired down|occupied by compressor/ {gsub(/\./,"",$NF); s+=$NF} END {printf "memused %.0f\n", s*ps}'
  df -k /System/Volumes/Data 2>/dev/null | awk 'NR==2 {print "disk " $3 " " $3+$4}' ;;
*)
  echo "ncpu $(nproc)"
  echo "load $(cut -d' ' -f1-3 /proc/loadavg)"
  awk '/MemTotal/ {t=$2} /MemAvailable/ {a=$2} END {printf "memtotal %.0f\nmemused %.0f\n", t*1024, (t-a)*1024}' /proc/meminfo
  df -k / | awk 'NR==2 {print "disk " $3 " " $3+$4}' ;;
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
    ncpu, cpu: frac(v.cpusum?.[0] ?? 0, ncpu * 100), load: v.load ?? [0, 0, 0],
    mem: frac(v.memused?.[0], v.memtotal?.[0]), memGb: (v.memused?.[0] ?? 0) / 2 ** 30, memTotalGb: (v.memtotal?.[0] ?? 0) / 2 ** 30,
    disk: frac(v.disk?.[0], v.disk?.[1]),
  };
}
// the telemetry cascade: rows of made-up numbers, each row stepping through its own list at its own pace
const CASCADE = Array.from({ length: 40 }, (_, row) => {
  const num = (n) => String(Math.floor(Math.random() * 10 ** n)).padStart(n, "0");
  return { ms: 420 + ((row * 173) % 610), list: Array.from({ length: 12 }, () => `${num(4)} ${num(4)} ${num(3)} ${num(2)} ${num(4)}`) };
});

// a layer that fills its (relative) parent with a left-to-right gradient
const RECT = () => PathBuilder.fill().move_to("0%", "0%").line_to("100%", "0%").line_to("100%", "100%").line_to("0%", "100%").close().build();
const gradient = (from, to) => window.paint_path(RECT(), Background.linear_gradient(90, from, to)).absolute().top(0).left(0).size_full();

// a block of LCARS colour with a black label set in its bottom-right corner
function slab(id, color, label, h, extra) {
  let el = div().id(id).w_full().h(h).flex_none().bg(color).flex().items_end().justify_end().px(10).pb(2)
    .text_color(C.black).text_size(15).font_weight(700).child(up(label));
  return extra ? extra(el) : el;
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
  openOverlay({ mod: "lcars", kind: "popup", width: 230, height: 60 + 44 * (away.length + 1),
    frame: "none", props: { part: "machines" } });
}

export default class Lcars extends View {
  init(_props, cx) {
    this.now = Date.now();
    cx.timer.every(15000, (cx) => { this.now = Date.now(); cx.notify(); });
    const part = _props?.part ?? props()?.part;
    if (part === "side") cx.timer.every(WATCH, () => this.watch());
    if (part === "systems" && !checking()) {
      this.measure(cx);
      cx.timer.every(SYS, (cx) => this.measure(cx));
    }
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
    if (part === "systems") return this.systems();
    if (part === "bottom") return this.bottom();
    if (part === "machines") return this.machines();
    return div().child(`lcars: unknown part ${part}`);
  }

  machines() {
    const close = () => closeOverlay(props()?.overlay);
    const all = [{ name: null, layout: "ready" }, ...machines().filter((m) => m.name)];
    const colors = [C.tan, C.lilac, C.peach, C.blue, C.violet];
    const row = (m, i) => {
      const ready = m.layout === "ready";
      return slab(`new-space-${m.name ?? "local"}`, ready ? colors[i % colors.length] : C.gray,
        `${m.name ?? "this computer"}${ready ? "" : " · " + m.layout}`, 40, (el) => el
          .when(ready, (el) => el.cursor_pointer().hover((st) => st.opacity(0.85))
            .on_click(() => { close(); run("space.new", m.name ? { machine: m.name } : {}); })));
    };
    return v_flex().size_full().bg(C.black).rounded(14).p(6).gap(GAP)
      .child(slab("new-space-title", C.orange, "new space on", 30, (el) => el.rounded_tl(12).rounded_tr(12)))
      .children(all.map(row));
  }

  top() {
    const f = frame(), red = alert();
    const space = spaces().find((s) => s.active);
    const need = agents().filter((a) => a.status === "blocked").length;
    const elbow = div().w(SIDE).h_full().flex_none().bg(f.orange).rounded_tl(44)
      .flex().items_end().justify_end().px(10).pb(4).text_color(C.black).text_size(13).font_weight(700)
      .child(up(space?.machine ?? "this computer"));
    const arm = h_flex().w_full().h(ARM).flex_none().gap(GAP)
      .child(chase(div().id("top-arm-0").w(160).h_full().bg(f.orange), red, 0))
      .child(chase(div().id("top-arm-1").w(70).h_full().bg(f.lilac), red, 1))
      .child(chase(div().id("top-arm-2").flex_1().h_full().bg(f.tan), red, 2))
      .child(chase(div().id("top-arm-3").w(46).h_full().bg(f.blue).rounded_tr(10).rounded_br(10), red, 3));
    // the concave inner corner: black with a rounded top-left corner, over the elbow's colour
    const title = div().w_full().flex_1().bg(f.orange).child(
      h_flex().size_full().bg(C.black).rounded_tl(26).items_center().gap(14).pl(30).pr(4)
        .when(red, (el) => el.child(div().id("red-alert").flex_none().h(24).px(14).rounded(12).bg(C.red).flex().items_center()
          .text_color(C.black).text_size(15).font_weight(700).loop("opacity", { from: 0.45, to: 1, period: 900 })
          .child(`RED ALERT · ${two(need)} ${need === 1 ? "AGENT NEEDS" : "AGENTS NEED"} YOU`)))
        .child(div().flex_1())
        .child(div().text_color(f.gold).text_size(13).font_weight(700).child(`STARDATE ${stardate(this.now)}`))
        .child(div().text_color(f.orange).text_size(30).font_weight(700).child(up(space?.name ?? "HERDR"))));
    return h_flex().id("top").size_full().bg(C.black).on_mouse_down("right", onRight(globalMenu))
      .child(elbow)
      .child(v_flex().flex_1().h_full().child(arm).child(title));
  }

  side() {
    const f = frame();
    const list = spaces();
    const crew = agents();
    waiting(); // notes when each blocked agent started waiting, for the red alert
    setAgentOrder(crew.map((a) => a.address));
    const colors = [f.tan, f.lilac, f.peach, f.blue, f.violet];
    const space = (s, i) => {
      const color = s.active ? f.orange : s.status === "blocked" ? C.red : colors[i % colors.length];
      return h_flex().id(`space-${s.id}`).w_full().h(40).flex_none().bg(color).items_end().justify_between().px(10).pb(2)
        .text_color(C.black).font_weight(700).cursor_pointer()
        .hover((st) => st.opacity(0.85))
        .when(s.status === "blocked" && !s.active, (el) => el.loop("opacity", { from: 0.55, to: 1, period: 900 }))
        .on_click(() => run("space.select", { id: s.id }))
        .on_mouse_down("right", onRight(() => menu("space", { id: s.id })))
        .child(div().text_size(12).child(`${two(s.index)}${s.machine ? "-" + up(s.machine) : ""}`))
        .child(div().text_size(15).truncate().child(up(s.name)));
    };
    const member = (a) => h_flex().id(`agent-${a.address}`).w_full().h(40).flex_none().gap(6).items_center()
      .cursor_pointer().hover((st) => st.opacity(0.85))
      .on_click(() => run("agent.focus", { terminal: a.address }))
      .on_mouse_down("right", onRight(() => menu("pane", { pane: a.pane, terminal: a.address })))
      .child(div().w(14).h_full().bg(STATUS[a.status] ?? C.gray).rounded_l(15)
        .when(a.status === "blocked", (el) => el.loop("opacity", { from: 0.4, to: 1, period: 700 })))
      .child(v_flex().flex_1().min_w(0)
        .child(div().text_size(13).font_weight(700).text_color(a.focused ? C.orange : C.tan).truncate()
          .child(up(`${a.program?.name ?? a.app ?? "agent"} · ${a.tab_name}`)))
        .child(div().text_size(11).text_color(STATUS[a.status] ?? C.gray).truncate()
          .child(`${WORD[a.status] ?? up(a.status)} · ${up(a.space_name)}`)));
    return v_flex().id("side").size_full().bg(C.black).gap(GAP).on_mouse_down("right", onRight(globalMenu))
      .child(div().w_full().h(18).flex_none().bg(f.orange)) // carries the top elbow down
      .child(slab("spaces-label", f.peach, `spaces ${two(list.length)}`, 26))
      .children(list.map(space))
      .child(slab("space-new", f.gray, "+ new space", 30, (el) => el.cursor_pointer()
        .hover((st) => st.bg(C.violet)).on_click(() => newSpace()).on_mouse_down("right", onRight(newSpace))))
      .child(slab("crew-label", f.lilac, `crew ${two(crew.length)}`, 26))
      .child(v_flex().id("crew").w_full().flex_none().gap(2).pr(4).children(crew.map(member)))
      .child(div().w_full().flex_1().min_h(10).bg(f.gray)); // runs into the bottom elbow
  }

  tabs() {
    const f = frame();
    const space = spaces().find((s) => s.active);
    const pill = (t) => {
      const color = t.active ? f.orange : STATUS[t.status] ?? C.tan;
      return h_flex().id(`tab-${t.id}`).h_full().flex_none().px(16).rounded(15).bg(color).items_center()
        .text_color(C.black).text_size(14).font_weight(700).cursor_pointer()
        .hover((st) => st.opacity(0.85))
        .when(t.status === "blocked" && !t.active, (el) => el.loop("opacity", { from: 0.5, to: 1, period: 800 }))
        .on_click(() => run("tab.select", { id: t.id }))
        .on_mouse_down("right", onRight(() => menu("tab", { id: t.id, space: space.id })))
        .child(`${two(t.index)} ${up(t.name)}`);
    };
    return h_flex().id("tab-bar").size_full().gap(GAP + 2).items_center().overflow_x_scrollbar()
      .on_mouse_down("right", onRight(globalMenu))
      .children((space?.tabs ?? []).filter((t) => !t.settled).map(pill))
      .child(h_flex().id("tab-new").h_full().flex_none().px(14).rounded(15).bg(f.gray).items_center()
        .text_color(C.black).text_size(22).font_weight(700).cursor_pointer().hover((st) => st.bg(C.violet))
        .on_click(() => newMenu()).on_mouse_down("right", onRight(newMenu)).child("+"));
  }

  // The right rail: this computer's load as gauges that ease to each new reading, the agents by state, and a cascade
  // of numbers. Before the first reading the gauges are empty and read "--".
  systems() {
    const f = frame();
    const s = this.sys;
    const inner = RAIL - 14; // the rail less its side padding: a full gauge
    const pct = (x) => `${Math.round(x * 100)}%`;
    const gauge = (id, label, value, share, from, to) => v_flex().w_full().gap(3)
      .child(h_flex().w_full().justify_between().text_size(12).font_weight(700).text_color(C.tan)
        .child(label).child(div().text_color(to).child(value)))
      .child(div().w_full().h(8).rounded(4).bg(TRACK).overflow_hidden()
        .child(div().id(id).relative().h_full().w(Math.round(inner * share)).overflow_hidden()
          .transition("width", { duration: 900, easing: "ease-out" }).child(gradient(from, to))));
    const crew = agents();
    const state = (key, label) => {
      const n = crew.filter((a) => a.status === key).length;
      return h_flex().w_full().gap(6).items_center().text_size(12).font_weight(700).text_color(STATUS[key])
        .child(div().w(58).flex_none().child(label))
        .child(div().flex_1().h(6).bg(TRACK)
          .child(div().id(`fleet-${key}`).h_full().w(Math.round((inner - 58 - 22 - 12) * (crew.length ? n / crew.length : 0)))
            .bg(STATUS[key]).transition("width", { duration: 600, easing: "ease-out" })))
        .child(div().w(22).flex_none().flex().justify_end().child(two(n)));
    };
    const load = s ? s.load.map((x) => x.toFixed(1)).join(" ") : "--";
    return v_flex().id("systems").size_full().bg(C.black).gap(GAP).py(8).on_mouse_down("right", onRight(globalMenu))
      .child(slab("systems-label", f.blue, "systems", 24, (el) => el.rounded_tl(12)))
      .child(v_flex().w_full().flex_none().gap(9).pl(4).pr(10).py(6)
        .child(gauge("sys-cpu", `CPU · ${s ? s.ncpu : "--"} CORES`, s ? pct(s.cpu) : "--", s?.cpu ?? 0, C.sky, C.blue))
        .child(gauge("sys-mem", "MEMORY", s ? `${pct(s.mem)} · ${s.memGb.toFixed(1)} GB` : "--", s?.mem ?? 0, C.lilac, C.tan))
        .child(gauge("sys-disk", "DISK", s ? pct(s.disk) : "--", s?.disk ?? 0, C.peach, C.gold))
        .child(h_flex().w_full().justify_between().text_size(12).font_weight(700).text_color(C.tan)
          .child("LOAD").child(div().text_color(C.violet).child(load))))
      .child(slab("fleet-label", f.lilac, "fleet", 22))
      .child(v_flex().w_full().flex_none().gap(5).pl(4).pr(10).py(6)
        .child(state("working", "WORKING")).child(state("blocked", "NEED YOU"))
        .child(state("done", "DONE")).child(state("idle", "STANDBY")))
      .child(slab("telemetry-label", f.tan, "telemetry", 22))
      .child(v_flex().id("telemetry").w_full().flex_1().min_h(0).overflow_hidden().pl(4).pt(4).gap(2)
        .children(CASCADE.map((c, i) => div().flex_none().text_size(11).text_color([f.tan, C.blue, f.tan, f.tan, C.gold][i % 5])
          .frames(c.list, c.ms).child(c.list[0]))));
  }

  bottom() {
    const f = frame(), red = alert();
    const crew = agents();
    const count = (s) => crew.filter((a) => a.status === s).length;
    const away = machines().filter((m) => m.name).length;
    const clock = new Date(this.now).toTimeString().slice(0, 5);
    const elbow = div().id("menu").w(SIDE).h_full().flex_none().bg(f.gray).rounded_bl(40)
      .flex().items_start().justify_end().px(10).pt(4).text_color(C.black).text_size(13).font_weight(700)
      .cursor_pointer().hover((st) => st.bg(C.violet)).on_click(() => menu("global", {}))
      .child(h_flex().gap(10).items_center()
        // the gear opens Herdr's settings; stopping its press keeps the elbow's MENU from opening too
        .child(div().id("settings").cursor_pointer().hover((st) => st.opacity(0.6))
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .on_mouse_down("right", (_e, cx) => cx.stop_propagation())
          .on_click(() => run("app.settings"))
          .child(svg("mods/lcars/gear.svg").size(16).text_color(C.black)))
        .child("MENU"));
    const status = div().w_full().flex_1().bg(f.gray).child(
      h_flex().size_full().bg(C.black).rounded_bl(22).items_center().gap(18).pl(18).text_size(12).font_weight(700)
        .child(div().text_color(C.blue).child(`${two(count("working"))} WORKING`))
        .child(div().text_color(count("blocked") ? C.red : C.gray).child(`${two(count("blocked"))} NEED YOU`))
        .child(div().text_color(C.gold).child(`${two(count("done"))} DONE`))
        .child(div().text_color(C.lilac).child(`${two(away + 1)} MACHINES`))
        .child(div().flex_1())
        .child(div().id("palette").text_color(C.tan).cursor_pointer().on_click(() => run("app.palette"))
          .child(`${appWindow()?.platform === "macos" ? "⌘" : "CTRL"} SHIFT P · ${clock}`)));
    const arm = h_flex().w_full().h(16).flex_none().gap(GAP)
      .child(chase(div().id("bottom-arm-0").w(120).h_full().bg(f.gray), red, 3))
      .child(chase(div().id("bottom-arm-1").flex_1().h_full().bg(f.sky), red, 2))
      .child(chase(div().id("bottom-arm-2").w(90).h_full().bg(f.peach), red, 1))
      .child(chase(div().id("bottom-arm-3").w(46).h_full().bg(f.orange).rounded_tr(8).rounded_br(8), red, 0));
    return h_flex().id("bottom").size_full().bg(C.black).on_mouse_down("right", onRight(globalMenu))
      .child(elbow)
      .child(v_flex().flex_1().h_full().child(status).child(arm));
  }
}
