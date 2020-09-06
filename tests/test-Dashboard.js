const test = require('ava')
const debug = require('debug')('ava-tests-Dashboard')

const Dashboard = require('../Dashboard')
const dashboard = new Dashboard()

/*-----------------------------------
   Dashboard
/------------------------------------*/

test('Field count > 0', async t => {
   const count = await dashboard.getFieldCount()
   t.assert(count > 0)
})

test('Generate valid dashboard data as HTML and JSON', async t => {
   const data = await dashboard.build()
   t.is(typeof data, typeof {})
   t.is(typeof dashboard.fetch('html'), typeof "")
   t.is(typeof dashboard.fetch('json'), typeof {})
   const table = dashboard.buildTable(['A', 'B'], {'A': [1,2,3,4,5], 'B': [9,8,7,6,5] })
   t.is(typeof table, typeof "")
   t.regex(table, /table/)
   t.regex(table, /table-responsive-md/)
   t.regex(table, /table-sm/)
   t.regex(table, /table-hover/)
   t.regex(table, /table-striped/)
})
