import { useState, useEffect, type JSX } from 'react'
import './App.css'

type Update = {
  // ax + b
  rule: 'mul', a: number, b: number
} | {
  rule: 'div', d: number
}

type Rule = {
  angle: number,
  dist: number,
} & Update

type TreeNode = {
  value: number,
  angleHere: number,
  depth: number,
  x: number,
  y: number,
}

const RAD_OVER_DEG = Math.PI / 180

function shiftPoint(p: {x:number,y:number}, angle: number, dist: number): {x:number,y:number} {
  return {
    x: p.x + Math.cos(angle * RAD_OVER_DEG) * dist,
    y: p.y + Math.sin(angle * RAD_OVER_DEG) * dist,
  }
}
function* treeChildren(rules: Rule[], parent: TreeNode) {
  for (const [i, rule] of rules.entries()) {
    if (rule.rule == 'div') {
      let nValue = parent.value * rule.d;
      if (nValue % rules.length != i) {
        continue
      }
      let nAngle = parent.angleHere + rule.angle
      yield {value: nValue, angleHere: nAngle, depth: parent.depth + 1, ...shiftPoint(parent, nAngle, rule.dist)}
    }
    if (rule.rule == 'mul') {
      if ((parent.value - rule.b) % rule.a == 0) {
        let nValue = (parent.value - rule.b) / rule.a
        if (nValue % rules.length != i) {
          continue
        }
        let nAngle = parent.angleHere + rule.angle
        yield {value: nValue, angleHere: nAngle, depth: parent.depth + 1, ...shiftPoint(parent, nAngle, rule.dist)}
      }
    }
  }
}

function drawLine(from: TreeNode, to: TreeNode, ctx: CanvasRenderingContext2D) {
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)

}

function treeAnimationFrame(rules: Rule[], maxDraw: number, maxValue: number, work: TreeNode[], canvas: CanvasRenderingContext2D, closed: Set<number>) {
  for (let i = 0; i < maxDraw && work.length; ++i) {
    const past = work.pop()!
    if (past.value >= maxValue) {
      continue
    }
    canvas.beginPath()
    for (const adj of treeChildren(rules, past)) {
      if (closed.has(adj.value)) {
        continue;
      }
      closed.add(adj.value);
      drawLine(past, adj, canvas)
      work.push(adj)
    }
    canvas.stroke()
  }
}

function NumericInput(props: {label: string, value: number, setValue: (v: number)=>void}): JSX.Element{
  return (<label>{props.label}<input type="number" className="short" value={props.value} onChange={e=>props.setValue(parseInt(e.target.value))}/></label>)
}

function updateRuleAt<U extends Rule, T extends keyof U>(rules: U[], i: number, key: T, nvalue: U[T]): Rule[] {
  return rules.map((v, j) => j == i?{...v, [key]:nvalue}:v)
}

function App() {
  const collatz: Rule[] = [
    {angle: -10, dist: 5, rule: 'div', d: 2},
    {angle: 20, dist: 20, rule: 'mul', a: 3, b: 1},
  ]

  const [rules, setRules] = useState(collatz)
  const [drawPerFrame, setDrawPerFrame] = useState(200)
  const [maxValue, setMaxValue] = useState(10000)
  const [seed, setSeed] = useState(1)
  const [origin, setOrigin] = useState({x:100, y:700})
  const fullState = [rules, drawPerFrame, maxValue, seed, origin]
  const setFullState = (t: any) => {
    setRules(t[0])
    setDrawPerFrame(t[1])
    setMaxValue(t[2])
    setSeed(t[3])
    setOrigin(t[4])
  }

  useEffect(() => {
    let searchParams = new URLSearchParams(location.search)
    let sharedState = searchParams.get("state")
    if (sharedState) {
      let json = atob(sharedState)
      let fullState = JSON.parse(json)
      setFullState(fullState)
    }
  }, [])

  useEffect(()=> {
    let work: TreeNode[] = [{value: seed, angleHere: 0, depth: 0, ...origin}];
    let closed = new Set<number>()
    let handle: number = -1;
    const ctx = (document.getElementById("tree")! as HTMLCanvasElement).getContext("2d")!
    ctx.fillStyle = "lightgrey"
    ctx.fillRect(0,0,ctx.canvas.width, ctx.canvas.height)
    const anim = () => {
      treeAnimationFrame(rules, drawPerFrame, maxValue, work, ctx, closed)
      if (work.length) {
        handle = requestAnimationFrame(() => anim())
      } else {
        handle = -1
      }
    }
    handle = requestAnimationFrame(() => {
      anim()
    })
    return () => {
      if (handle > -1) {
        cancelAnimationFrame(handle)
      }
    }
  }, fullState)

  useEffect(() => {
    const data = JSON.stringify(fullState)
    const b64 = btoa(data)
    const topData = JSON.stringify(history.state)
    // ew
    if (data != topData) {
      history.pushState(fullState, "--", "?state="+b64)
    }
  }, fullState)

  useEffect(() => {
    const evListener = (ev: PopStateEvent) => {
      setFullState(ev.state)
    }
    addEventListener("popstate", evListener)
    return () => removeEventListener("popstate", evListener)
  }, [])

  const DIM = 1080;

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <div>
        <canvas 
          style={{ width: "70vmin", height: "70vmin", border: "1px solid darkgrey" }}
          id="tree"
          width={DIM}
          height={DIM}
          onClick={ev=>{
            const canvas = document.getElementById("tree")! as HTMLCanvasElement
            const bb = canvas.getBoundingClientRect()
            const fix = DIM / bb.width
            setOrigin({x: (ev.clientX - bb.left) * fix, y: (ev.clientY - bb.top) * fix})
          }}/>
      </div>
      <NumericInput label="Seed:" value={seed} setValue={setSeed}/>
      <NumericInput label="Cutoff:" value={maxValue} setValue={setMaxValue}/>
      <NumericInput label="Edges per second:" value={drawPerFrame * 60} setValue={v=>setDrawPerFrame(v/60)}/>
      <ul>
        {rules.map((rule, modcls) => {
          if (rule.rule == 'div') {
            return (<li key={modcls}>
              v<sub>n+1</sub> = v<sub>n</sub>
              <NumericInput label=" / " value={rule.d} setValue={v=>setRules(updateRuleAt(rules as (Rule & {rule: 'div'})[], modcls, "d", v))}/>
              if v<sub>n</sub> ≡ {modcls} (mod {rules.length}).
              <NumericInput label="Turn by " value={rule.angle} setValue={v=>setRules(updateRuleAt(rules, modcls, "angle", v))}/>°,
              and <NumericInput label="move by " value={rule.dist} setValue={v=>setRules(updateRuleAt(rules, modcls, "dist", v))}/>
            </li>)
          }
          if (rule.rule == 'mul') {
            return (<li key={modcls}>v<sub>n+1</sub> 
            <NumericInput label=" = " value={rule.a} setValue={v=>setRules(updateRuleAt(rules as (Rule & {rule: 'mul'})[], modcls, "a", v))}/>v<sub>n</sub>
            <NumericInput label=" + " value={rule.b} setValue={v=>setRules(updateRuleAt(rules as (Rule & {rule: 'mul'})[], modcls, "b", v))}/>
              if v<sub>n</sub> ≡ {modcls} (mod {rules.length}).
              <NumericInput label="Turn by " value={rule.angle} setValue={v=>setRules(updateRuleAt(rules, modcls, "angle", v))}/>°,
              and <NumericInput label="move by " value={rule.dist} setValue={v=>setRules(updateRuleAt(rules, modcls, "dist", v))}/>
            </li>)
          }
        })}
      </ul>
    </div>
  );
}

export default App
