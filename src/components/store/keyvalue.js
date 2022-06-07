
const type = 'keyvalue'

const ops = Object.fromEntries([
  'PUT',
  'DEL'
].map(op => [op, op]))

const actions = {
  put: (key, value) => ({ op: ops.PUT, key, value }),
  del: (key) => ({ op: ops.DEL, key })
}

const selectors = {
  get: (state) => (key) => state.get(key)
}

const initialState = () => new Map()

async function reducer (traverse, state = initialState()) {
  for await (const { payload: { op, key, value } } of traverse) {
    if (state.has(key)) {
      continue
    }

    switch (op.type) {
      case ops.PUT:
        state.put(key, value)
        break
      case ops.DEL:
        state.delete(key)
        break
      default:
        break
    }
  }

  return state
}

export class KeyValue {
  constructor () {
    this.state = initialState()
  }

  static async create () {
    return new KeyValue()
  }

  static get type () { return type }
  get type () { return type }

  static get actions () { return actions }

  static get selectors () { return selectors }

  static get reducer () { return reducer }

  async update ({ replica }) {
    this.state = await reducer(replica.traverse())
    this.events.emit('update')
  }
}
