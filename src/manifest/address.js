
import { CID } from 'multiformats/cid'

const prefix = '/orbitdb/'
const parse = function (address) {
  address = address.toString()

  if (!address.startsWith(prefix)) {
    throw new Error(`'${prefix}' prefix missing from address: ${address}`)
  }

  try {
    return CID.parse(address.split('/')[2])
  } catch (e) {
    console.error(e)
    throw new Error(`failed to parse CID in address: ${address}`)
  }
}

export class Address {
  constructor (cid) {
    this.cid = cid
  }

  static get prefix () { return prefix }

  static asAddress (address = {}, force = false) {
    if (address instanceof Address) {
      return address
    }

    const cid = CID.asCID(address.cid)
    if (cid) {
      return new Address(cid)
    }

    if (force) {
      throw new Error(`unable to coerce to address from: ${address}`)
    }
    return null
  }

  static fromString (string) {
    return new Address(parse(string))
  }

  toString (base) {
    return prefix + this.cid.toString(base)
  }

  // static fromBytes (bytes) {
  //   return new Address(CID.decode(bytes))
  // }
  //
  // toBytes () {
  //   return this.cid.bytes
  // }

  equals (address) {
    address = Address.asAddress(address, true)
    return this.cid.equals(address.cid)
  }
}
