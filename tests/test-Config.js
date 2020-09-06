const test = require('ava')
const debug = require('debug')('ava-tests-Config')

const config = require('config')

const supertest = require('supertest')

// Configuration
test('Verify config file format', (t) => {
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

// Jira: Connection
test('Simple Jira server call connects with 2** or 3** response', async (t) => {
    const url = config.get('jira.protocol') + '://' + config.get('jira.host')
    const res = await supertest(url).get('/')
    t.assert(res.status < 400)
})
 
test('JSR: Custom field list', (t) => {
    const JSR = require('../JiraStatusReporter')
    const jsr = new JSR()
    
    const F = ['key']
    jsr.setFields(F)
    const fields = jsr.getFields()
    t.true(fields == F)
})
