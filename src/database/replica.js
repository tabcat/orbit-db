
import * as Graph from './graph.js'
// import EventEmitter from 'events'
import { CID } from 'multiformats/cid'
import { base32 } from 'multiformats/bases/base32'
import { compare } from 'uint8arrays/compare'

import { traverser } from './traversal.js'

export class Replica {
  constructor ({ manifest, storage, blocks, Entry, Identity, graph }) {
    this.manifest = manifest
    this.storage = storage
    this.blocks = blocks
    this.Entry = Entry
    this.Identity = Identity

    this._graph = graph
  }

  static async open ({ manifest, createStorage, blocks, Entry, Identity }) {
    const storage = createStorage('replica')
    await storage.open()
    const graph = Graph.initGraph()

    return new Replica({ manifest, storage, blocks, Entry, Identity, storage, graph })
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

  traverse ({ direction } = { direction: 'descend' }) {
    const seen = new Set()

    const graph = Graph.clone(this._graph)
    const headsAndTails = [Graph.heads(graph), Graph.tails(graph)]

    let edge
    if (direction !== 'descend') {
      edge = 'out'
    } else if (direction === 'ascend') {
      // heads and tails are switched if traversal is ascending
      // headsAndTails.reverse()
      // edge = 'in'
    }
    // todo: less wordy way to assign heads and tails from direction
    const [heads, tails] = headsAndTails

    async function links ({ cid, entry }) {
      if (entry) {
        cid = entry.cid
      }
      const str = cid.toString(base32)

      // do not traverse past the tails
      if (Graph.tails.has(str)) {
        return []
      }

      const adjacents = Graph.getNode(graph, str)[edge]
      const cids = []
      for (const str of adjacents) {
        if (seen.has(str)) { return }

        seen.add(str)
        cids.push(CID.parse(str))
      }

      return cids
    }

    // todo: prefetch and cache entry.refs
    async function load (cid) {
      return Entry.fetch({ blocks, cid, Identity })
    }

    return traverser({
      cids: Array.from(heads).map(CID.parse),
      links,
      load
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
