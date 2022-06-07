
import { base32 } from 'multiformats/bases/base32'

export const initGraph = () => {
  return {
    nodes: new Map(),
    missing: new Set(),
    denied: new Set()
  }
}

export const cloneGraph = ({ nodes, missing, denied }) => {
  return {
    nodes: new Map(nodes),
    missing: new Set(missing),
    denied: new Set(denied)
  }
}

const initNode = () => {
  return {
    in: new Set(),
    out: new Set()
  }
}

// 'ni' because 'in' is a token
const cloneNode = ({ in: ni, out }) => {
  return {
    in: new Set(ni),
    out: new Set(out)
  }
}

export const hasNode = graph => cid => {
  cid = cid.toString(base32)
  return graph.nodes.has(cid) && (!graph.missing.has(cid) && !graph.denied.has(cid))
}
export const knownNode = graph => cid => graph.nodes.has(cid.toString(base32))
const unknownNode = graph => cid => !knownNode(graph)(cid)

const getNode = (graph, cid) => graph.nodes.get(cid) || initNode()
const setNode = (graph, cid, node) => { graph.set(cid, node); return node }

const passClone = graph => adjacent => setNode(graph, adjacent, cloneNode(getNode(graph, adjacent)))

const addReference = cid => node => node.out.add(cid)
const removeReference = cid => node => node.out.delete(cid)
const addReverse = cid => node => node.in.add(cid)
const removeReverse = cid => node => node.in.delete(cid)

export function addNode (graph, cid, out) {
  cid = cid.toString(base32)
  out = Array.from(new Set(out.map(cid => cid.toString(base32))))
  const clone = cloneNode(getNode(graph, cid))

  graph.missing.delete(cid)
  graph.denied.delete(cid)

  // add unknown cids to missing
  out.filter(unknownNode(graph)).map(graph.missing.add.bind(graph.missing))

  // set node.out equal to intersection of out and cids of nodes the graph has
  clone.out = new Set(out.filter(hasNode(graph)))

  // add cid to node.out of each in
  clone.in.map(passClone(graph)).map(addReference(cid))

  // add cid to node.in of each out
  out.map(passClone(graph)).map(addReverse(cid))

  graph.set(cid, clone)
}

function removeNode (graph, cid) {
  const clone = cloneNode(getNode(graph, cid))

  // remove cid from node.in of each out
  clone.out.map(passClone(graph)).map(removeReference(cid))

  // remove cid from node.out of each in
  clone.out.map(passClone(graph)).map(removeReverse(cid))

  // set node.out equal to empty
  clone.out.clear()

  graph.set(cid, clone)
}

export function missNode (graph, cid) {
  cid = cid.toString(base32)
  removeNode(graph, cid)
  graph.missing.add(cid)
  graph.denied.delete(cid)
}

export function denyNode (graph, cid) {
  cid = cid.toString(base32)
  removeNode(graph, cid)
  graph.missing.delete(cid)
  graph.denied.add(cid)
}

export function heads (graph) {
  function * getHeads () {
    for (const [cid, node] of graph.entries()) {
      if (!node.in.size && hasNode(graph)(cid)) {
        yield cid
      }
    }
  }
  return new Set(getHeads())
}

export function tails (graph) {
  function * getTails () {
    for (const [cid, node] of graph.entries()) {
      if (!node.out.size && hasNode(graph)(cid)) {
        yield cid
      }
    }
  }
  return new Set(getTails())
}

export function missing (graph) {
  return graph.missing
}

export function denied (graph) {
  return graph.denied
}

export function size ({ nodes, missing, denied }) {
  return nodes.size - missing.size - denied.size
}
