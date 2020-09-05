const test = require('ava')
const debug = require('debug')('ava-tests-Config')

const CONFIG_JS = 'config'
// const DEFAULT_CONFIG_FILE = '../config/default.json'

// Configuration
test('Verify config file format', (t) => {
    const config = require(CONFIG_JS)
    t.true(config.has('jira'))
    t.true(config.has('jira.protocol'))
    t.true(config.has('jira.host'))
    t.true(config.has('jira.username'))
    t.true(config.has('jira.password'))
    t.true(config.has('jira.apiVersion'))
    t.true(config.has('server'))
    t.true(config.has('server.port'))
    t.true(config.has('project'))
    // Note: "fa" is optional
})

test('JSR: Custom field list', (t) => {
    const JSR = require('../JiraStatusReporter')
    const jsr = new JSR()
    
    const F = ['key']
    jsr.setFields(F)
    const fields = jsr.getFields()
    t.true(fields == F)
})
