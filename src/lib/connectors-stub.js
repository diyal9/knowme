'use strict'

/**
 * Compatibility shim — Connector SDK lives in ./connectors.
 * Tokens are never stored here. Feishu uses local lark-cli identity.
 */
const { createConnectorsApi } = require('./connectors')

let _api = null

function getApi(getUserData) {
  if (!_api) {
    _api = createConnectorsApi({
      getUserData: typeof getUserData === 'function' ? getUserData : () => '',
    })
  }
  return _api
}

/** @deprecated use createConnectorsApi — kept for older requires */
const CONNECTORS = []

function listConnectors() {
  return getApi().listConnectors()
}

function bindUserData(getUserData) {
  _api = createConnectorsApi({ getUserData })
  return _api
}

module.exports = {
  CONNECTORS,
  listConnectors,
  bindUserData,
  getApi,
  createConnectorsApi,
}
