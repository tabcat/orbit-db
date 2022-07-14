
// the goal is to make a traverser that can read and replicate entries
// when reading entries we want the traverser to visit only known entries and in order
// when replicating entries we want the traverser to visit only unknown entries in any order

import { pushable } from 'it-pushable'
// import { paramap } from 'paramap-it'
import { compare } from 'uint8arrays/compare'

// thinking about keeping this as only sorting metric after causal links
const sortCids = (c1, c2) => compare(c1.bytes, c2.bytes)
export const sortEntries = (e1, e2) => {
  // after causal links clocks are the heaviest metric
  const dist = e1.clock - e2.clock
  if (dist !== 0) {
    return dist
  }

  // then the entry writer auth
  const auths = compare(e1.auth, e2.auth)
  if (auths !== 0) {
    return auths
  }

  // last metric is the entry cid
  return sortCids(e1.cid, e2.cid)
}

// todo: improve read ahead with entry.refs
export function traverser ({
  cids, // array of CID
  load, // load function takes a cid and returns an entry or null
  links, // links function takes an object containing an entry or cid and returns an array of cid
  ordered, // entries are yielded in order; not needed for replication traversal
  sortFn, // entry sorting function takes 2 entries and returns -1, 0 or +1, ordered must be true
  signal // abort signal https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
}) {
  ordered = ordered || true
  sortFn = sortFn || sortEntries

  const source = pushable()

  // const order = cids => ordered ? walk(cids) : cids.forEach(cid => walk([cid]))

  async function walk (cids) {
    // trivial abort for now; later pass abort to load function
    if (signal.aborted) { return }

    const entries = await Promise.all(cids.map(load))
      .then(entries => entries
        .filter(Boolean) // eliminate null load returns
        .sort(sortEntries)
      )
    entries.forEach(source.push)

    // get next cids; links function must only return unseen cids so there are no duplicate cids in nexts
    const nexts = await Promise.all(entries.map(entry => links({ entry })))
      .flatMap(cids => cids) // combine link arrays
      .sort(sortCids)

    if (nexts.length) {
      // order(nexts)
      return walk(nexts)
    }
  }

  // no parallel traversal for now
  walk(cids).then(() => source.end())
  // order(cids).then(() => source.end()) // todo: eliminate order function, move logic into walk

  return source
}
