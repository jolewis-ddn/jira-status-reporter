const test = require('ava')
const debug = require('debug')('ava-tests-JiraStatus')

const JiraStatus = require('../JiraStatus')
const server = require('../JiraStatusServer')

const supertest = require('supertest')
const request = supertest(server)

/*-----------------------------------
   JiraStatusServer
/------------------------------------*/

test('JiraStatusServer/config returns 200 or 300', async (t) => {
   const res = await request.get('/config')
   t.regex(res.header['content-type'], /json/)
   t.assert(res.status < 400)
})

/*-----------------------------------
   JiraStatus
/------------------------------------*/

test.todo('Verify simple report output')
test.todo('Verify config output - JSON')
test.todo('Verify config output - HTML')

test('getFields: Length', async t => {
   const data = await JiraStatus.getFields()
   t.assert(data.length > 0)
})

test('getFields: Array', async t => {
   const data = await JiraStatus.getFields()
   t.assert(typeof data == typeof [])
})

test('getFields: Required Fields', async t => {
   const data = await JiraStatus.getFields()
   const REQUIRED_FIELDS = ["resolution", "lastViewed", "labels", "issuelinks", "assignee", "components", "subtasks", "reporter", "progress", "worklog", "issuetype", "resolutiondate", "watches", "updated", "description", "summary", "environment", "duedate", "comment", "fixVersions", "priority", "versions", "status", "issuekey", "creator"]
   REQUIRED_FIELDS.forEach((REQ) => {
      t.assert(data.find(el => el.id == REQ))
   })
})

test.todo('FontAwesome: Turned on')
test.todo('FontAwesome: Turned off')
test.todo('FontAwesome: Get icons')
test.todo('FontAwesome: Get JS link')
test.todo('Format CSS / Class Name')
