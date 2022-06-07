
// the goal is to make a traverser that can read and replicate entries
// when reading entries we want the traverser to visit only known entries and in order
// when replicating entries we want the traverser to visit only unknown entries in any order

import { pushable } from 'it-pushable'
// import { paramap } from 'paramap-it'
import { compare } from 'uint8arrays/compare'

// thinking about keeping this as only sorting metric after causal links
const sortCids = (c1, c2) => compare(c1.bytes, c2.bytes)

// todo: improve read ahead with entry.refs
export function traverse ({
  blocks, // blocks api
  cids, // array of CID
  load, // load function takes a cid and returns an entry or null
  seen: new Set(),
  ordered: true // entries are yielded in order; not needed for replication traversal
  signal // abort signal https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
}) {
  const source = pushable()

  async function walk (cids) {
    const entries = (await Promise.all(cids.map(load)))
      .filter(Boolean) // eliminate null load returns
      .sort((e1, e2) => sortCids(e1.cid, e2.cid))
      .forEach(source.push)

    const nexts = entries
      .flatMap(entry => entry.next)
      .filter(cid => !seen.has(cid.toString()))

    order(nexts)
  }

  function order (cids) {
    ordered
      ? walk(cids)
      : cids.forEach(cid => walk([cid]))
  }
  order(cids)

  return source
}
