
import Graph from './graph.js'
// import EventEmitter from 'events'
import { CID } from 'multiformats/cid'
import { base32 } from 'multiformats/bases/base32'
import { compare } from 'uint8arrays/compare'

const sortEntries = (e1, e2) => compare(e1.cid.bytes, e2.cid.bytes)

export class Replica {
  constructor ({ manifest, blocks, Entry, Identity, graph }) {
    this.manifest = manifest
    this.blocks = blocks
    this.Entry = Entry
    this.Identity = Identity

    this._graph = graph
  }

  static async open ({ manifest, blocks, Entry, Identity, storage }) {
    const graph = Graph.initGraph()

    return new Replica({ manifest, blocks, Entry, Identity, storage, graph })
  }

  async close () {
    await this.storage.close()
  }

  get height () {}
  get size () { return Graph.size(this._graph) }

  get heads () { return Graph.heads(this._graph) }
  get tails () { return Graph.tails(this._graph) }
  get missing () { return Graph.missing(this._graph) }
  get denied () { return Graph.denied(this._graph) }

  static traverse ({ blocks, heads, tails, missing, denied, Entry, Identity }) {
    const seen = new Set()
    const skip = (cid) => seen.has(cid) || missing.has(cid) || denied.has(cid)

    async function * process (queue) {
      queue.sort(sortEntries)
      const nexts = new Set()

      for await (const cid of queue) {
        const entry = await Entry.fetch({
          blocks,
          Identity,
          cid: CID.parse(cid, base32)
        })

        entry.next.forEach(cid => nexts.add(cid.toString(base32)))
        yield entry
      }

      const nextQueue = Array.from(nexts).filter(skip)
      if (nextQueue.length) yield * process(nextQueue)
    }

    return process(Array.from(heads))
  }

  traverse () {
    const graph = Graph.cloneGraph(this._graph)

    return Replica.traverse({
      blocks: this.blocks,
      Entry: this.Entry,
      Identity: this.Identity,
      heads: Graph.heads(graph),
      tails: Graph.tails(graph),
      missing: Graph.missing(graph),
      denied: Graph.denied(graph)
    })
  }

  async has (cid) {
    return Graph.hasNode(this._graph, cid)
  }

  async known (cid) {
    return Graph.knownNode(this._graph, cid)
  }

  async add (entries) {
    for await (const entry of entries) {
      await this.block.put(entry.block)
      // todo: check for log membership via entry.tag
      Graph.addNode(this._graph, entry.cid, entry.next)
    }
    this.events.emit('update')
  }

  async write (payload) {
    const entry = await this.Entry.create({
      identity: this.identity,
      tag: this.manifest.getTag(),
      clock: this.height,
      payload,
      next: this.heads
    })

    await this.blocks.put(entry.block)

    // do not await
    const add = this.add([entry])

    add.then(() => this.events.emit('write'))
    return add
  }

  // async deny (entries) {
  //   for await (const entry of entries) {
  //
  //   }
  // }
}
