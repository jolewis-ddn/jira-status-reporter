const test = require('ava')
const debug = require('debug')('ava-tests')

const fs = require('fs')

const JSR = require('./JiraStatusReporter')
const jsr = new JSR()

const DEFAULT_CONFIG_FILE = './jiraConfig.json'
const DEFAULT_CONFIG_FILE_RENAMED = DEFAULT_CONFIG_FILE + '-ORIG'
const ALT_CONFIG_FILE = './.JiraStatusServer.json'
const ALT_CONFIG_FILE_RENAMED = ALT_CONFIG_FILE + '-ORIG'

test.before(t => {
    // Start the server

})

test('JSR: Custom field list', t => {
    const F = ['key']
    jsr.setFields(F)
    const fields = jsr.getFields()
    t.true(fields == F)
})

// Configuration
test('At least one valid config file exists', t => {
    t.true(fs.existsSync(DEFAULT_CONFIG_FILE) || fs.existsSync(ALT_CONFIG_FILE))
})

test('config.js loads (default config file)', t => {
    let defExists = fs.existsSync(DEFAULT_CONFIG_FILE)
    let altExists = fs.existsSync(ALT_CONFIG_FILE)

    if (!defExists) { fs.writeFileSync(DEFAULT_CONFIG_FILE, 'PLACEHOLDER') }
    if (altExists) { fs.renameSync(ALT_CONFIG_FILE, ALT_CONFIG_FILE_RENAMED) }
    
    t.notThrows(require('./config'))

    if (!defExists) { fs.unlinkSync(DEFAULT_CONFIG_FILE) }
    if (altExists) { fs.renameSync(ALT_CONFIG_FILE_RENAMED, ALT_CONFIG_FILE) }
})

test('config.js loads (alternate config file)', t => {
    let defExists = fs.existsSync(DEFAULT_CONFIG_FILE)
    let altExists = fs.existsSync(ALT_CONFIG_FILE)

    if (defExists) { 
        if (!altExists) {
            fs.copyFileSync(DEFAULT_CONFIG_FILE, ALT_CONFIG_FILE) 
        }
        fs.renameSync(DEFAULT_CONFIG_FILE, DEFAULT_CONFIG_FILE_RENAMED); 
    } else if (!altExists) { 
        debug(`neither alt nor default config file exists, so creating ALT`)
        fs.writeFileSync(ALT_CONFIG_FILE, JSON.stringify({ config: DEFAULT_CONFIG_FILE }))
    }
    
    t.notThrows(require('./config'))

    if (defExists) { fs.renameSync(DEFAULT_CONFIG_FILE_RENAMED, DEFAULT_CONFIG_FILE) }
    if (!altExists) { fs.unlinkSync(ALT_CONFIG_FILE) }
})

test.todo('Verify config.js default config file format')

test('Exception thrown if at least one required config file does not exist', t => {
    let defExists = fs.existsSync(DEFAULT_CONFIG_FILE)
    let altExists = fs.existsSync(ALT_CONFIG_FILE)

    if (defExists) { fs.renameSync(DEFAULT_CONFIG_FILE, DEFAULT_CONFIG_FILE_RENAMED) }
    if (altExists) { fs.renameSync(ALT_CONFIG_FILE, ALT_CONFIG_FILE_RENAMED) }

    t.throws(require('./config'))
    
    if (defExists) { fs.renameSync(DEFAULT_CONFIG_FILE_RENAMED, DEFAULT_CONFIG_FILE) }
    if (altExists) { fs.renameSync(ALT_CONFIG_FILE_RENAMED, ALT_CONFIG_FILE) }
})

test.todo('Verify config.js custom config format if file exists')

/*-----------------------------------
   Jira
/------------------------------------*/

// Jira: Connection

test.todo('Verify Jira connection')

// Jira: Query

test.todo('Verify simple JQL results')
