const test = require('ava')
const debug = require('debug')('ava-tests-JiraStatus')

const JiraStatus = require('../JiraStatus')

const supertest = require('supertest')

const config = require('config')

const REQUIRED_FIELDS = ["resolution", "lastViewed", "labels", "issuelinks", "assignee", "components", "subtasks", "reporter", "progress", "worklog", "issuetype", "resolutiondate", "watches", "updated", "description", "summary", "environment", "duedate", "comment", "fixVersions", "priority", "versions", "status", "issuekey", "creator"]

test('Verify simple report output', async t => {
   const report = await JiraStatus.report()
   t.is(typeof report, 'object')
   const reportKeys = Object.keys(report)
   const REQUIRED_REPORT_KEYS = ['Epic Count', 'Dead Issue Count', 'Open Issues (Count)']
   REQUIRED_REPORT_KEYS.forEach((key) => {
      t.true(reportKeys.includes(key))
   })
})

test('getFields: Validate required fields by specific fields and minimum length', async t => {
   const data = await JiraStatus.getFields()
   REQUIRED_FIELDS.forEach((REQ) => {
      t.assert(data.find(el => el.id == REQ))
   })
   t.assert(data.length >= REQUIRED_FIELDS.length)
   t.assert(typeof data == typeof [])
})

test('FontAwesome On/Off via config', async t => {
   if (config.has('fa')) {
      t.assert(JiraStatus.useFontawesome)
   } else {
      t.assert(!JiraStatus.useFontawesome)
   }
})

test('FontAwesome: Valid icons', async t => {
   const icons = JiraStatus.faIcons
   Object.keys(icons).forEach((key) => {
      t.assert(icons[key].indexOf('fa:') == 0)
   })
})

test('FontAwesome: Get JS link', async t => {
   if (config.has('fa')) {
      const faRequest = await supertest(config.get('fa')).get('')
      t.is(faRequest.status, 200)
      t.is(faRequest.type, 'text/javascript')
      t.assert(faRequest.text.length > 0)
   } else {
      t.pass('fa not enabled')
   }
})

test('Format CSS / Class Name', t => {
   t.is(JiraStatus.formatCssClassName('In Progress'), 'InProgress') 
   t.is(JiraStatus.formatCssClassName('In Review'), 'InReview') 
   t.is(JiraStatus.formatCssClassName('Open'), 'Open') 
})

test('Config as HTML', t => {
   const cfgHtml = JiraStatus.formatConfigHtml(JiraStatus.getConfig())
   t.assert(typeof cfgHtml == 'string')
})

test('Fields as HTML', async t => {
   const fieldsHtml = await JiraStatus.formatFieldsHtml(await JiraStatus.getFields())
   t.regex(fieldsHtml, /ID/)
   t.regex(fieldsHtml, /Name/)
   t.regex(fieldsHtml, /Custom/)
   t.regex(fieldsHtml, /Navigable/)
   t.regex(fieldsHtml, /Searchable/)
   t.regex(fieldsHtml, /Clause Names/)
   t.regex(fieldsHtml, /fields as of /)
})

test.skip('Project Data as HTML', async t => {
   const report = await JiraStatus.formatProjectDataHtml(await JiraStatus.getProjects())
   t.is(typeof report, 'string')
})

