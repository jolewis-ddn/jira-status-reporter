const test = require('ava')
const debug = require('debug')('ava-tests')

const fs = require('fs')

const JSR = require('../JiraStatusReporter')
const ChartLinkMaker = require('../ChartLinkMaker')
const JiraStatusReporterFileManager = require('../JiraStatusReporterFileManager')
const jsr = new JSR()

const CONFIG_JS = '../config'
const DEFAULT_CONFIG_FILE = '../jiraConfig.json'
const DEFAULT_CONFIG_FILE_RENAMED = DEFAULT_CONFIG_FILE + '-ORIG'
const ALT_CONFIG_FILE = '../.JiraStatusServer.json'
const ALT_CONFIG_FILE_RENAMED = ALT_CONFIG_FILE + '-ORIG'

const data = [1,2,3]
const categories = ['a','b','c']

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
test.skip('At least one valid config file exists', t => {
    t.true(fs.existsSync(DEFAULT_CONFIG_FILE) || fs.existsSync(ALT_CONFIG_FILE))
})

test('config.js loads (default config file)', t => {
    let defExists = fs.existsSync(DEFAULT_CONFIG_FILE)
    let altExists = fs.existsSync(ALT_CONFIG_FILE)

    if (!defExists) { fs.writeFileSync(DEFAULT_CONFIG_FILE, 'PLACEHOLDER') }
    if (altExists) { fs.renameSync(ALT_CONFIG_FILE, ALT_CONFIG_FILE_RENAMED) }
    
    t.notThrows(require(CONFIG_JS))

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
    
    t.notThrows(require(CONFIG_JS))

    if (defExists) { fs.renameSync(DEFAULT_CONFIG_FILE_RENAMED, DEFAULT_CONFIG_FILE) }
    if (!altExists) { fs.unlinkSync(ALT_CONFIG_FILE) }
})

test.skip('Verify config.js default config file format', t => {
    let defExists = fs.existsSync(DEFAULT_CONFIG_FILE)
    if (!defExists) { t.pass('No default config file found') }

    const cfg = JSON.parse(fs.readFileSync(DEFAULT_CONFIG_FILE))
    t.true('jira' in cfg &&
            'protocol' in cfg.jira &&
            'host' in cfg.jira &&
            'username' in cfg.jira &&
            'password' in cfg.jira &&
            'apiVersion' in cfg.jira &&
            'server' in cfg &&
            'port' in cfg.server &&
            'project' in cfg
        )
    // Note: "fa" is optional
})

test.skip('Exception thrown if at least one required config file does not exist', t => {
    let defExists = fs.existsSync(DEFAULT_CONFIG_FILE)
    let altExists = fs.existsSync(ALT_CONFIG_FILE)

    if (defExists) { fs.renameSync(DEFAULT_CONFIG_FILE, DEFAULT_CONFIG_FILE_RENAMED) }
    if (altExists) { fs.renameSync(ALT_CONFIG_FILE, ALT_CONFIG_FILE_RENAMED) }

    t.throws(require(CONFIG_JS))
    
    if (defExists) { fs.renameSync(DEFAULT_CONFIG_FILE_RENAMED, DEFAULT_CONFIG_FILE) }
    if (altExists) { fs.renameSync(ALT_CONFIG_FILE_RENAMED, ALT_CONFIG_FILE) }
})

test.skip('Verify config.js custom config format if file exists', t => {
    let altExists = fs.existsSync(ALT_CONFIG_FILE)
    if (!altExists) { t.pass('No alternate config file found') }

    const alt = JSON.parse(fs.readFileSync(ALT_CONFIG_FILE))
    const altCfgFilename = alt.config
    const cfg = JSON.parse(fs.readFileSync(altCfgFilename))

    t.true('jira' in cfg &&
            'protocol' in cfg.jira &&
            'host' in cfg.jira &&
            'username' in cfg.jira &&
            'password' in cfg.jira &&
            'apiVersion' in cfg.jira &&
            'server' in cfg &&
            'port' in cfg.server &&
            'project' in cfg
        )
})

/*-----------------------------------
   ChartLinkMaker
/------------------------------------*/

test('Confirm CLM load', t => {
    const clm = new ChartLinkMaker(data, categories)
    t.pass()
})

test('Reset', t => {
    const clm = new ChartLinkMaker(data, categories)
    t.assert(clm.reset() == clm)
})

test('Set Bar chart', t => { 
    const clm = new ChartLinkMaker(data,categories)
    t.assert(clm.setBarChart() == clm)
})

test('Set Line chart', t => { 
    const clm = new ChartLinkMaker(data,categories)
    t.assert(clm.setLineChart() == clm)
})

test('Set Chart type', t => { 
    const clm = new ChartLinkMaker(data,categories)
    t.assert(clm.setChartType('Doughnut') == clm)
})

test('Set Fill', t => { 
    const clm = new ChartLinkMaker(data,categories)
    t.assert(clm.setFill('#ff0000') == clm)
})

test('Validate Categories: Fails (pre setCategories())', t => { 
    const clm = new ChartLinkMaker(data,categories)
    clm.dataCategories = false
    t.throws(() => { clm._validateCategories(3) })
})

test('Set Categories', t => { 
    const clm = new ChartLinkMaker(data,categories)
    t.assert(clm.setCategories(categories) == clm)
})    

test('Validate Categories: Good', t => { 
    const clm = new ChartLinkMaker(data,categories)
    t.notThrows(() => { clm._validateCategories(3) })
})    

test('Validate Categories: Invalid category size', t => { 
    const clm = new ChartLinkMaker(data,categories)
    t.throws(() => { clm._validateCategories(2) })
})

test('Add series: Good', t => { 
    const clm = new ChartLinkMaker(data,categories)
    t.assert(clm.addSeries('more data', [10, 20, 30]) == clm)
})

test('Add series: Bad', t => { 
    const clm = new ChartLinkMaker(data,categories)
    t.assert(clm.addSeries('more data', [30]) == clm)
})

test('Confirm bar chart content', async t => {
    const clm = new ChartLinkMaker(data,categories)
    const config = require(CONFIG_JS)

    const chart = await clm.buildChartImgTag()
    debug(`chart: ${chart}`)
    t.true(typeof chart == "string") // chart == `<img src="${config().protocol}://${config().server}:${config().port}/chart?width=500&height=300&c={type:'bar',data:{labels:['a','b','c'], datasets:[{fill:false},{fill:false},{fill:false}]}}">`)
})

test.todo('Validate response string contents')

/*-----------------------------------
   JiraStatusReporterFileManager
/------------------------------------*/

test('Create JSRFM', t => {
    const JSRFM = new JiraStatusReporterFileManager('TEST')
    t.true(typeof JSRFM == "object")
})

test('JSRFM: getHomeDir', t => {
    const HOME_DIR = 'BOGUS_HOME_DIR'
    const JSRFM = new JiraStatusReporterFileManager(HOME_DIR)
    t.true(JSRFM.getHomeDir() == HOME_DIR)
})

test('JSRFM: buildChartUrl', async t => {
    const JSRFM = new JiraStatusReporterFileManager('TEST')
    const url = await JSRFM.buildChartUrl()
    t.assert(url)
})

/*-----------------------------------
   Jira
/------------------------------------*/

// Jira: Connection

test.todo('Verify Jira connection')

// Jira: Query

test.todo('Verify simple JQL results')
