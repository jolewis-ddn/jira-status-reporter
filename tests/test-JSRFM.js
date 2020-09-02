const test = require('ava')
const debug = require('debug')('ava-tests-JSRFM')

const JiraStatusReporterFileManager = require('../JiraStatusReporterFileManager')

/*-----------------------------------
   JiraStatusReporterFileManager
/------------------------------------*/

test('Create JSRFM', (t) => {
    const JSRFM = new JiraStatusReporterFileManager('TEST')
    t.true(typeof JSRFM == 'object')
})

test('JSRFM: getHomeDir', (t) => {
    const HOME_DIR = 'BOGUS_HOME_DIR'
    const JSRFM = new JiraStatusReporterFileManager(HOME_DIR)
    t.true(JSRFM.getHomeDir() == HOME_DIR)
})

test('JSRFM: buildChartUrl', async (t) => {
    const JSRFM = new JiraStatusReporterFileManager('TEST')
    const url = await JSRFM.buildChartUrl()
    t.assert(url)
})