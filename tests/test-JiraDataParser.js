/** @format */

const futils = require('../functionUtils')
const path = require('path')
const test = require('ava')
const debug = require('debug')('test-JiraDataParser')
const fs = require('fs')

const JDP = require('../JiraDataParser')
let jdp

let TEST_CONFIG = {}

test.before((t) => {
  const TEST_DATA_FILE = [__dirname, 'test-data', 'JDR-test-data.json'].join(
    path.sep
  )
  const TEST_DATA_FILE_ISSUE_COUNT = 28
  const origData = JSON.parse(fs.readFileSync(TEST_DATA_FILE))
  TEST_CONFIG = {
    file: TEST_DATA_FILE,
    issueCount: TEST_DATA_FILE_ISSUE_COUNT,
    origData: origData,
  }
})

test.beforeEach((t) => {})

test('Class instantiation', (t) => {
  jdp = new JDP()
  t.assert(jdp)
})

test('Data Load - invalid (obj creation)', (t) => {
  t.plan(4)
  t.throws(() => {
    new JDP({ bogus: 'data' }) // missing comment and issues[]
  })
  t.throws(() => {
    new JDP({ issues: ['a', 'b'] }) // missing comment (& invalid issue)
  })
  t.throws(() => {
    new JDP({ comment: 'Compiled by JiraStatusReporter' }) // missing issues[]
  })
  t.throws(() => {
    new JDP({ comment: 'Compiled by JiraStatusReporter', issues: ['a', 'b'] }) // invalid issue data
  })
})

test('Data Load & issue count - valid (obj creation)', (t) => {
  t.plan(3)
  t.true(fs.existsSync(TEST_CONFIG.file))
  jdp = new JDP(TEST_CONFIG.origData)
  t.is(jdp.summary().issueCount, TEST_CONFIG.issueCount)
  t.is(TEST_CONFIG.origData.issues, jdp.data()) // data() only returns the issue data
})

test('Data Load & issue-count - valid (post)', (t) => {
  t.plan(3)
  t.true(fs.existsSync(TEST_CONFIG.file))
  loadData()
  t.is(jdp.recordCount, TEST_CONFIG.issueCount)
  t.is(TEST_CONFIG.origData.issues, jdp.data()) // data() only returns the issue data
})

test('Stats: Summary', (t) => {
  t.plan(1)
  loadData()
  t.pass(jdp.summary().issueCount == TEST_CONFIG.issueCount)
})

test('Stats: Status List', (t) => {
  t.plan(1)
  loadData()
  let statuses = jdp.statusList
  //   debug(statuses)
  t.assert(Object.keys(statuses).length)
})

test('Stats: User List', (t) => {
  t.plan(1)
  loadData()
  let users = jdp.userList
  //   debug(users)
  t.assert(Object.keys(users).length)
})

test('Stats: Issue Types', (t) => {
  t.plan(1)
  loadData()
  let types = jdp.typeList
  //   debug(types)
  t.assert(Object.keys(types).length)
})

test('Stats: Timeline', (t) => {
  t.plan(1)
  loadData()
  let timelines = jdp.timelines
  //   console.table(timelines)
  //   console.table(Object.keys(timelines).map((x) => timelines[x].assignee))
  t.assert(Object.keys(timelines).length == jdp.issueCount)
})

test.todo('Stats: Global')

function loadData() {
  let result = jdp.data(TEST_CONFIG.origData)
  //   debug(result)
  //   if (!futils.isSuccess(result)) {
  //     console.error(`not isSuccess ${result} ${futils.isSuccess(result)}`)
  //     throw new Error(`not isSuccess ${result} ${futils.isSuccess(result)}`)
  //   }
}
