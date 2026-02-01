import { useState, useEffect } from 'react'
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

function treeAnimationFrame(rules: Rule[], maxDraw: number, maxValue: bigint, work: TreeNode[], canvas: CanvasRenderingContext2D) {
  for (let i = 0; i < maxDraw && work.length; ++i) {
    const past = work.pop()!
    if (past.value >= maxValue) {
      continue
    }
    canvas.beginPath()
    for (const adj of treeChildren(rules, past)) {
      if (adj.value == 1n) {
        continue
      }
      drawLine(past, adj, canvas)
      work.push(adj)
    }
    canvas.stroke()
  }
}

function App() {
  const collatz: Rule[] = [
    {angle: -10, dist: 10, rule: 'div', d: 2n},
    {angle: 40, dist: 30, rule: 'mul', a: 3n, b: 1n},
  ]

  const [rules] = useState(collatz)
  const [drawPerFrame, setDrawPerFrame] = useState(100)
  const [maxValue, setMaxValue] = useState(1000n)
  const [seed, setSeed] = useState(1n)
  const [origin, setOrigin] = useState({x:100, y:700})

  useEffect(()=> {
    let work: TreeNode[] = [{value: seed, angleHere: 0, depth: 0, ...origin}];
    let handle: number = -1;
    const ctx = (document.getElementById("tree")! as HTMLCanvasElement).getContext("2d")!
    const anim = () => {
      treeAnimationFrame(rules, drawPerFrame, maxValue, work, ctx)
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
      ctx.fillStyle = "lightgrey"
      ctx.fillRect(0,0,ctx.canvas.width, ctx.canvas.height)
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
        }}/></div>
      <label htmlFor="seed">Seed:</label>
      <input name="seed" type="number" className="short" value={seed.toString()} min="0" onChange={v=>setSeed(BigInt(v.target.value))}/>
      <label htmlFor="max">Cutoff value:</label>
      <input name="max" type="number" className="short" value={maxValue.toString()} min="0" onChange={v=>setMaxValue(BigInt(v.target.value))}/>
      <label htmlFor="seed">Edges per second:</label>
      <input name="seed" type="number" className="short" value={(60 * drawPerFrame).toString()} min="0" onChange={v=>setDrawPerFrame(parseInt(v.target.value) / 60)}/>
      <ul>
        {rules.map((rule, modcls) => {
          if (rule.rule == 'div') {
            return (<li>v<sub>n+1</sub> = v<sub>n</sub> / {rule.d} if v<sub>n</sub> ≡ {modcls} (mod {rules.length})</li>)
          }
          if (rule.rule == 'mul') {
            return (<li>v<sub>n+1</sub> = {rule.a}v<sub>n</sub> + {rule.b} if v<sub>n</sub> ≡ {modcls} (mod {rules.length})</li>)
          }
        })}
      </ul>
    </div>
  );
}

export default App
