// author: xhrbac12
import { useState, useEffect, type JSX } from 'react'
import './App.css'

type Update = {
  // ax + b
  rule: 'mul', a: number, b: number
} | {
  // x / d
  rule: 'div', d: number
}


// a single rule of the collatz conjecture
type Rule = {
  angle: number,
  dist: number,
} & Update


// a drawn node of the tree
type TreeNode = {
  value: number,
  angleHere: number,
  depth: number,
  x: number,
  y: number,
}

const RAD_OVER_DEG = Math.PI / 180

// move a point over a distance at an angle in degrees
function shiftPoint(p: {x:number,y:number}, angle: number, dist: number): {x:number,y:number} {
  return {
    x: p.x + Math.cos(angle * RAD_OVER_DEG) * dist,
    y: p.y + Math.sin(angle * RAD_OVER_DEG) * dist,
  }
}

// Given a TreeNode parent, compute values which would, under the rules, lead to parent.value, and offset the corresponding nodes as per the corresponding rule's angle and dist
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


// A single frame of drawing the tree. In order to mitigate lag, this draws at most maxDraw nodes of the tree. work contains TreeNodes whose children haven't been drawn yet, closed contains values which are already on the tree to prevent getting stuck
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

// An input element with type number
function NumericInput(props: {label: string, value: number, setValue: (v: number)=>void}): JSX.Element{
  return (<label>{props.label}<input type="number" className="short" value={props.value} onChange={e=>props.setValue(parseInt(e.target.value))}/></label>)
}

// Updates a single key of a rule in an array of rules or rule subtypes
function updateRuleAt<U extends Rule, T extends keyof U>(rules: U[], i: number, key: T, nvalue: U[T]): Rule[] {
  return rules.map((v, j) => j == i?{...v, [key]:nvalue}:v)
}

function Tutorial() {
  return (<>
    <button popoverTarget='tutorial' popoverTargetAction='toggle'>Help</button>
    <dialog popover="manual" id="tutorial" style={{textAlign: "left", border: "2px solid darkgrey", maxWidth: "80%"}}>
      <h2>Collatz Visualiser</h2>
      <p>This application draws trees starting from some number (set via Seed) on the grey rectangle in the middle of your screen, such that the children of a node are the numbers that would result in that number if
        handled via the configured rules. For example, under the standard collatz conjecture rules, 10 would have the children 20 and 3.
      </p>
      <p>Click on the canvas to choose the placement for the seed number, and tree will grow from it (assuming you didn't pick a Seed and rules that doesn't really go anywhere)</p>
      <p>Cutoff specifies the upper bound of children to draw. Any nodes of a value greater than this will not have their children drawn</p>
      <p>Nodes per second places a limit on the number of nodes to process every second, ensuring your browser doesn't crash on complex trees (it can still happen, but it takes a truly absurd tree)</p>
      <p>Units per side specifies how many pixels the resulting image will be per side</p>
      <p>Number of rules defines the divisor whose remainder your sequence uses</p>
      <p>Each rule is either a multiplication rule in the form ax + b, or a division rule in the form x/a. You can swap between them by clicking the <span className="swap">v<sub>n</sub></span> </p>
      <p>Each child is rotated and offset from its parent by some angle and some distance (in the same units as Unit per side)</p>
      <p>Use the browser back and forward buttons to undo and redo actions</p>
      <button popoverTarget='tutorial' popoverTargetAction='hide'>close</button>
      </dialog>
  </>)
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
  const [dim, setDim] = useState(1080);

  // used for undo/redo
  const fullState = [rules, drawPerFrame, maxValue, seed, origin, dim]
  const setFullState = (t: any) => {
    setRules(t[0])
    setDrawPerFrame(t[1])
    setMaxValue(t[2])
    setSeed(t[3])
    setOrigin(t[4])
    setDim(t[5])
  }

  useEffect(() => {
    // if the url contains a state, replicate it rather than using the defaults
    let searchParams = new URLSearchParams(location.search)
    let sharedState = searchParams.get("state")
    if (sharedState) {
      let json = atob(sharedState)
      let fullState = JSON.parse(json)
      setFullState(fullState)
    }
  }, [])

  // the tree drawing logic.
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
        // make sure excessively large trees can be abbandoned before they're done drawing
        cancelAnimationFrame(handle)
      }
    }
  }, fullState)

  // ensure the URL contains the current settings, and store them in history so that we can undo to them
  useEffect(() => {
    const data = JSON.stringify(fullState)
    const b64 = btoa(data)
    const topData = JSON.stringify(history.state)
    // ew
    if (data != topData) {
      history.pushState(fullState, "--", "?state="+b64)
    }
  }, fullState)

  // If back is executed, restore the state from history
  useEffect(() => {
    const evListener = (ev: PopStateEvent) => {
      setFullState(ev.state)
    }
    addEventListener("popstate", evListener)
    return () => removeEventListener("popstate", evListener)
  }, [])


  return (
    <div>
      <div>
        <canvas 
          style={{ width: "70vmin", height: "70vmin", border: "1px solid darkgrey" }}
          id="tree"
          width={dim}
          height={dim}
          onClick={ev=>{
            const canvas = document.getElementById("tree")! as HTMLCanvasElement
            const bb = canvas.getBoundingClientRect()
            const fix = dim / bb.width
            setOrigin({x: (ev.clientX - bb.left) * fix, y: (ev.clientY - bb.top) * fix})
          }}/>
      </div>
      <Tutorial />
      <NumericInput label="Seed:" value={seed} setValue={setSeed}/>
      <NumericInput label="Cutoff:" value={maxValue} setValue={setMaxValue}/>
      <NumericInput label="Nodes per second:" value={drawPerFrame * 60} setValue={v=>setDrawPerFrame(v/60)}/>
      <NumericInput label="Units per side:" value={dim} setValue={setDim}/>
      <NumericInput label="Number of rules:" value={rules.length} setValue={v=>{
        if (v < 2) return;
        if (v == 2) setRules(collatz);
        else if (v == 3) setRules([
          {angle: -10, dist: 5, rule: 'div', d: 3},
          {angle: 10, dist: 15, rule: 'mul', a: 5, b: 1},
          {angle: 20, dist: 25, rule: 'mul', a: 5, b: 2},
        ])
        else {
          const nRules: Rule[] = []
          for (let i = 0; i < v; ++i) {
            nRules.push({angle: i+1, dist: 5, rule: 'mul', a: 1, b: i})
          }
          setRules(nRules)
        }
      }} />
      <ul>
        {rules.map((rule, modcls) => {
          if (rule.rule == 'div') {
            return (<li key={modcls}>
              v<sub>n+1</sub> =<span className='swap'
                onClick={()=>setRules(rules.map((v,i)=>i==modcls?({...v, rule:'mul', a: 1, b: modcls}):v))}
              >  v<sub>n</sub> </span>
              <NumericInput label=" / " value={rule.d} setValue={v=>setRules(updateRuleAt(rules as (Rule & {rule: 'div'})[], modcls, "d", v))}/>
              if v<sub>n</sub> ≡ {modcls} (mod {rules.length}).
              <NumericInput label="Turn by " value={rule.angle} setValue={v=>setRules(updateRuleAt(rules, modcls, "angle", v))}/>°,
              and <NumericInput label="move by " value={rule.dist} setValue={v=>setRules(updateRuleAt(rules, modcls, "dist", v))}/>
            </li>)
          }
          if (rule.rule == 'mul') {
            return (<li key={modcls}>v<sub>n+1</sub> 
            <NumericInput label=" = " value={rule.a} setValue={v=>setRules(updateRuleAt(rules as (Rule & {rule: 'mul'})[], modcls, "a", v))}/>
              <span className="swap" onClick={()=>setRules(rules.map((v,i)=>i==modcls?{...v, rule:'div', d: 1}:v))}> v<sub>n</sub> </span>
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
