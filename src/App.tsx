import { useState, useEffect, type JSX } from 'react'
import './App.css'

type Update = {
  // ax + b
  rule: 'mul', a: bigint, b: bigint
} | {
  rule: 'div', d: bigint
}

type Rule = {
  angle: number,
  dist: number,
} & Update

type TreeNode = {
  value: bigint,
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
      if (nValue % BigInt(rules.length) != BigInt(i)) {
        continue
      }
      let nAngle = parent.angleHere + rule.angle
      yield {value: nValue, angleHere: nAngle, depth: parent.depth + 1, ...shiftPoint(parent, nAngle, rule.dist)}
    }
    if (rule.rule == 'mul') {
      if ((parent.value - rule.b) % rule.a == 0n) {
        let nValue = (parent.value - rule.b) / rule.a
        if (nValue % BigInt(rules.length) != BigInt(i)) {
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

function treeAnimationFrame(rules: Rule[], maxDraw: number, maxValue: bigint, work: TreeNode[], canvas: CanvasRenderingContext2D, closed: Set<bigint>) {
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

function BigIntInput(props: {label: string, value: bigint, setValue: (v: bigint)=>void}): JSX.Element{
  return (<label>{props.label}<input type="number" className="short" value={props.value.toString()} onChange={e=>props.setValue(BigInt(e.target.value))}/></label>)
}

function updateRuleAt<U extends Rule, T extends keyof U>(rules: U[], i: number, key: T, nvalue: U[T]): Rule[] {
  return rules.map((v, j) => j == i?{...v, [key]:nvalue}:v)
}

function App() {
  const collatz: Rule[] = [
    {angle: -10, dist: 5, rule: 'div', d: 2n},
    {angle: 20, dist: 20, rule: 'mul', a: 3n, b: 1n},
  ]

  const [rules, setRules] = useState(collatz)
  const [drawPerFrame, setDrawPerFrame] = useState(200)
  const [maxValue, setMaxValue] = useState(10000n)
  const [seed, setSeed] = useState(1n)
  const [origin, setOrigin] = useState({x:100, y:700})

  useEffect(()=> {
    let work: TreeNode[] = [{value: seed, angleHere: 0, depth: 0, ...origin}];
    let closed = new Set<bigint>()
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
  }, [rules, maxValue, drawPerFrame, seed, origin])

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
      <BigIntInput label="Seed:" value={seed} setValue={setSeed}/>
      <BigIntInput label="Cutoff:" value={maxValue} setValue={setMaxValue}/>
      <NumericInput label="Edges per second:" value={drawPerFrame * 60} setValue={v=>setDrawPerFrame(v/60)}/>
      <ul>
        {rules.map((rule, modcls) => {
          if (rule.rule == 'div') {
            return (<li>
              v<sub>n+1</sub> = v<sub>n</sub>
              <BigIntInput label=" / " value={rule.d} setValue={v=>setRules(updateRuleAt(rules as (Rule & {rule: 'div'})[], modcls, "d", v))}/>
              if v<sub>n</sub> ≡ {modcls} (mod {rules.length}).
              <NumericInput label="Turn by " value={rule.angle} setValue={v=>setRules(updateRuleAt(rules, modcls, "angle", v))}/>°,
              and <NumericInput label="move by " value={rule.dist} setValue={v=>setRules(updateRuleAt(rules, modcls, "dist", v))}/>
            </li>)
          }
          if (rule.rule == 'mul') {
            return (<li>v<sub>n+1</sub> 
            <BigIntInput label=" = " value={rule.a} setValue={v=>setRules(updateRuleAt(rules as (Rule & {rule: 'mul'})[], modcls, "a", v))}/>v<sub>n</sub>
            <BigIntInput label=" + " value={rule.b} setValue={v=>setRules(updateRuleAt(rules as (Rule & {rule: 'mul'})[], modcls, "b", v))}/>
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
