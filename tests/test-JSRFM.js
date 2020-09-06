const test = require('ava')
const debug = require('debug')('ava-tests-JSRFM')

const JiraStatusReporterFileManager = require('../JiraStatusReporterFileManager')

/*-----------------------------------
   JiraStatusReporterFileManager
/------------------------------------*/

test('Set and Get home directory', (t) => {
    const HOME_DIR = 'BOGUS_HOME_DIR'
    const JSRFM = new JiraStatusReporterFileManager(HOME_DIR)
    const jHomeDir = JSRFM.getHomeDir()
    t.is(jHomeDir, HOME_DIR)
})
