/* eslint-disable */
const isElectron = require('is-electron')
const isNode = require('is-node')

const fs = (isElectron() || isNode) ? eval('require("fs")') : null

module.exports = fs
